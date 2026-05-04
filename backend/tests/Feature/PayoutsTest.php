<?php

namespace Tests\Feature;

use App\Console\Commands\ReleasePayouts;
use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayoutsTest extends TestCase
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
        // Stripe stays unconfigured in the test env so the scheduler takes
        // the stub-channel path (no real transfer calls).
        config(['services.stripe.secret' => '', 'services.stripe.key' => '']);
    }

    /* ────────────── Connect onboarding ────────────── */

    public function test_connect_status_reports_unconfigured_when_keys_missing(): void
    {
        $caregiver = $this->verifiedCaregiver();
        Sanctum::actingAs($caregiver->user);

        $this->getJson('/api/me/stripe-connect/status')
            ->assertOk()
            ->assertJsonPath('data.connected', false)
            ->assertJsonPath('data.payouts_enabled', false)
            ->assertJsonPath('meta.stripe_configured', false);
    }

    public function test_connect_onboarding_returns_503_unconfigured(): void
    {
        $caregiver = $this->verifiedCaregiver();
        Sanctum::actingAs($caregiver->user);

        $this->postJson('/api/me/stripe-connect/onboarding')
            ->assertStatus(503)
            ->assertJsonPath('meta.stripe_configured', false);
    }

    public function test_family_cannot_hit_caregiver_connect_endpoints(): void
    {
        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->getJson('/api/me/stripe-connect/status')->assertForbidden();
        $this->postJson('/api/me/stripe-connect/onboarding')->assertForbidden();
        $this->postJson('/api/me/stripe-connect/refresh')->assertForbidden();
    }

    /* ────────────── ReleasePayouts command ────────────── */

    public function test_release_payouts_releases_bookings_past_the_hold(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // 25 hours past check-out, captured-stub → eligible.
        $eligible = $this->makeCapturedBooking($family, $caregiver, hoursAgo: 25);

        // 10 hours past check-out → still inside the hold window.
        $tooSoon = $this->makeCapturedBooking(
            $family,
            $this->verifiedCaregiver(),
            hoursAgo: 10,
        );

        $this->artisan(ReleasePayouts::class)->assertOk();

        $eligibleFresh = $eligible->fresh();
        $this->assertNotNull($eligibleFresh->payout_transferred_at);
        $this->assertNull($eligibleFresh->stripe_transfer_id); // stub path

        // Too-soon booking should be untouched.
        $this->assertNull($tooSoon->fresh()->payout_transferred_at);
    }

    public function test_release_payouts_is_idempotent(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        $booking = $this->makeCapturedBooking($family, $caregiver, hoursAgo: 30);

        $this->artisan(ReleasePayouts::class);
        $firstReleaseAt = $booking->fresh()->payout_transferred_at;
        $this->assertNotNull($firstReleaseAt);

        // Second run should be a no-op because payout_transferred_at is set.
        $this->artisan(ReleasePayouts::class)->assertOk();
        $this->assertEquals(
            $firstReleaseAt->toIso8601String(),
            $booking->fresh()->payout_transferred_at->toIso8601String(),
        );
    }

    public function test_release_payouts_skips_bookings_with_open_dispute(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        $booking = $this->makeCapturedBooking($family, $caregiver, hoursAgo: 30);

        BookingDispute::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->user_id,
            'reason_code' => 'quality',
            'description' => 'Visit was shorter than we expected — still working through it.',
            'status' => BookingDispute::STATUS_OPEN,
        ]);

        $this->artisan(ReleasePayouts::class)->assertOk();

        $this->assertNull($booking->fresh()->payout_transferred_at);
    }

    public function test_check_out_schedules_payout_at_24h(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeInProgressBooking($family, $caregiver);

        Sanctum::actingAs($caregiver->user);

        $this->patchJson("/api/bookings/{$booking->id}/check-out", [
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'tasks_completed' => ['Conversation'],
        ])->assertOk();

        $fresh = $booking->fresh();
        $this->assertNotNull($fresh->payout_at);
        // Sanity window: should be between 23h and 25h from now.
        $expected = now()->addHours(Booking::PAYOUT_HOLD_HOURS);
        $diffHours = abs($fresh->payout_at->diffInMinutes($expected, absolute: true) / 60);
        $this->assertLessThan(1, $diffHours, 'payout_at should be roughly 24h from now');
    }

    /* ────────────── Earnings endpoint ────────────── */

    public function test_earnings_endpoint_rolls_up_totals_correctly(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // One released booking (transferred).
        $released = $this->makeCapturedBooking($family, $caregiver, hoursAgo: 48);
        $released->update(['payout_transferred_at' => now()->subDay()]);

        // One pending (captured but not yet released).
        $pending = $this->makeCapturedBooking($family, $caregiver, hoursAgo: 12);

        // One held pending dispute.
        $held = $this->makeCapturedBooking($family, $caregiver, hoursAgo: 6);
        $held->update(['payment_status' => Booking::PAYMENT_HELD_PENDING_DISPUTE]);

        Sanctum::actingAs($caregiver->user);
        $response = $this->getJson('/api/me/earnings')->assertOk();

        // Each booking is $50 subtotal, 7.5% fee = $3.75, payout = $46.25 (4625 cents).
        $response->assertJsonPath('data.totals.lifetime_cents', 4625 * 3);
        $response->assertJsonPath('data.totals.pending_cents', 4625 * 2); // pending + held

        $this->assertCount(3, $response->json('data.history'));

        $statuses = collect($response->json('data.history'))->pluck('payout_status');
        $this->assertContains('released', $statuses);
        $this->assertContains('pending', $statuses);
        $this->assertContains('held', $statuses);
    }

    public function test_earnings_only_returns_own_bookings(): void
    {
        $family = $this->familyWithProfile();
        $me = $this->verifiedCaregiver();
        $other = $this->verifiedCaregiver();

        $this->makeCapturedBooking($family, $me, hoursAgo: 5);
        $this->makeCapturedBooking($family, $other, hoursAgo: 5);

        Sanctum::actingAs($me->user);
        $response = $this->getJson('/api/me/earnings')->assertOk();

        $this->assertCount(1, $response->json('data.history'));
        $this->assertSame(4625, $response->json('data.totals.lifetime_cents'));
    }

    public function test_family_cannot_hit_earnings(): void
    {
        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->getJson('/api/me/earnings')->assertForbidden();
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

    private function makeGig(FamilyProfile $family, Carbon $start): Gig
    {
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();

        return Gig::create([
            'family_profile_id' => $family->id,
            'service_category_id' => $category->id,
            'description' => 'Afternoon companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'scheduled_start' => $start,
            'scheduled_end' => (clone $start)->addHours(2),
            'status' => Gig::STATUS_BOOKED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);
    }

    /**
     * Already-captured, completed booking. check_out_at placed `hoursAgo`
     * in the past so tests can slide into/out of the 24h hold window.
     */
    private function makeCapturedBooking(FamilyProfile $family, CaregiverProfile $caregiver, int $hoursAgo): Booking
    {
        $checkOutAt = now()->subHours($hoursAgo);
        $checkInAt = $checkOutAt->copy()->subHours(2);
        $gig = $this->makeGig($family, $checkInAt);
        $gig->update(['status' => Gig::STATUS_COMPLETED]);

        return Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiver->user_id,
            'family_profile_id' => $family->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $checkInAt,
            'scheduled_end' => $checkOutAt,
            'address_full' => $gig->location_address,
            'address_neighbourhood' => 'Oshawa',
            'response_deadline_at' => CarbonImmutable::now()->subDays(3),
            'responded_at' => $checkInAt->copy()->subMinutes(30),
            'check_in_at' => $checkInAt,
            'check_in_lat' => self::OSHAWA_LAT,
            'check_in_lng' => self::OSHAWA_LNG,
            'check_in_distance_m' => 10,
            'check_out_at' => $checkOutAt,
            'check_out_lat' => self::OSHAWA_LAT,
            'check_out_lng' => self::OSHAWA_LNG,
            'check_out_distance_m' => 12,
            // `checkOut` sets this to now()+24h — we replicate here so
            // tests can simulate bookings whose hold has already elapsed.
            'payout_at' => $checkOutAt->copy()->addHours(Booking::PAYOUT_HOLD_HOURS),
        ]);
    }

    private function makeInProgressBooking(FamilyProfile $family, CaregiverProfile $caregiver): Booking
    {
        $checkInAt = now()->subHour();
        $gig = $this->makeGig($family, $checkInAt);

        return Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiver->user_id,
            'family_profile_id' => $family->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_IN_PROGRESS,
            'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $checkInAt,
            'scheduled_end' => (clone $checkInAt)->addHours(2),
            'address_full' => $gig->location_address,
            'address_neighbourhood' => 'Oshawa',
            'response_deadline_at' => CarbonImmutable::now()->subHour(),
            'responded_at' => (clone $checkInAt)->subMinutes(30),
            'check_in_at' => $checkInAt,
            'check_in_lat' => self::OSHAWA_LAT,
            'check_in_lng' => self::OSHAWA_LNG,
            'check_in_distance_m' => 10,
        ]);
    }
}
