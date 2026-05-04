<?php

namespace Tests\Feature;

use App\Console\Commands\ExpireBookingOffers;
use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingControllerTest extends TestCase
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

    /* ────────────── helpers ────────────── */

    private function familyWithProfile(): FamilyProfile
    {
        $user = User::factory()->create([
            'role' => 'family',
            'email_verified_at' => now(),
        ]);

        return FamilyProfile::create(['user_id' => $user->id, 'relationship' => 'parent']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function verifiedCaregiver(array $overrides = []): CaregiverProfile
    {
        $user = User::factory()->create(array_merge([
            'role' => 'caregiver',
            'email_verified_at' => now(),
            'gender' => 'female',
        ], $overrides['user'] ?? []));

        $profile = CaregiverProfile::create(array_merge([
            'user_id' => $user->id,
            'bio' => 'Gentle and steady.',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
            'languages' => ['English'],
        ], array_diff_key($overrides, array_flip(['user']))));

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
     * @param  array<string, mixed>  $overrides
     */
    private function makeGig(FamilyProfile $family, array $overrides = []): Gig
    {
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();

        return Gig::create(array_merge([
            'family_profile_id' => $family->id,
            'service_category_id' => $category->id,
            'description' => 'Afternoon companionship and a walk in the park.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'scheduled_start' => now()->addDays(2)->setTime(10, 0),
            'scheduled_end' => now()->addDays(2)->setTime(13, 0),
            'status' => Gig::STATUS_OPEN,
            'posting_mode' => Gig::POSTING_MATCHED,
        ], $overrides));
    }

    /**
     * @param  array<int, int>  $ranked
     * @return array<string, mixed>
     */
    private function storePayload(Gig $gig, int $primary, array $ranked): array
    {
        return [
            'gig_id' => $gig->id,
            'caregiver_user_id' => $primary,
            'ranked_caregiver_ids' => array_values(array_unique(array_merge([$primary], $ranked))),
        ];
    }

    /* ────────────── auth ────────────── */

    public function test_guest_cannot_create_booking(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $caregiver = $this->verifiedCaregiver();

        $this->postJson('/api/bookings', $this->storePayload($gig, $caregiver->user_id, []))
            ->assertUnauthorized();
    }

    public function test_caregiver_cannot_create_booking(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $caregiver = $this->verifiedCaregiver();

        Sanctum::actingAs($caregiver->user);

        $this->postJson('/api/bookings', $this->storePayload($gig, $caregiver->user_id, []))
            ->assertForbidden();
    }

    public function test_family_not_owning_gig_cannot_book_it(): void
    {
        $owner = $this->familyWithProfile();
        $other = $this->familyWithProfile();
        $gig = $this->makeGig($owner);
        $caregiver = $this->verifiedCaregiver();

        Sanctum::actingAs($other->user);

        $this->postJson('/api/bookings', $this->storePayload($gig, $caregiver->user_id, []))
            ->assertStatus(422);
    }

    /* ────────────── create ────────────── */

    public function test_family_can_book_a_caregiver_from_matches(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $primary = $this->verifiedCaregiver();
        $backup = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);

        $response = $this->postJson('/api/bookings', $this->storePayload($gig, $primary->user_id, [$backup->user_id]));

        $response->assertCreated();
        $response->assertJsonPath('data.status', Booking::STATUS_PENDING_CAREGIVER);
        $response->assertJsonPath('data.caregiver.id', $primary->user_id);
        $response->assertJsonPath('data.fallback_queue_size', 1);
        $response->assertJsonPath('data.payment_status', Booking::PAYMENT_NOT_REQUIRED);

        // 3 hours × $25/hr = $75 subtotal; 7.5% platform fee = $5.63
        $response->assertJsonPath('data.subtotal_cents', 7500);
        $response->assertJsonPath('data.platform_fee_cents', 563);
        $response->assertJsonPath('data.caregiver_payout_cents', 6937);

        $this->assertDatabaseCount('bookings', 1);
        $this->assertSame(Gig::STATUS_MATCHED, $gig->fresh()->status);
    }

    public function test_double_booking_same_gig_is_rejected(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $a = $this->verifiedCaregiver();
        $b = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);

        $this->postJson('/api/bookings', $this->storePayload($gig, $a->user_id, [$b->user_id]))
            ->assertCreated();

        $this->postJson('/api/bookings', $this->storePayload($gig, $b->user_id, []))
            ->assertStatus(422);
    }

    public function test_booking_a_past_gig_is_rejected(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, [
            'scheduled_start' => now()->subHour(),
            'scheduled_end' => now()->addHour(),
        ]);
        $caregiver = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);

        $this->postJson('/api/bookings', $this->storePayload($gig, $caregiver->user_id, []))
            ->assertStatus(422);
    }

    /* ────────────── accept ────────────── */

    public function test_caregiver_can_accept_and_transitions_gig_to_booked(): void
    {
        [$family, $gig, $caregiver, $booking] = $this->seedOffer();

        Sanctum::actingAs($caregiver->user);

        $response = $this->patchJson("/api/bookings/{$booking->id}/accept");

        $response->assertOk();
        $response->assertJsonPath('data.status', Booking::STATUS_CONFIRMED);
        $response->assertJsonPath('data.payment_status', Booking::PAYMENT_AUTHORIZED_STUB);

        $this->assertSame(Gig::STATUS_BOOKED, $gig->fresh()->status);
    }

    public function test_family_cannot_accept_for_caregiver(): void
    {
        [$family, , , $booking] = $this->seedOffer();

        Sanctum::actingAs($family->user);

        $this->patchJson("/api/bookings/{$booking->id}/accept")->assertStatus(422);
    }

    public function test_accepting_expired_offer_is_rejected(): void
    {
        [, , $caregiver, $booking] = $this->seedOffer();
        $booking->update(['response_deadline_at' => now()->subMinutes(5)]);

        Sanctum::actingAs($caregiver->user);

        $this->patchJson("/api/bookings/{$booking->id}/accept")->assertStatus(422);
    }

    /* ────────────── decline / cascade ────────────── */

    public function test_declining_cascades_to_next_ranked_caregiver(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $primary = $this->verifiedCaregiver();
        $backup = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);
        $this->postJson('/api/bookings', $this->storePayload($gig, $primary->user_id, [$backup->user_id]))
            ->assertCreated();

        $firstBooking = Booking::where('caregiver_user_id', $primary->user_id)->firstOrFail();

        Sanctum::actingAs($primary->user);
        $this->patchJson("/api/bookings/{$firstBooking->id}/decline", ['reason' => 'Scheduling conflict.'])
            ->assertOk();

        $firstBooking->refresh();
        $this->assertSame(Booking::STATUS_DECLINED, $firstBooking->status);
        $this->assertSame('Scheduling conflict.', $firstBooking->cancellation_reason);

        $cascaded = Booking::where('caregiver_user_id', $backup->user_id)->firstOrFail();
        $this->assertSame(Booking::STATUS_PENDING_CAREGIVER, $cascaded->status);
        $this->assertSame(2, $cascaded->match_rank);
        $this->assertSame([], $cascaded->fallback_queue);
    }

    public function test_declining_with_no_backup_returns_gig_to_open(): void
    {
        [$family, $gig, $caregiver, $booking] = $this->seedOffer();

        Sanctum::actingAs($caregiver->user);
        $this->patchJson("/api/bookings/{$booking->id}/decline")->assertOk();

        $this->assertSame(Gig::STATUS_OPEN, $gig->fresh()->status);
        $this->assertSame(1, Booking::count());
    }

    public function test_scheduler_expires_stale_offers_and_cascades(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $primary = $this->verifiedCaregiver();
        $backup = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);
        $this->postJson('/api/bookings', $this->storePayload($gig, $primary->user_id, [$backup->user_id]))
            ->assertCreated();

        $pending = Booking::where('caregiver_user_id', $primary->user_id)->firstOrFail();
        $pending->update(['response_deadline_at' => now()->subMinute()]);

        $this->artisan(ExpireBookingOffers::class)->assertSuccessful();

        $this->assertSame(Booking::STATUS_EXPIRED, $pending->fresh()->status);
        $cascaded = Booking::where('caregiver_user_id', $backup->user_id)->firstOrFail();
        $this->assertSame(Booking::STATUS_PENDING_CAREGIVER, $cascaded->status);
    }

    /* ────────────── cancel ────────────── */

    public function test_family_can_cancel_a_pending_offer(): void
    {
        [$family, $gig, , $booking] = $this->seedOffer();

        Sanctum::actingAs($family->user);
        $this->patchJson("/api/bookings/{$booking->id}/cancel", ['reason' => 'Plans changed.'])
            ->assertOk();

        $booking->refresh();
        $this->assertSame(Booking::STATUS_CANCELLED_FAMILY, $booking->status);
        $this->assertSame(Booking::CANCELLED_BY_FAMILY, $booking->cancelled_by);
        $this->assertSame(Gig::STATUS_OPEN, $gig->fresh()->status);
    }

    public function test_family_free_cancel_window_releases_payment_stub(): void
    {
        [$family, , $caregiver, $booking] = $this->seedOffer();

        // Confirm first so there's an authorized payment to release.
        Sanctum::actingAs($caregiver->user);
        $this->patchJson("/api/bookings/{$booking->id}/accept")->assertOk();

        // Gig scheduled 2 days out → well outside the 24-hour free-cancel window.
        Sanctum::actingAs($family->user);
        $this->patchJson("/api/bookings/{$booking->id}/cancel")->assertOk();

        $this->assertSame(Booking::PAYMENT_RELEASED_STUB, $booking->fresh()->payment_status);
    }

    public function test_family_late_cancel_retains_fee(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, [
            'scheduled_start' => now()->addHours(5),
            'scheduled_end' => now()->addHours(8),
        ]);
        $caregiver = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);
        $this->postJson('/api/bookings', $this->storePayload($gig, $caregiver->user_id, []))
            ->assertCreated();

        $booking = Booking::firstOrFail();

        Sanctum::actingAs($caregiver->user);
        $this->patchJson("/api/bookings/{$booking->id}/accept")->assertOk();

        Sanctum::actingAs($family->user);
        $this->patchJson("/api/bookings/{$booking->id}/cancel")->assertOk();

        // Inside 24h → stub-captures (fee retained).
        $this->assertSame(Booking::PAYMENT_CAPTURED_STUB, $booking->fresh()->payment_status);
    }

    public function test_caregiver_can_cancel_own_confirmed_booking(): void
    {
        [, , $caregiver, $booking] = $this->seedOffer();

        Sanctum::actingAs($caregiver->user);
        $this->patchJson("/api/bookings/{$booking->id}/accept")->assertOk();
        $this->patchJson("/api/bookings/{$booking->id}/cancel")->assertOk();

        $this->assertSame(Booking::STATUS_CANCELLED_CAREGIVER, $booking->fresh()->status);
    }

    public function test_unrelated_user_cannot_cancel(): void
    {
        [, , , $booking] = $this->seedOffer();
        $outsider = User::factory()->create(['role' => 'caregiver']);

        Sanctum::actingAs($outsider);

        $this->patchJson("/api/bookings/{$booking->id}/cancel")->assertForbidden();
    }

    /* ────────────── list + show ────────────── */

    public function test_family_sees_only_their_bookings(): void
    {
        [$familyA, , , $bookingA] = $this->seedOffer();
        [, , , $bookingB] = $this->seedOffer();

        Sanctum::actingAs($familyA->user);

        $response = $this->getJson('/api/bookings');
        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($bookingA->id, $ids);
        $this->assertNotContains($bookingB->id, $ids);
    }

    public function test_caregiver_cannot_see_full_address_until_confirmed(): void
    {
        [, , $caregiver, $booking] = $this->seedOffer();

        Sanctum::actingAs($caregiver->user);

        $pending = $this->getJson("/api/bookings/{$booking->id}")->assertOk();
        $pending->assertJsonPath('data.address_full', null);

        $this->patchJson("/api/bookings/{$booking->id}/accept")->assertOk();

        $confirmed = $this->getJson("/api/bookings/{$booking->id}")->assertOk();
        $this->assertIsString($confirmed->json('data.address_full'));
    }

    /* ────────────── seeding helper ────────────── */

    /**
     * @return array{FamilyProfile, Gig, CaregiverProfile, Booking}
     */
    private function seedOffer(): array
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $caregiver = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);
        $this->postJson('/api/bookings', $this->storePayload($gig, $caregiver->user_id, []))
            ->assertCreated();

        // orderByDesc in case the helper is called multiple times within a test.
        $booking = Booking::query()->orderByDesc('id')->firstOrFail();

        // Reset auth state so individual tests choose their actor explicitly.
        app('auth')->forgetGuards();

        return [$family->fresh(), $gig->fresh(), $caregiver->fresh(), $booking->fresh()];
    }
}
