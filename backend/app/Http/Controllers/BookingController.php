<?php

namespace App\Http\Controllers;

use App\Http\Requests\Booking\CancelBookingRequest;
use App\Http\Requests\Booking\CheckInBookingRequest;
use App\Http\Requests\Booking\CheckOutBookingRequest;
use App\Http\Requests\Booking\DeclineBookingRequest;
use App\Http\Requests\Booking\OpenDisputeRequest;
use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Requests\Booking\UpdateBookingTasksRequest;
use App\Http\Resources\BookingDisputeResource;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Gig;
use App\Models\User;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

class BookingController extends Controller
{
    public function __construct(private readonly BookingService $service) {}

    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Booking::query()
            ->with(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        if ($user->isFamily()) {
            $profile = $user->familyProfile;
            if (! $profile) {
                return BookingResource::collection(collect());
            }
            $query->where('family_profile_id', $profile->id);
        } elseif ($user->isCaregiver()) {
            $query->where('caregiver_user_id', $user->id);
        } else {
            return response()->json(['message' => 'This role has no bookings.'], 403);
        }

        if ($request->filled('status')) {
            $status = $request->string('status')->toString();
            $statuses = $this->expandStatusFilter($status);
            if ($statuses === null) {
                return response()->json(['message' => 'Invalid status filter.'], 422);
            }
            $query->whereIn('status', $statuses);
        }

        $query->orderByDesc('scheduled_start');

        return BookingResource::collection($query->get());
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->familyProfile;

        if (! $profile) {
            return response()->json(['message' => 'Complete your family profile first.'], 422);
        }

        /** @var Gig $gig */
        $gig = Gig::findOrFail($request->integer('gig_id'));

        /** @var list<int|string> $rawRanked */
        $rawRanked = $request->input('ranked_caregiver_ids', []);
        $ranked = array_map(static fn ($v): int => (int) $v, $rawRanked);

        $booking = $this->service->createFromMatch(
            gig: $gig,
            family: $profile,
            caregiverUserId: $request->integer('caregiver_user_id'),
            rankedCaregiverIds: $ranked,
        );

        $booking->loadMissing(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        return (new BookingResource($booking))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Request $request, Booking $booking): BookingResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canViewBooking($booking, $user)) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        $booking->loadMissing([
            'gig.serviceCategory',
            'caregiver.caregiverProfile',
            'familyProfile.user',
            'panicAlerts',
        ]);

        return new BookingResource($booking);
    }

    public function accept(Request $request, Booking $booking): BookingResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $booking = $this->service->accept($booking, $user);
        $booking->loadMissing(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        return new BookingResource($booking);
    }

    public function decline(DeclineBookingRequest $request, Booking $booking): BookingResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $this->service->decline($booking, $user, $request->input('reason'));

        return new BookingResource($booking->fresh(['gig.serviceCategory', 'caregiver.caregiverProfile']));
    }

    public function cancel(CancelBookingRequest $request, Booking $booking): BookingResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canActOnBooking($booking, $user)) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        $booking = $this->service->cancel($booking, $user, $request->input('reason'));
        $booking->loadMissing(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        return new BookingResource($booking);
    }

    public function checkIn(CheckInBookingRequest $request, Booking $booking): BookingResource
    {
        /** @var User $user */
        $user = $request->user();

        $booking = $this->service->checkIn(
            booking: $booking,
            actor: $user,
            lat: (float) $request->input('latitude'),
            lng: (float) $request->input('longitude'),
        );

        $booking->loadMissing(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        return new BookingResource($booking);
    }

    public function checkOut(CheckOutBookingRequest $request, Booking $booking): BookingResource
    {
        /** @var User $user */
        $user = $request->user();

        /** @var array<int, string> $tasks */
        $tasks = (array) $request->input('tasks_completed', []);

        $booking = $this->service->checkOut(
            booking: $booking,
            actor: $user,
            lat: (float) $request->input('latitude'),
            lng: (float) $request->input('longitude'),
            tasks: $tasks,
            notes: $request->input('caregiver_notes'),
        );

        $booking->loadMissing(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        return new BookingResource($booking);
    }

    public function openDispute(OpenDisputeRequest $request, Booking $booking): BookingDisputeResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canViewBooking($booking, $user)) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        /** @var array<int, string> $evidence */
        $evidence = (array) $request->input('evidence_paths', []);

        $dispute = $this->service->openDispute(
            booking: $booking,
            reporter: $user,
            reasonCode: $request->string('reason_code')->toString(),
            description: $request->string('description')->toString(),
            evidencePaths: $evidence,
        );

        return new BookingDisputeResource($dispute);
    }

    public function updateTasks(UpdateBookingTasksRequest $request, Booking $booking): BookingResource
    {
        /** @var User $user */
        $user = $request->user();

        /** @var array<int, string> $tasks */
        $tasks = (array) $request->input('tasks_completed', []);

        $booking = $this->service->logTasks(
            booking: $booking,
            actor: $user,
            tasks: $tasks,
            notes: $request->input('caregiver_notes'),
        );

        $booking->loadMissing(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        return new BookingResource($booking);
    }

    /* ──────────── helpers ──────────── */

    private function canViewBooking(Booking $booking, User $user): bool
    {
        if ($user->id === $booking->caregiver_user_id) {
            return true;
        }

        $profile = $user->familyProfile;

        return $profile !== null && $profile->id === $booking->family_profile_id;
    }

    private function canActOnBooking(Booking $booking, User $user): bool
    {
        return $this->canViewBooking($booking, $user);
    }

    /**
     * Expand "upcoming" / "past" shortcuts into concrete status sets so the
     * dashboard UI doesn't need to know the enum.
     *
     * @return array<int, string>|null
     */
    private function expandStatusFilter(string $filter): ?array
    {
        return match ($filter) {
            'all' => [
                Booking::STATUS_PENDING_CAREGIVER,
                Booking::STATUS_CONFIRMED,
                Booking::STATUS_IN_PROGRESS,
                Booking::STATUS_COMPLETED,
                Booking::STATUS_DECLINED,
                Booking::STATUS_EXPIRED,
                Booking::STATUS_CANCELLED_FAMILY,
                Booking::STATUS_CANCELLED_CAREGIVER,
                Booking::STATUS_NO_SHOW,
            ],
            'upcoming' => [
                Booking::STATUS_PENDING_CAREGIVER,
                Booking::STATUS_CONFIRMED,
            ],
            'active' => [
                Booking::STATUS_IN_PROGRESS,
            ],
            'past' => [
                Booking::STATUS_COMPLETED,
                Booking::STATUS_CANCELLED_FAMILY,
                Booking::STATUS_CANCELLED_CAREGIVER,
                Booking::STATUS_DECLINED,
                Booking::STATUS_EXPIRED,
                Booking::STATUS_NO_SHOW,
            ],
            Booking::STATUS_PENDING_CAREGIVER,
            Booking::STATUS_CONFIRMED,
            Booking::STATUS_IN_PROGRESS,
            Booking::STATUS_COMPLETED,
            Booking::STATUS_DECLINED,
            Booking::STATUS_EXPIRED,
            Booking::STATUS_CANCELLED_FAMILY,
            Booking::STATUS_CANCELLED_CAREGIVER,
            Booking::STATUS_NO_SHOW => [$filter],
            default => null,
        };
    }
}
