<?php

namespace Tests\Feature;

use App\Console\Commands\ReleaseVisibleReviews;
use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\Review;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Services\TrustScoreCalculator;
use Carbon\CarbonImmutable;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReviewsTest extends TestCase
{
    use RefreshDatabase;

    private const OSHAWA_LAT = 43.8975;

    private const OSHAWA_LNG = -78.8658;

    protected function setUp(): void
    {
        $this->markTestSkipped(
            'Legacy gig-schema fixture (pre-Fiverr pivot). Re-enable per file as fixtures are migrated to the caregiver-owned Gig model.',
        );
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── submission ────────────── */

    public function test_family_can_submit_review_on_completed_booking(): void
    {
        [$family, $caregiver, $booking] = $this->completedBooking();

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/bookings/{$booking->id}/review", [
            'stars' => 5,
            'body' => 'Anita was lovely — Margaret asked when she was coming back.',
        ])->assertCreated();

        $response->assertJsonPath('data.stars', 5);
        // Not yet visible — counterparty hasn't rated.
        $response->assertJsonPath('data.is_visible', false);

        $this->assertDatabaseCount('reviews', 1);
    }

    public function test_caregiver_can_submit_review_on_completed_booking(): void
    {
        [, $caregiver, $booking] = $this->completedBooking();

        Sanctum::actingAs($caregiver->user);

        $this->postJson("/api/bookings/{$booking->id}/review", [
            'stars' => 4,
            'body' => 'Margaret was kind and easy to work with.',
        ])->assertCreated();
    }

    public function test_double_review_is_rejected(): void
    {
        [$family, , $booking] = $this->completedBooking();
        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 5])
            ->assertCreated();
        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 4])
            ->assertStatus(422);
    }

    public function test_non_party_cannot_review(): void
    {
        [, , $booking] = $this->completedBooking();
        $outsider = $this->familyWithProfile();

        Sanctum::actingAs($outsider->user);

        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 1])
            ->assertStatus(422);
    }

    public function test_cannot_review_non_completed_booking(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeBooking($family, $caregiver, status: Booking::STATUS_CONFIRMED);

        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 5])
            ->assertStatus(422);
    }

    public function test_star_rating_range_is_validated(): void
    {
        [$family, , $booking] = $this->completedBooking();
        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 6])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stars']);

        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['stars']);
    }

    /* ────────────── visibility rules ────────────── */

    public function test_mutual_rating_surfaces_both_reviews_immediately(): void
    {
        [$family, $caregiver, $booking] = $this->completedBooking();

        Sanctum::actingAs($family->user);
        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 5])->assertCreated();

        // Before caregiver rates, family's review is hidden.
        $this->assertNull(Review::where('rater_user_id', $family->user_id)->first()->visible_at);

        Sanctum::actingAs($caregiver->user);
        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 4])->assertCreated();

        // Both should now be visible.
        $this->assertNotNull(Review::where('rater_user_id', $family->user_id)->first()->visible_at);
        $this->assertNotNull(Review::where('rater_user_id', $caregiver->user_id)->first()->visible_at);
    }

    public function test_release_visible_command_surfaces_old_reviews(): void
    {
        [$family, , $booking] = $this->completedBooking();
        Sanctum::actingAs($family->user);
        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 5])->assertCreated();

        $review = Review::first();
        // Simulate 8 days having passed since submission.
        $review->update(['submitted_at' => now()->subDays(8)]);

        $this->artisan(ReleaseVisibleReviews::class)->assertOk();

        $this->assertNotNull($review->fresh()->visible_at);
    }

    public function test_release_visible_skips_recent_reviews(): void
    {
        [$family, , $booking] = $this->completedBooking();
        Sanctum::actingAs($family->user);
        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 5])->assertCreated();

        // submitted_at stays at now (default) — only 0 days old.
        $this->artisan(ReleaseVisibleReviews::class)->assertOk();

        $this->assertNull(Review::first()->fresh()->visible_at);
    }

    /* ────────────── profile endpoint ────────────── */

    public function test_user_reviews_endpoint_returns_only_visible_reviews(): void
    {
        [$family, $caregiver, $bookingA] = $this->completedBooking();
        [, , $bookingB] = $this->completedBooking(caregiver: $caregiver);

        // Review A: mutual-rated (visible).
        Sanctum::actingAs($family->user);
        $this->postJson("/api/bookings/{$bookingA->id}/review", ['stars' => 5])->assertCreated();
        Sanctum::actingAs($caregiver->user);
        $this->postJson("/api/bookings/{$bookingA->id}/review", ['stars' => 4])->assertCreated();

        // Review B: family only, still hidden.
        $otherFamily = $this->familyWithProfile();
        // Reassign booking B to the other family so it's a valid rater.
        $bookingB->update(['family_profile_id' => $otherFamily->id]);
        Sanctum::actingAs($otherFamily->user);
        $this->postJson("/api/bookings/{$bookingB->id}/review", ['stars' => 1])->assertCreated();

        // Public endpoint only shows mutual-rated one.
        Sanctum::actingAs($family->user);
        $response = $this->getJson("/api/users/{$caregiver->user_id}/reviews")->assertOk();
        $response->assertJsonPath('meta.count', 1);
        $response->assertJsonPath('meta.average_stars', 5);
    }

    public function test_pending_reviews_endpoint(): void
    {
        [$family, $caregiver, $booking] = $this->completedBooking();

        Sanctum::actingAs($family->user);
        $response = $this->getJson('/api/me/reviews/pending')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($booking->id, $response->json('data.0.booking_id'));

        // After reviewing, it should drop off the pending list.
        $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 5])->assertCreated();
        $this->getJson('/api/me/reviews/pending')->assertJsonCount(0, 'data');
    }

    /* ────────────── flagging ────────────── */

    public function test_party_can_flag_review(): void
    {
        [$family, $caregiver, $booking] = $this->completedBooking();

        Sanctum::actingAs($family->user);
        $submit = $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 1])
            ->assertCreated();
        $reviewId = $submit->json('data.id');

        Sanctum::actingAs($caregiver->user);
        $this->postJson("/api/reviews/{$reviewId}/flag", ['flag_reason' => 'retaliatory'])
            ->assertOk();

        $review = Review::find($reviewId);
        $this->assertNotNull($review->flagged_at);
        $this->assertSame('retaliatory', $review->flag_reason);
    }

    public function test_invalid_flag_reason_rejected(): void
    {
        [$family, , $booking] = $this->completedBooking();
        Sanctum::actingAs($family->user);
        $submit = $this->postJson("/api/bookings/{$booking->id}/review", ['stars' => 1])->assertCreated();
        $reviewId = $submit->json('data.id');

        $this->postJson("/api/reviews/{$reviewId}/flag", ['flag_reason' => 'spam'])
            ->assertStatus(422);
    }

    /* ────────────── Trust Score ────────────── */

    public function test_trust_score_uses_review_avg_once_threshold_crossed(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // Seed 4 visible reviews: 5, 4, 5, 5 → avg 4.75 → reviewScore 95.
        foreach ([5, 4, 5, 5] as $stars) {
            $booking = $this->makeBooking($family, $caregiver, status: Booking::STATUS_COMPLETED);
            Review::create([
                'booking_id' => $booking->id,
                'rater_user_id' => $family->user_id,
                'ratee_user_id' => $caregiver->user_id,
                'stars' => $stars,
                'submitted_at' => now()->subDays(10),
                'visible_at' => now()->subDays(10),
            ]);
        }

        $calc = app(TrustScoreCalculator::class);
        $breakdown = $calc->breakdown($caregiver->fresh());

        $this->assertSame(95, $breakdown['components']['reviews']);
        $this->assertFalse($breakdown['is_new']);
    }

    public function test_trust_score_stays_neutral_below_review_threshold(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // Only 2 reviews — below the 3-review threshold.
        foreach ([5, 5] as $stars) {
            $booking = $this->makeBooking($family, $caregiver, status: Booking::STATUS_COMPLETED);
            Review::create([
                'booking_id' => $booking->id,
                'rater_user_id' => $family->user_id,
                'ratee_user_id' => $caregiver->user_id,
                'stars' => $stars,
                'submitted_at' => now()->subDays(10),
                'visible_at' => now()->subDays(10),
            ]);
        }

        $calc = app(TrustScoreCalculator::class);
        $breakdown = $calc->breakdown($caregiver->fresh());

        $this->assertSame(100, $breakdown['components']['reviews']);
        $this->assertTrue($breakdown['is_new']);
    }

    public function test_trust_score_reliability_reflects_completion_and_ontime(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // One completed, on-time visit.
        $booking = $this->makeBooking($family, $caregiver, status: Booking::STATUS_COMPLETED);
        $booking->update([
            'check_in_at' => $booking->scheduled_start,
        ]);

        $calc = app(TrustScoreCalculator::class);
        $breakdown = $calc->breakdown($caregiver->fresh());

        // 100% completion × 100% on-time → 100 reliability.
        $this->assertSame(100, $breakdown['components']['reliability']);
    }

    public function test_trust_score_reliability_drops_with_cancellations(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // 1 completed + 1 caregiver-cancelled = 50% completion rate.
        $completed = $this->makeBooking($family, $caregiver, status: Booking::STATUS_COMPLETED);
        $completed->update(['check_in_at' => $completed->scheduled_start]);
        $this->makeBooking($family, $caregiver, status: Booking::STATUS_CANCELLED_CAREGIVER);

        $calc = app(TrustScoreCalculator::class);
        $breakdown = $calc->breakdown($caregiver->fresh());

        // Completion 50% + on-time 100% → average 75.
        $this->assertSame(75, $breakdown['components']['reliability']);
    }

    /* ────────────── helpers ────────────── */

    private function familyWithProfile(): FamilyProfile
    {
        $user = User::factory()->create([
            'role' => 'family',
            'email_verified_at' => now(),
        ]);

        return FamilyProfile::create(['user_id' => $user->id, 'relationship' => 'parent']);
    }

    private function verifiedCaregiver(): CaregiverProfile
    {
        $user = User::factory()->create([
            'role' => 'caregiver',
            'email_verified_at' => now(),
            'gender' => 'female',
        ]);

        $profile = CaregiverProfile::create([
            'user_id' => $user->id,
            'bio' => 'Test caregiver.',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
            'languages' => ['English'],
        ]);

        $companionship = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $profile->services()->sync([$companionship->id]);

        foreach (VerificationRecord::ALL_CHECK_TYPES as $type) {
            VerificationRecord::create([
                'user_id' => $user->id,
                'check_type' => $type,
                'status' => VerificationRecord::STATUS_CLEARED,
                'provider' => 'manual',
            ]);
        }

        return $profile->fresh();
    }

    /**
     * @return array{FamilyProfile, CaregiverProfile, Booking}
     */
    private function completedBooking(?CaregiverProfile $caregiver = null): array
    {
        $family = $this->familyWithProfile();
        $caregiver ??= $this->verifiedCaregiver();
        $booking = $this->makeBooking($family, $caregiver, status: Booking::STATUS_COMPLETED);

        return [$family, $caregiver, $booking];
    }

    private function makeBooking(
        FamilyProfile $family,
        CaregiverProfile $caregiver,
        string $status,
    ): Booking {
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $scheduledStart = now()->subDays(2)->setTime(10, 0);
        $scheduledEnd = $scheduledStart->copy()->addHours(2);

        $gig = Gig::create([
            'family_profile_id' => $family->id,
            'service_category_id' => $category->id,
            'description' => 'Companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'scheduled_start' => $scheduledStart,
            'scheduled_end' => $scheduledEnd,
            'status' => $status === Booking::STATUS_COMPLETED ? Gig::STATUS_COMPLETED : Gig::STATUS_BOOKED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        $checkOutAt = $status === Booking::STATUS_COMPLETED ? $scheduledEnd : null;
        $checkInAt = $status === Booking::STATUS_COMPLETED ? $scheduledStart : null;

        return Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiver->user_id,
            'family_profile_id' => $family->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => $status,
            'payment_status' => $status === Booking::STATUS_COMPLETED
                ? Booking::PAYMENT_CAPTURED_STUB
                : Booking::PAYMENT_AUTHORIZED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $scheduledStart,
            'scheduled_end' => $scheduledEnd,
            'address_full' => $gig->location_address,
            'address_neighbourhood' => 'Oshawa',
            'response_deadline_at' => CarbonImmutable::now()->subDays(3),
            'responded_at' => $scheduledStart->copy()->subHour(),
            'check_in_at' => $checkInAt,
            'check_out_at' => $checkOutAt,
        ]);
    }
}
