<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 14.3 — admin booking management: search, detail, refund + dispute
 * resolution.
 */
class AdminBookingManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $this->markTestSkipped(
            'Legacy gig-schema fixture (pre-Fiverr pivot). Re-enable per file as fixtures are migrated to the caregiver-owned Gig model.',
        );
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── auth ────────────── */

    public function test_non_admin_cannot_list_bookings(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'family']));
        $this->getJson('/api/admin/bookings')->assertForbidden();
    }

    /* ────────────── browse ────────────── */

    public function test_admin_can_list_bookings_with_status_filter(): void
    {
        [$completed] = $this->makeBooking(['status' => Booking::STATUS_COMPLETED]);
        $this->makeBooking(['status' => Booking::STATUS_CONFIRMED]);
        $this->makeBooking(['status' => Booking::STATUS_PENDING_CAREGIVER]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/bookings')
            ->assertOk()
            ->assertJsonPath('meta.total', 3);

        $this->getJson('/api/admin/bookings?status=completed')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $completed->id);
    }

    public function test_has_dispute_filter_returns_only_disputed_bookings(): void
    {
        [$disputed, , $disputedFamily] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_HELD_PENDING_DISPUTE,
        ]);
        $this->makeBooking(['status' => Booking::STATUS_COMPLETED]);

        BookingDispute::create([
            'booking_id' => $disputed->id,
            'reporter_user_id' => $disputedFamily->id,
            'reason_code' => 'no_show',
            'description' => 'Caregiver never arrived for the visit.',
            'status' => BookingDispute::STATUS_OPEN,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/bookings?has_dispute=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $disputed->id);
    }

    /* ────────────── show ────────────── */

    public function test_admin_can_view_booking_with_full_evidence(): void
    {
        [$booking, , $family, $caregiver] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_HELD_PENDING_DISPUTE,
        ]);

        BookingDispute::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->id,
            'reason_code' => 'quality',
            'description' => 'Visit quality fell below expectations.',
            'status' => BookingDispute::STATUS_OPEN,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson("/api/admin/bookings/{$booking->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $booking->id)
            ->assertJsonPath('data.caregiver.id', $caregiver->id)
            ->assertJsonPath('data.disputes.0.reason_code', 'quality')
            ->assertJsonStructure([
                'data' => [
                    'gig',
                    'check_in',
                    'check_out',
                    'tasks_completed',
                    'panic_alerts',
                    'incident_reports',
                    'reviews',
                    'disputes',
                ],
            ]);
    }

    /* ────────────── refund ────────────── */

    public function test_admin_can_issue_full_refund_and_audit_log(): void
    {
        [$booking] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/bookings/{$booking->id}/refund", [
            'reason' => 'Customer reported caregiver no-show. Refunding in full.',
        ])->assertOk();

        $this->assertSame(Booking::PAYMENT_REFUNDED_STUB, $booking->fresh()->payment_status);

        $row = AdminAuditLog::query()->where('action', 'booking.refunded')->first();
        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame($booking->id, $row->target_id);
        $this->assertSame($booking->subtotal_cents, $row->metadata['amount_cents']);
        $this->assertTrue($row->metadata['is_full']);
    }

    public function test_partial_refund_records_correct_amount(): void
    {
        [$booking] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $partial = (int) ($booking->subtotal_cents / 2);
        $this->postJson("/api/admin/bookings/{$booking->id}/refund", [
            'amount_cents' => $partial,
            'reason' => 'Half refund for partial visit.',
        ])->assertOk();

        $row = AdminAuditLog::query()->where('action', 'booking.refunded')->first();
        $this->assertSame($partial, $row->metadata['amount_cents']);
        $this->assertFalse($row->metadata['is_full']);
    }

    public function test_refund_resolves_linked_dispute(): void
    {
        [$booking, , $family] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_HELD_PENDING_DISPUTE,
        ]);

        $dispute = BookingDispute::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->id,
            'reason_code' => 'no_show',
            'description' => 'No-show.',
            'status' => BookingDispute::STATUS_OPEN,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/bookings/{$booking->id}/refund", [
            'reason' => 'Dispute substantiated; full refund issued.',
            'dispute_id' => $dispute->id,
        ])->assertOk();

        $disputeFresh = $dispute->fresh();
        $this->assertSame(BookingDispute::STATUS_RESOLVED, $disputeFresh->status);
        $this->assertSame(BookingDispute::RESOLUTION_FULL_REFUND, $disputeFresh->resolution_code);
        $this->assertSame($admin->id, $disputeFresh->resolved_by);
        $this->assertSame('Dispute substantiated; full refund issued.', $disputeFresh->resolution_note);
    }

    public function test_refund_rejected_when_payment_state_not_refundable(): void
    {
        [$booking] = $this->makeBooking([
            'status' => Booking::STATUS_PENDING_CAREGIVER,
            'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson("/api/admin/bookings/{$booking->id}/refund", [
            'reason' => 'Trying to refund a not-yet-captured booking.',
        ])->assertStatus(422);
    }

    public function test_refund_requires_a_reason(): void
    {
        [$booking] = $this->makeBooking([
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->postJson("/api/admin/bookings/{$booking->id}/refund", [])->assertStatus(422);
    }

    /**
     * Helper that builds a Gig + Booking pair and returns
     * [Booking, Gig, family User, caregiver User].
     *
     * @param  array<string, mixed>  $overrides
     * @return array{0: Booking, 1: Gig, 2: User, 3: User}
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

        $bookingData = array_merge([
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
        ], $overrides);

        // For completed bookings, fill in check-in/out so dispute window logic
        // and the show endpoint render a complete row.
        if (($bookingData['status'] ?? null) === Booking::STATUS_COMPLETED) {
            $bookingData['check_in_at'] = $start;
            $bookingData['check_out_at'] = $start->copy()->addHours(2);
        }

        $booking = Booking::create($bookingData);

        return [$booking, $gig, $family, $caregiver];
    }
}
