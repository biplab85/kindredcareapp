<?php

namespace App\Http\Controllers;

use App\Http\Requests\Review\FlagReviewRequest;
use App\Http\Requests\Review\StoreReviewRequest;
use App\Http\Resources\ReviewResource;
use App\Models\Booking;
use App\Models\Review;
use App\Models\User;
use App\Services\ReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReviewController extends Controller
{
    public function __construct(private readonly ReviewService $service) {}

    /**
     * Submit a post-visit review for a booking. Either party may submit;
     * each party gets one review per booking (unique constraint).
     */
    public function store(StoreReviewRequest $request, Booking $booking): ReviewResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $review = $this->service->submit(
            booking: $booking,
            rater: $user,
            stars: (int) $request->integer('stars'),
            body: $request->input('body'),
        );

        return (new ReviewResource($review->load('rater')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * What reviews is the current user still allowed to submit? Returns a
     * flat list of completed bookings where the user is a party and has
     * not yet posted their half of the mutual review.
     */
    public function pending(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = Booking::query()
            ->where('status', Booking::STATUS_COMPLETED)
            ->whereDoesntHave('reviews', fn ($q) => $q->where('rater_user_id', $user->id))
            ->with(['gig.serviceCategory', 'caregiver.caregiverProfile']);

        if ($user->isCaregiver()) {
            $query->where('caregiver_user_id', $user->id);
        } elseif ($user->isFamily()) {
            $profile = $user->familyProfile;
            if (! $profile) {
                return response()->json(['data' => []]);
            }
            $query->where('family_profile_id', $profile->id);
        } else {
            return response()->json(['data' => []]);
        }

        $bookings = $query->orderByDesc('check_out_at')->get();

        return response()->json([
            'data' => $bookings->map(fn (Booking $b) => [
                'booking_id' => $b->id,
                'check_out_at' => $b->check_out_at?->toIso8601String(),
                'service' => $b->gig->serviceCategory->name,
                'caregiver_name' => $b->caregiver->name,
            ])->all(),
        ]);
    }

    /**
     * Visible reviews for a given ratee (caregiver or family user id).
     * Mvp-requirements §4.10: "Reviews become visible on the profile
     * after both parties have rated, OR after 7 days".
     */
    public function forUser(Request $request, User $user): JsonResponse
    {
        $reviews = Review::query()
            ->forRatee($user->id)
            ->visible()
            ->with('rater')
            ->orderByDesc('visible_at')
            ->limit(50)
            ->get();

        $visibleCount = $reviews->count();
        $average = $visibleCount > 0 ? round($reviews->avg('stars'), 2) : null;

        return response()->json([
            'data' => ReviewResource::collection($reviews),
            'meta' => [
                'count' => $visibleCount,
                'average_stars' => $average,
            ],
        ]);
    }

    public function flag(FlagReviewRequest $request, Review $review): ReviewResource
    {
        /** @var User $user */
        $user = $request->user();

        $flagged = $this->service->flag(
            review: $review->loadMissing('booking'),
            reporter: $user,
            reason: $request->string('flag_reason')->toString(),
        );

        return new ReviewResource($flagged->load('rater'));
    }
}
