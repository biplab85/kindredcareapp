<?php

namespace App\Http\Controllers;

use App\Http\Requests\Gig\StoreGigRequest;
use App\Http\Requests\Gig\UpdateGigRequest;
use App\Http\Resources\CaregiverGigResource;
use App\Http\Resources\CaregiverMatchResource;
use App\Http\Resources\GigResource;
use App\Models\CareRecipient;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Services\MatchingEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class GigController extends Controller
{
    private const ALLOWED_STATUSES = [
        Gig::STATUS_OPEN,
        Gig::STATUS_MATCHED,
        Gig::STATUS_BOOKED,
        Gig::STATUS_COMPLETED,
        Gig::STATUS_CANCELLED,
    ];

    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $profile = $user->familyProfile;

        if (! $user->isFamily() || ! $profile) {
            return response()->json(['message' => 'Only family accounts can list gigs.'], 403);
        }

        $query = Gig::query()
            ->where('family_profile_id', $profile->id)
            ->with(['serviceCategory', 'careRecipient']);

        if ($request->filled('status')) {
            $status = $request->string('status')->toString();
            if (! in_array($status, self::ALLOWED_STATUSES, true)) {
                return response()->json(['message' => 'Invalid status filter.'], 422);
            }
            $query->where('status', $status);
        }

        $gigs = $query->orderByDesc('scheduled_start')->get();

        return GigResource::collection($gigs);
    }

    public function store(StoreGigRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $profile = FamilyProfile::firstOrCreate(['user_id' => $user->id]);

        $this->ensureRecipientBelongsToProfile($request->input('care_recipient_id'), $profile);

        $gig = Gig::create([
            'family_profile_id' => $profile->id,
            'care_recipient_id' => $request->input('care_recipient_id'),
            'service_category_id' => $request->integer('service_category_id'),
            'description' => $request->string('description'),
            'location_address' => $request->string('location_address'),
            'latitude' => $request->float('latitude'),
            'longitude' => $request->float('longitude'),
            'scheduled_start' => $request->date('scheduled_start'),
            'scheduled_end' => $request->date('scheduled_end'),
            'is_recurring' => $request->boolean('is_recurring'),
            'recurrence_pattern' => $request->input('recurrence_pattern'),
            'preferences' => $request->input('preferences'),
            'status' => Gig::STATUS_OPEN,
            'posting_mode' => $request->input('posting_mode', Gig::POSTING_MATCHED),
        ]);

        if ($request->hasFile('photo')) {
            $gig->photo_path = $this->storePhoto($request, $gig->id);
            $gig->save();
        }

        return (new GigResource($gig->load(['serviceCategory', 'careRecipient'])))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Request $request, Gig $gig): GigResource|CaregiverGigResource|JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($this->ownedBy($gig, $user)) {
            return new GigResource($gig->load(['serviceCategory', 'careRecipient']));
        }

        if ($user && $user->isCaregiver() && $this->caregiverCanView($gig, $user)) {
            return new CaregiverGigResource($gig->load('serviceCategory'));
        }

        return response()->json(['message' => 'Not authorized.'], 403);
    }

    public function feed(Request $request): AnonymousResourceCollection|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $caregiver = $user->caregiverProfile;

        if (! $user->isCaregiver() || ! $caregiver) {
            return response()->json(['message' => 'Only caregivers can browse the feed.'], 403);
        }

        $serviceIds = $caregiver->services()->pluck('service_categories.id');

        if ($serviceIds->isEmpty()) {
            return CaregiverGigResource::collection(collect());
        }

        $query = Gig::query()
            ->where('status', Gig::STATUS_OPEN)
            ->where('posting_mode', Gig::POSTING_OPEN)
            ->whereIn('service_category_id', $serviceIds)
            ->where('scheduled_start', '>', now())
            ->with('serviceCategory');

        if ($request->filled('service')) {
            $category = ServiceCategory::where('slug', $request->string('service'))->first();
            if (! $category) {
                return response()->json(['message' => 'Unknown service category.'], 422);
            }
            $query->where('service_category_id', $category->id);
        }

        $gigs = $query->orderBy('scheduled_start')->get();

        // Optional nearest-first sort, computed in PHP because the MVP has
        // plenty of headroom before we need a spatial index or SQL Haversine.
        if ($request->query('sort') === 'nearest' && $caregiver->latitude && $caregiver->longitude) {
            $lat = (float) $caregiver->latitude;
            $lng = (float) $caregiver->longitude;
            $gigs = $gigs->sortBy(
                fn (Gig $g) => CaregiverGigResource::haversineKm(
                    $lat,
                    $lng,
                    (float) $g->latitude,
                    (float) $g->longitude,
                ),
            )->values();
        }

        return CaregiverGigResource::collection($gigs);
    }

    public function update(UpdateGigRequest $request, Gig $gig): GigResource|JsonResponse
    {
        if (! $this->ownedBy($gig, $request->user())) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        if (! $gig->isEditable()) {
            return response()->json([
                'message' => 'Only open gigs can be edited.',
            ], 422);
        }

        $gig->fill($request->safe()->only([
            'description',
            'scheduled_start',
            'scheduled_end',
            'is_recurring',
            'recurrence_pattern',
            'preferences',
            'posting_mode',
        ]));

        if ($request->hasFile('photo')) {
            if ($gig->photo_path) {
                Storage::disk('public')->delete($gig->photo_path);
            }
            $gig->photo_path = $this->storePhoto($request, $gig->id);
        }

        $gig->save();

        return new GigResource($gig->fresh(['serviceCategory', 'careRecipient']));
    }

    public function destroy(Request $request, Gig $gig): JsonResponse
    {
        if (! $this->ownedBy($gig, $request->user())) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        if ($gig->status !== Gig::STATUS_OPEN) {
            return response()->json([
                'message' => 'Only open gigs can be deleted. Cancel booked gigs instead.',
            ], 422);
        }

        if ($gig->photo_path) {
            Storage::disk('public')->delete($gig->photo_path);
        }

        $gig->delete();

        return response()->json(['message' => 'Gig deleted.']);
    }

    public function cancel(Request $request, Gig $gig): GigResource|JsonResponse
    {
        if (! $this->ownedBy($gig, $request->user())) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        if (! in_array($gig->status, [Gig::STATUS_OPEN, Gig::STATUS_MATCHED], true)) {
            return response()->json([
                'message' => 'This gig cannot be cancelled from its current state.',
            ], 422);
        }

        $gig->update(['status' => Gig::STATUS_CANCELLED]);

        return new GigResource($gig->fresh(['serviceCategory', 'careRecipient']));
    }

    public function matches(Request $request, Gig $gig, MatchingEngine $engine): JsonResponse
    {
        if (! $this->ownedBy($gig, $request->user())) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        if ($gig->status !== Gig::STATUS_OPEN) {
            return response()->json([
                'message' => 'Matches are only available for open gigs.',
            ], 422);
        }

        $result = $engine->matchesFor($gig->load('careRecipient'));

        return response()->json([
            'data' => CaregiverMatchResource::collection(collect($result['matches']))->resolve(),
            'meta' => [
                'pool_size' => $result['pool_size'],
                'qualifying' => $result['qualifying'],
                'returned' => count($result['matches']),
            ],
        ]);
    }

    private function ownedBy(Gig $gig, ?User $user): bool
    {
        if (! $user || ! $user->isFamily()) {
            return false;
        }

        $profile = $user->familyProfile;

        return $profile && $profile->id === $gig->family_profile_id;
    }

    /**
     * A caregiver may preview an open gig if they offer the service requested.
     * Bookings and applications (Phase 7) will layer on top of this.
     */
    private function caregiverCanView(Gig $gig, User $user): bool
    {
        if ($gig->status !== Gig::STATUS_OPEN) {
            return false;
        }

        // Only broadcast gigs are visible to caregivers via direct URL.
        // Matched-mode gigs are revealed per-caregiver through the Phase 7
        // booking invitation flow.
        if ($gig->posting_mode !== Gig::POSTING_OPEN) {
            return false;
        }

        $caregiver = $user->caregiverProfile;
        if (! $caregiver) {
            return false;
        }

        return $caregiver->services()
            ->where('service_categories.id', $gig->service_category_id)
            ->exists();
    }

    private function ensureRecipientBelongsToProfile(?int $recipientId, FamilyProfile $profile): void
    {
        if ($recipientId === null) {
            return;
        }

        $recipient = CareRecipient::find($recipientId);

        abort_if(
            $recipient === null || $recipient->family_profile_id !== $profile->id,
            403,
            'That care recipient does not belong to your family profile.',
        );
    }

    private function storePhoto(Request $request, int $gigId): string
    {
        $file = $request->file('photo');
        abort_if($file === null, 422, 'Missing photo file.');

        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename = Str::uuid()->toString().'.'.$extension;

        return $file->storeAs("gig-photos/{$gigId}", $filename, 'public');
    }
}
