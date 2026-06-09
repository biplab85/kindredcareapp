<?php

namespace App\Http\Controllers;

use App\Http\Requests\Gig\StoreGigRequest;
use App\Http\Requests\Gig\UpdateGigRequest;
use App\Http\Resources\GigResource;
use App\Models\CaregiverProfile;
use App\Models\Gig;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Caregiver-side CRUD on gig listings + family-side marketplace browse.
 *
 * Endpoint sketch (post-pivot):
 *   GET    /api/gigs              public marketplace browse (family + guest)
 *   GET    /api/gigs/{gig}        public listing detail
 *   POST   /api/gigs              caregiver creates a listing
 *   PATCH  /api/gigs/{gig}        caregiver updates own listing
 *   DELETE /api/gigs/{gig}        caregiver deletes own listing
 *   GET    /api/me/gigs           caregiver's own listings (any status)
 */
class GigController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Gig::query()
            ->published()
            ->with(['serviceCategory', 'caregiverProfile.user']);

        if ($request->filled('category')) {
            $slug = (string) $request->string('category');
            $query->whereHas('serviceCategory', fn ($q) => $q->where('slug', $slug));
        }

        // Filter to a single caregiver's gigs — used by the "Services
        // offered" section on /caregivers/{id}. Param is the user_id
        // (which matches the public profile URL), resolved via the
        // caregiverProfile relation.
        if ($request->filled('caregiver_id')) {
            $userId = (int) $request->input('caregiver_id');
            $query->whereHas(
                'caregiverProfile',
                fn ($q) => $q->where('user_id', $userId),
            );
        }

        // Light sort: most recently published first. Real AI ranking
        // ships in a follow-up; the matcher's scoring is preserved but
        // its inversion (gigs-for-recipient) is its own work item.
        $gigs = $query->orderByDesc('published_at')->orderByDesc('id')->get();

        return GigResource::collection($gigs);
    }

    public function myGigs(Request $request): AnonymousResourceCollection|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Only caregivers can view their gigs.'], 403);
        }

        $profile = $user->caregiverProfile;

        // Caregivers who've signed up but haven't completed their profile yet
        // see an empty list instead of an error — they'll create the profile
        // implicitly the first time they publish a gig (see `store`).
        if (! $profile) {
            return GigResource::collection(collect());
        }

        $gigs = $profile->gigs()
            ->with('serviceCategory')
            ->orderByDesc('updated_at')
            ->get();

        return GigResource::collection($gigs);
    }

    public function store(StoreGigRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = CaregiverProfile::firstOrCreate(['user_id' => $user->id]);

        $status = (string) $request->input('status', Gig::STATUS_PUBLISHED);

        $gig = Gig::create([
            'caregiver_profile_id' => $profile->id,
            'service_category_id' => $request->integer('service_category_id'),
            'title' => $request->string('title'),
            'description' => $request->string('description'),
            'tasks_included' => $request->input('tasks_included'),
            'hourly_rate_cents' => $this->dollarsToCents($request->input('hourly_rate_dollars')),
            'status' => $status,
            'published_at' => $status === Gig::STATUS_PUBLISHED ? now() : null,
        ]);

        if ($request->hasFile('photo')) {
            $gig->photo_path = $this->storePhoto($request, $gig->id);
            $gig->save();
        }

        return (new GigResource($gig->load(['serviceCategory', 'caregiverProfile.user'])))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Request $request, Gig $gig): GigResource|JsonResponse
    {
        // Drafts and paused gigs are only visible to their owner.
        if (! $gig->isPublished()) {
            /** @var User|null $user */
            $user = $request->user();
            if (! $user || ! $this->ownedBy($gig, $user)) {
                return response()->json(['message' => 'Gig not found.'], 404);
            }
        }

        $gig->load(['serviceCategory', 'caregiverProfile.user']);

        return new GigResource($gig);
    }

    public function update(UpdateGigRequest $request, Gig $gig): GigResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $this->ownedBy($gig, $user)) {
            return response()->json(['message' => 'You can only edit your own gigs.'], 403);
        }

        $payload = $request->only([
            'service_category_id',
            'title',
            'description',
            'tasks_included',
            'status',
        ]);

        if ($request->filled('hourly_rate_dollars')) {
            $payload['hourly_rate_cents'] = $this->dollarsToCents($request->input('hourly_rate_dollars'));
        }

        if (array_key_exists('status', $payload) && $payload['status'] === Gig::STATUS_PUBLISHED && $gig->published_at === null) {
            $payload['published_at'] = now();
        }

        if ($request->hasFile('photo')) {
            if ($gig->photo_path) {
                Storage::disk('public')->delete($gig->photo_path);
            }
            $payload['photo_path'] = $this->storePhoto($request, $gig->id);
        }

        $gig->update($payload);

        return new GigResource($gig->fresh(['serviceCategory', 'caregiverProfile.user']));
    }

    public function destroy(Request $request, Gig $gig): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $this->ownedBy($gig, $user)) {
            return response()->json(['message' => 'You can only delete your own gigs.'], 403);
        }

        if ($gig->photo_path) {
            Storage::disk('public')->delete($gig->photo_path);
        }
        $gig->delete();

        return response()->json([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Ownership check — gig belongs to the caregiver-profile of the given user.
     */
    private function ownedBy(Gig $gig, User $user): bool
    {
        return $user->caregiverProfile?->id === $gig->caregiver_profile_id;
    }

    private function dollarsToCents(mixed $dollars): int
    {
        return (int) round(((float) $dollars) * 100);
    }

    /**
     * Store the photo under `gig-photos/{gigId}/uuid.ext` so a caregiver's
     * gigs are partitioned by id and we can sweep on delete.
     */
    private function storePhoto(Request $request, int $gigId): string
    {
        $file = $request->file('photo');
        abort_if($file === null, 422, 'Missing photo file.');

        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'jpg';
        $filename = Str::uuid().'.'.$ext;

        return $file->storeAs("gig-photos/{$gigId}", $filename, 'public');
    }
}
