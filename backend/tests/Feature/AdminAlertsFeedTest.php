<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\Review;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 14.5 — admin alerts feed: aggregator over panic, incident,
 * dispute, flagged-booking, flagged-verification, flagged-review.
 */
class AdminAlertsFeedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    public function test_non_admin_cannot_view_alerts_feed(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'family']));
        $this->getJson('/api/admin/alerts')->assertForbidden();
    }

    public function test_feed_aggregates_across_all_six_sources(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_HELD_PENDING_DISPUTE,
            'flagged_at' => now()->subHours(2),
            'flag_reasons' => ['short_duration'],
        ]);

        // 1. Active panic
        PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->id,
            'triggered_at' => now()->subMinutes(15),
            'status' => PanicAlert::STATUS_ACTIVE,
        ]);

        // 2. Open incident
        IncidentReport::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->id,
            'type' => 'safety',
            'severity' => 'high',
            'description' => 'Caregiver behaved inappropriately during the visit.',
            'status' => IncidentReport::STATUS_OPEN,
        ]);

        // 3. Open dispute
        BookingDispute::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->id,
            'reason_code' => 'quality',
            'description' => 'Visit quality fell short of expectations.',
            'status' => BookingDispute::STATUS_OPEN,
        ]);

        // 4. Flagged verification
        VerificationRecord::create([
            'user_id' => $caregiver->id,
            'check_type' => VerificationRecord::ALL_CHECK_TYPES[0],
            'status' => VerificationRecord::STATUS_FLAGGED,
            'provider' => 'veriff',
        ]);

        // 5. Flagged review
        Review::create([
            'booking_id' => $booking->id,
            'rater_user_id' => $family->id,
            'ratee_user_id' => $caregiver->id,
            'stars' => 1,
            'body' => 'Inappropriate language reported in this review.',
            'submitted_at' => now()->subDays(1),
            'flagged_at' => now()->subHours(3),
            'flagged_by_user_id' => $family->id,
        ]);

        // 6. Flagged booking — already covered by booking->flagged_at above.

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->getJson('/api/admin/alerts')->assertOk();

        $response->assertJsonPath('meta.total', 6);
        $byKind = $response->json('meta.by_kind');
        $this->assertSame(1, $byKind['panic']);
        $this->assertSame(1, $byKind['incident']);
        $this->assertSame(1, $byKind['dispute']);
        $this->assertSame(1, $byKind['flagged_booking']);
        $this->assertSame(1, $byKind['flagged_verification']);
        $this->assertSame(1, $byKind['flagged_review']);
    }

    public function test_kinds_filter_narrows_the_feed(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
        ]);

        PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->id,
            'triggered_at' => now(),
            'status' => PanicAlert::STATUS_ACTIVE,
        ]);
        BookingDispute::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->id,
            'reason_code' => 'quality',
            'description' => 'Visit quality issue.',
            'status' => BookingDispute::STATUS_OPEN,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/alerts?kinds=panic')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.kind', 'panic');

        $this->getJson('/api/admin/alerts?kinds=panic,dispute')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_active_panic_has_critical_severity(): void
    {
        [$booking, $caregiver] = $this->makeBooking([
            'status' => Booking::STATUS_IN_PROGRESS,
        ]);

        PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->id,
            'triggered_at' => now(),
            'status' => PanicAlert::STATUS_ACTIVE,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/alerts?kinds=panic')
            ->assertOk()
            ->assertJsonPath('data.0.kind', 'panic')
            ->assertJsonPath('data.0.severity', 'critical');
    }

    public function test_resolved_panic_does_not_appear(): void
    {
        [$booking, $caregiver] = $this->makeBooking(['status' => Booking::STATUS_IN_PROGRESS]);

        PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->id,
            'triggered_at' => now()->subDay(),
            'status' => PanicAlert::STATUS_RESOLVED,
            'resolved_at' => now()->subHours(1),
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/alerts?kinds=panic')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array{0: Booking, 1: User, 2: User}
     */
    private function makeBooking(array $overrides = []): array
    {
        $caregiver = User::factory()->create(['role' => 'caregiver']);
        $family = User::factory()->create(['role' => 'family']);
        $familyProfile = FamilyProfile::create([
            'user_id' => $family->id,
            'relationship' => 'parent',
        ]);
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();

        $start = now()->setTime(10, 0);
        $gig = Gig::create([
            'family_profile_id' => $familyProfile->id,
            'service_category_id' => $category->id,
            'description' => 'Companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addHours(2),
            'status' => Gig::STATUS_BOOKED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        $booking = Booking::create(array_merge([
            'gig_id' => $gig->id,
            'family_profile_id' => $familyProfile->id,
            'caregiver_user_id' => $caregiver->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_CONFIRMED,
            'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addHours(2),
            'response_deadline_at' => $start->copy()->subHours(4),
            'responded_at' => $start->copy()->subHours(5),
            'address_full' => '123 King St W, Oshawa ON',
            'address_neighbourhood' => 'Oshawa',
        ], $overrides));

        return [$booking, $caregiver, $family];
    }
}
