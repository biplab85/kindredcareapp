<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 13 — panic alerts, pre-visit safety acknowledgement, incident reports,
 * and the admin triage queue.
 */
class SafetyTest extends TestCase
{
    use RefreshDatabase;

    private const OSHAWA_LAT = 43.8975;

    private const OSHAWA_LNG = -78.8658;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ─────────────────────── PANIC TRIGGER (caregiver-side) ─────────────────────── */

    public function test_caregiver_can_trigger_panic_on_in_progress_booking(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);

        Notification::fake();

        $response = $this->postJson('/api/emergency/panic', [
            'booking_id' => $booking->id,
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'silent' => false,
        ])->assertCreated();

        $response
            ->assertJsonPath('data.booking_id', $booking->id)
            ->assertJsonPath('data.status', PanicAlert::STATUS_ACTIVE)
            ->assertJsonPath('data.silent', false);

        $this->assertDatabaseCount('panic_alerts', 1);
    }

    public function test_caregiver_can_trigger_panic_on_confirmed_booking(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_CONFIRMED);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])
            ->assertCreated();
    }

    public function test_panic_rejected_on_completed_booking(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_COMPLETED);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])
            ->assertStatus(422);
    }

    public function test_panic_accepts_missing_gps(): void
    {
        // Caregiver might tap the button before the browser finishes the GPS
        // lookup; backend accepts null coords.
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])
            ->assertCreated()
            ->assertJsonPath('data.gps_lat', null)
            ->assertJsonPath('data.gps_lng', null);
    }

    public function test_silent_flag_is_preserved(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson('/api/emergency/panic', [
            'booking_id' => $booking->id,
            'silent' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.silent', true);
    }

    public function test_non_caregiver_cannot_trigger_panic(): void
    {
        // The FormRequest's authorize() rejects non-caregivers up-front —
        // 403 is more accurate than a 422, since the payload is fine but
        // the caller simply isn't allowed.
        [$family, , $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($family->user);
        Notification::fake();

        $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])
            ->assertForbidden();
    }

    public function test_duplicate_panic_returns_409_with_existing_alert(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $first = $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])
            ->assertCreated();

        // Second press while the first is still active should echo the
        // existing alert back with 409 so the UI can flip straight to the
        // confirmation state instead of double-dipping.
        $second = $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])
            ->assertStatus(409);

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertDatabaseCount('panic_alerts', 1);
    }

    /* ─────────────────────── SAFETY ACKNOWLEDGEMENT ─────────────────────── */

    public function test_caregiver_can_acknowledge_safety_on_confirmed_booking(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_CONFIRMED);
        Sanctum::actingAs($caregiver->user);

        $this->postJson("/api/bookings/{$booking->id}/safety-ack")
            ->assertOk()
            ->assertJsonPath('data.booking_id', $booking->id);

        $this->assertNotNull($booking->fresh()->safety_acknowledged_at);
    }

    public function test_safety_ack_rejected_on_in_progress_booking(): void
    {
        // The ack is a pre-check-in ritual; once in_progress it's redundant
        // and the endpoint should refuse so the audit trail stays clean.
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);

        $this->postJson("/api/bookings/{$booking->id}/safety-ack")->assertStatus(422);
    }

    public function test_non_caregiver_cannot_acknowledge_safety(): void
    {
        [$family, , $booking] = $this->bookingInStatus(Booking::STATUS_CONFIRMED);
        Sanctum::actingAs($family->user);

        $this->postJson("/api/bookings/{$booking->id}/safety-ack")->assertStatus(422);
    }

    public function test_booking_resource_exposes_safety_ack_and_active_panic(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson('/api/emergency/panic', ['booking_id' => $booking->id])->assertCreated();

        $response = $this->getJson("/api/bookings/{$booking->id}")->assertOk();
        $response
            ->assertJsonPath('data.active_panic_alert.status', PanicAlert::STATUS_ACTIVE)
            ->assertJsonPath('data.active_panic_alert.booking_id', null) // not in the compact shape
            ->assertJsonStructure(['data' => ['safety_acknowledged_at', 'active_panic_alert']]);
    }

    /* ─────────────────────── INCIDENT SUBMISSION ─────────────────────── */

    public function test_caregiver_can_file_incident(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_COMPLETED);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson("/api/bookings/{$booking->id}/incidents", [
            'type' => IncidentReport::TYPE_PROPERTY_DAMAGE,
            'severity' => IncidentReport::SEVERITY_MEDIUM,
            'description' => 'A ceramic mug was knocked off the shelf while I was reaching for the kettle.',
        ])
            ->assertCreated()
            ->assertJsonPath('data.type', IncidentReport::TYPE_PROPERTY_DAMAGE)
            ->assertJsonPath('data.severity', IncidentReport::SEVERITY_MEDIUM)
            ->assertJsonPath('data.status', IncidentReport::STATUS_OPEN);

        $this->assertDatabaseCount('incident_reports', 1);
    }

    public function test_family_can_file_incident(): void
    {
        [$family, , $booking] = $this->bookingInStatus(Booking::STATUS_COMPLETED);
        Sanctum::actingAs($family->user);
        Notification::fake();

        $this->postJson("/api/bookings/{$booking->id}/incidents", [
            'type' => IncidentReport::TYPE_SCOPE_VIOLATION,
            'severity' => IncidentReport::SEVERITY_LOW,
            'description' => 'Caregiver asked to use our car for a grocery run, which was not part of the booking.',
        ])->assertCreated();
    }

    public function test_incident_rejects_unknown_type(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson("/api/bookings/{$booking->id}/incidents", [
            'type' => 'aliens',
            'severity' => IncidentReport::SEVERITY_LOW,
            'description' => 'A description that is long enough to pass validation easily.',
        ])->assertStatus(422);
    }

    public function test_incident_rejects_short_description(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);
        Sanctum::actingAs($caregiver->user);
        Notification::fake();

        $this->postJson("/api/bookings/{$booking->id}/incidents", [
            'type' => IncidentReport::TYPE_SAFETY,
            'severity' => IncidentReport::SEVERITY_HIGH,
            'description' => 'too short',
        ])->assertStatus(422);
    }

    public function test_non_party_cannot_file_incident(): void
    {
        [, , $booking] = $this->bookingInStatus(Booking::STATUS_COMPLETED);
        $outsider = User::factory()->create(['role' => 'family']);
        FamilyProfile::create(['user_id' => $outsider->id, 'relationship' => 'parent']);
        Sanctum::actingAs($outsider);
        Notification::fake();

        $this->postJson("/api/bookings/{$booking->id}/incidents", [
            'type' => IncidentReport::TYPE_OTHER,
            'severity' => IncidentReport::SEVERITY_LOW,
            'description' => 'I have no connection to this booking but am attempting to file anyway.',
        ])->assertStatus(422);
    }

    /* ─────────────────────── ADMIN: PANIC QUEUE ─────────────────────── */

    public function test_non_admin_cannot_access_panic_queue(): void
    {
        $family = User::factory()->create(['role' => 'family']);
        Sanctum::actingAs($family);

        $this->getJson('/api/admin/panic-alerts')->assertForbidden();
    }

    public function test_admin_can_list_panic_alerts_open_first(): void
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);

        // Seed: one resolved + one active; active must come first.
        PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->user_id,
            'triggered_at' => now()->subHour(),
            'silent' => false,
            'status' => PanicAlert::STATUS_RESOLVED,
            'resolved_at' => now(),
        ]);
        PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->user_id,
            'triggered_at' => now(),
            'silent' => false,
            'status' => PanicAlert::STATUS_ACTIVE,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/panic-alerts')->assertOk();

        $this->assertSame(PanicAlert::STATUS_ACTIVE, $response->json('data.0.status'));
    }

    public function test_admin_can_acknowledge_active_panic(): void
    {
        $alert = $this->seedActivePanic();
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/panic-alerts/{$alert->id}/acknowledge")
            ->assertOk()
            ->assertJsonPath('data.status', PanicAlert::STATUS_ACKNOWLEDGED);

        $this->assertNotNull($alert->fresh()->acknowledged_at);
    }

    public function test_admin_cannot_acknowledge_already_resolved_alert(): void
    {
        $alert = $this->seedActivePanic();
        $alert->update(['status' => PanicAlert::STATUS_RESOLVED, 'resolved_at' => now()]);

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/panic-alerts/{$alert->id}/acknowledge")->assertStatus(422);
    }

    public function test_admin_can_resolve_panic_with_note(): void
    {
        $alert = $this->seedActivePanic();
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/panic-alerts/{$alert->id}/resolve", [
            'note' => 'Called caregiver back; false alarm — wrong pocket.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', PanicAlert::STATUS_RESOLVED)
            ->assertJsonPath('data.resolution_note', 'Called caregiver back; false alarm — wrong pocket.');
    }

    /* ─────────────────────── ADMIN: INCIDENT QUEUE ─────────────────────── */

    public function test_admin_can_list_incidents_sorted_by_severity(): void
    {
        [, , $booking] = $this->bookingInStatus(Booking::STATUS_COMPLETED);
        $reporter = User::factory()->create(['role' => 'caregiver']);

        // Seed low + critical; critical must come first thanks to the FIELD() order.
        IncidentReport::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $reporter->id,
            'type' => IncidentReport::TYPE_OTHER,
            'severity' => IncidentReport::SEVERITY_LOW,
            'description' => 'Minor note for the log.',
            'status' => IncidentReport::STATUS_OPEN,
        ]);
        IncidentReport::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $reporter->id,
            'type' => IncidentReport::TYPE_ABUSE,
            'severity' => IncidentReport::SEVERITY_CRITICAL,
            'description' => 'Caregiver reports verbal abuse from a family member during the visit.',
            'status' => IncidentReport::STATUS_OPEN,
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/incidents')->assertOk();
        $this->assertSame(IncidentReport::SEVERITY_CRITICAL, $response->json('data.0.severity'));
    }

    public function test_admin_can_assign_incident_and_status_flips_to_investigating(): void
    {
        $incident = $this->seedIncident();
        $admin = User::factory()->create(['role' => 'admin']);
        $assignee = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/incidents/{$incident->id}", [
            'action' => 'assign',
            'assignee_user_id' => $assignee->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.assigned_to', $assignee->id)
            ->assertJsonPath('data.status', IncidentReport::STATUS_INVESTIGATING);
    }

    public function test_admin_can_resolve_incident_with_note(): void
    {
        $incident = $this->seedIncident();
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/incidents/{$incident->id}", [
            'action' => 'resolve',
            'note' => 'Spoke with both parties; booking closed in good standing.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', IncidentReport::STATUS_RESOLVED);
    }

    public function test_admin_can_dismiss_incident(): void
    {
        $incident = $this->seedIncident();
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/incidents/{$incident->id}", [
            'action' => 'dismiss',
            'note' => 'No further action required.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', IncidentReport::STATUS_DISMISSED);
    }

    public function test_non_admin_cannot_assign_incident(): void
    {
        $incident = $this->seedIncident();
        $family = User::factory()->create(['role' => 'family']);
        Sanctum::actingAs($family);

        $this->patchJson("/api/admin/incidents/{$incident->id}", [
            'action' => 'assign',
            'assignee_user_id' => $family->id,
        ])->assertForbidden();
    }

    /* ─────────────────────── helpers ─────────────────────── */

    /**
     * Build a family, caregiver, and booking all in one step.
     *
     * @return array{FamilyProfile, CaregiverProfile, Booking}
     */
    private function bookingInStatus(string $status): array
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->basicCaregiver();
        $booking = $this->makeBooking($family, $caregiver, $status);

        return [$family, $caregiver, $booking];
    }

    private function familyWithProfile(): FamilyProfile
    {
        $user = User::factory()->create([
            'role' => 'family',
            'email_verified_at' => now(),
        ]);

        return FamilyProfile::create(['user_id' => $user->id, 'relationship' => 'parent']);
    }

    private function basicCaregiver(): CaregiverProfile
    {
        $user = User::factory()->create([
            'role' => 'caregiver',
            'email_verified_at' => now(),
            'gender' => 'female',
        ]);

        return CaregiverProfile::create([
            'user_id' => $user->id,
            'bio' => 'Test caregiver.',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
            'languages' => ['English'],
        ]);
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

        $checkInAt = in_array($status, [Booking::STATUS_IN_PROGRESS, Booking::STATUS_COMPLETED], true)
            ? $scheduledStart
            : null;
        $checkOutAt = $status === Booking::STATUS_COMPLETED ? $scheduledEnd : null;

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
            'response_deadline_at' => $scheduledStart->copy()->subHours(4),
            'responded_at' => $scheduledStart->copy()->subHours(5),
            'check_in_at' => $checkInAt,
            'check_out_at' => $checkOutAt,
            'address_full' => '123 King St W, Oshawa ON',
            'address_neighbourhood' => 'Oshawa',
        ]);
    }

    private function seedActivePanic(): PanicAlert
    {
        [, $caregiver, $booking] = $this->bookingInStatus(Booking::STATUS_IN_PROGRESS);

        return PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->user_id,
            'triggered_at' => now(),
            'silent' => false,
            'status' => PanicAlert::STATUS_ACTIVE,
        ]);
    }

    private function seedIncident(): IncidentReport
    {
        [$family, , $booking] = $this->bookingInStatus(Booking::STATUS_COMPLETED);

        return IncidentReport::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $family->user_id,
            'type' => IncidentReport::TYPE_PROPERTY_DAMAGE,
            'severity' => IncidentReport::SEVERITY_MEDIUM,
            'description' => 'A valuable picture frame was broken during the visit.',
            'status' => IncidentReport::STATUS_OPEN,
        ]);
    }
}
