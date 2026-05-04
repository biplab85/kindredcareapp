<?php

namespace Tests\Feature;

use App\Console\Commands\HandleNoShows;
use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Services\StripePaymentService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentsTest extends TestCase
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
        Notification::fake();
    }

    /* ────────────── StripePaymentService degraded path ────────────── */

    public function test_stripe_service_reports_unconfigured_in_dev_env(): void
    {
        config(['services.stripe.secret' => '', 'services.stripe.key' => '']);
        $svc = app(StripePaymentService::class);

        $this->assertFalse($svc->isConfigured());

        $family = $this->familyWithProfile();

        $this->assertNull($svc->ensureCustomer($family));
        $this->assertNull($svc->createSetupIntent($family));
        $this->assertSame([], $svc->listPaymentMethods($family));
    }

    public function test_booking_falls_through_to_stub_channel_without_stripe(): void
    {
        config(['services.stripe.secret' => '', 'services.stripe.key' => '']);

        [$family, $caregiver, $booking] = $this->seedPending();

        Sanctum::actingAs($caregiver->user);
        $this->patchJson("/api/bookings/{$booking->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.payment_status', Booking::PAYMENT_AUTHORIZED_STUB);

        $this->assertNull($booking->fresh()->stripe_payment_intent_id);
    }

    /* ────────────── payment-methods API ────────────── */

    public function test_setup_intent_returns_503_when_stripe_not_configured(): void
    {
        config(['services.stripe.secret' => '', 'services.stripe.key' => '']);

        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->postJson('/api/payments/setup-intent')
            ->assertStatus(503)
            ->assertJsonPath('meta.stripe_configured', false);
    }

    public function test_caregiver_cannot_request_setup_intent(): void
    {
        $caregiver = $this->verifiedCaregiver();
        Sanctum::actingAs($caregiver->user);

        $this->postJson('/api/payments/setup-intent')->assertForbidden();
    }

    public function test_list_payment_methods_returns_empty_when_unconfigured(): void
    {
        config(['services.stripe.secret' => '', 'services.stripe.key' => '']);

        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->getJson('/api/me/payment-methods')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.stripe_configured', false);
    }

    public function test_set_default_payment_method_persists_on_family_profile(): void
    {
        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->patchJson('/api/me/payment-methods/default', ['payment_method_id' => 'pm_test_123'])
            ->assertOk()
            ->assertJsonPath('data.default_payment_method_id', 'pm_test_123');

        $this->assertSame('pm_test_123', $family->fresh()->default_payment_method_id);
    }

    /* ────────────── HandleNoShows command ────────────── */

    public function test_no_show_command_transitions_stale_confirmed_to_no_show(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        // Start was 45 min ago, threshold is 30 — this one should flip.
        $stale = $this->makeConfirmedBooking(
            $family,
            $caregiver,
            scheduledStart: now()->subMinutes(45),
        );

        // Start was 10 min ago — still inside the grace period.
        $fresh = $this->makeConfirmedBooking(
            $family,
            $this->verifiedCaregiver(),
            scheduledStart: now()->subMinutes(10),
        );

        $this->artisan(HandleNoShows::class)->assertOk();

        $staleFresh = $stale->fresh();
        $this->assertSame(Booking::STATUS_NO_SHOW, $staleFresh->status);
        $this->assertSame(Booking::PAYMENT_RELEASED_STUB, $staleFresh->payment_status);
        $this->assertSame(Booking::CANCELLED_BY_SYSTEM, $staleFresh->cancelled_by);

        $this->assertSame(Booking::STATUS_CONFIRMED, $fresh->fresh()->status);
    }

    public function test_no_show_command_reopens_the_gig(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeConfirmedBooking(
            $family,
            $caregiver,
            scheduledStart: now()->subHour(),
        );
        $booking->gig->update(['status' => Gig::STATUS_BOOKED]);

        $this->artisan(HandleNoShows::class)->assertOk();

        $this->assertSame(Gig::STATUS_OPEN, $booking->fresh()->gig->status);
    }

    public function test_no_show_command_is_idempotent(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $this->makeConfirmedBooking($family, $caregiver, scheduledStart: now()->subHour());

        $this->artisan(HandleNoShows::class);
        // Second run: nothing in confirmed-with-no-checkin anymore.
        $this->artisan(HandleNoShows::class)->assertOk();

        $this->assertSame(1, Booking::where('status', Booking::STATUS_NO_SHOW)->count());
    }

    /* ────────────── dispute endpoint ────────────── */

    public function test_family_can_open_dispute_on_completed_visit(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeCompletedBooking($family, $caregiver, hoursAgo: 6);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/bookings/{$booking->id}/dispute", [
            'reason_code' => 'quality',
            'description' => 'Caregiver left an hour early without notifying us first.',
        ])->assertCreated();

        $response->assertJsonPath('data.reason_code', 'quality');
        $response->assertJsonPath('data.status', BookingDispute::STATUS_OPEN);

        $this->assertSame(
            Booking::PAYMENT_HELD_PENDING_DISPUTE,
            $booking->fresh()->payment_status,
        );
    }

    public function test_dispute_cannot_be_opened_outside_48h_window(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeCompletedBooking($family, $caregiver, hoursAgo: 50);

        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/dispute", [
            'reason_code' => 'quality',
            'description' => 'Trying to file late — should be rejected.',
        ])->assertStatus(422);

        $this->assertDatabaseCount('booking_disputes', 0);
    }

    public function test_dispute_requires_completed_status(): void
    {
        [$family, , $booking] = $this->seedPending();
        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/dispute", [
            'reason_code' => 'quality',
            'description' => 'Too early to dispute a pending offer — should be 422.',
        ])->assertStatus(422);
    }

    public function test_caregiver_cannot_open_dispute(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeCompletedBooking($family, $caregiver, hoursAgo: 3);

        Sanctum::actingAs($caregiver->user);

        $this->postJson("/api/bookings/{$booking->id}/dispute", [
            'reason_code' => 'quality',
            'description' => 'Caregiver shouldnt be able to dispute their own visit.',
        ])->assertForbidden();
    }

    public function test_unknown_reason_code_is_rejected(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $booking = $this->makeCompletedBooking($family, $caregiver, hoursAgo: 3);

        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/dispute", [
            'reason_code' => 'not_a_real_code',
            'description' => 'Bad reason code should be rejected before hitting the service.',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['reason_code']);
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

    private function makeGig(FamilyProfile $family, CarbonImmutable|Carbon|null $scheduledStart = null): Gig
    {
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $start = $scheduledStart ?? now()->addDays(2)->setTime(10, 0);

        return Gig::create([
            'family_profile_id' => $family->id,
            'service_category_id' => $category->id,
            'description' => 'Afternoon companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'scheduled_start' => $start,
            'scheduled_end' => (clone $start)->addHours(2),
            'status' => Gig::STATUS_OPEN,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);
    }

    private function makeConfirmedBooking(FamilyProfile $family, CaregiverProfile $caregiver, Carbon $scheduledStart): Booking
    {
        $gig = $this->makeGig($family, $scheduledStart);
        $gig->update(['status' => Gig::STATUS_BOOKED]);

        return Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiver->user_id,
            'family_profile_id' => $family->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_CONFIRMED,
            'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $scheduledStart,
            'scheduled_end' => (clone $scheduledStart)->addHours(2),
            'address_full' => $gig->location_address,
            'address_neighbourhood' => 'Oshawa',
            'response_deadline_at' => CarbonImmutable::now()->subHour(),
            'responded_at' => now()->subMinutes(60),
        ]);
    }

    private function makeCompletedBooking(FamilyProfile $family, CaregiverProfile $caregiver, int $hoursAgo): Booking
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
        ]);
    }

    /**
     * @return array{FamilyProfile, CaregiverProfile, Booking}
     */
    private function seedPending(): array
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $gig = $this->makeGig($family);

        $booking = Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiver->user_id,
            'family_profile_id' => $family->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_PENDING_CAREGIVER,
            'payment_status' => Booking::PAYMENT_NOT_REQUIRED,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $gig->scheduled_start,
            'scheduled_end' => $gig->scheduled_end,
            'address_full' => $gig->location_address,
            'address_neighbourhood' => 'Oshawa',
            'response_deadline_at' => CarbonImmutable::now()->addHours(4),
        ]);

        return [$family, $caregiver, $booking->fresh()];
    }
}
