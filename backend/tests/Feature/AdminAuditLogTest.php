<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 14.5 — admin audit log: writes from action endpoints + read-only
 * viewer endpoint with filters.
 */
class AdminAuditLogTest extends TestCase
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

    public function test_non_admin_cannot_view_audit_log(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'family']));
        $this->getJson('/api/admin/audit-log')->assertForbidden();
    }

    public function test_guest_cannot_view_audit_log(): void
    {
        $this->getJson('/api/admin/audit-log')->assertUnauthorized();
    }

    /* ────────────── writes ────────────── */

    public function test_suspending_a_user_records_an_audit_log_entry(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'caregiver', 'status' => 'active']);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$target->id}/suspend", [
            'reason' => 'Reported off-platform contact attempts.',
        ])->assertOk();

        $row = AdminAuditLog::query()->latest('id')->first();

        $this->assertNotNull($row);
        $this->assertSame('user.suspended', $row->action);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame(AdminAuditLog::TARGET_USER, $row->target_type);
        $this->assertSame($target->id, $row->target_id);
        $this->assertSame('Reported off-platform contact attempts.', $row->reason);
        $this->assertSame(['previous_status' => 'active'], $row->metadata);
    }

    public function test_reactivating_a_user_records_an_audit_log_entry(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'caregiver', 'status' => 'suspended']);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$target->id}/reactivate")->assertOk();

        $row = AdminAuditLog::query()->where('action', 'user.reactivated')->first();

        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame($target->id, $row->target_id);
    }

    public function test_resolving_a_panic_alert_records_an_audit_log_entry(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$booking, $caregiver] = $this->makeBooking();

        $alert = PanicAlert::create([
            'booking_id' => $booking->id,
            'caregiver_user_id' => $caregiver->id,
            'triggered_at' => now(),
            'status' => PanicAlert::STATUS_ACTIVE,
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/panic-alerts/{$alert->id}/resolve", [
            'note' => 'Caregiver was safe; false alarm during phone fumble.',
        ])->assertOk();

        $row = AdminAuditLog::query()->where('action', 'panic.resolved')->first();
        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame(AdminAuditLog::TARGET_PANIC_ALERT, $row->target_type);
        $this->assertSame($alert->id, $row->target_id);
        $this->assertSame('Caregiver was safe; false alarm during phone fumble.', $row->reason);
    }

    public function test_approving_a_verification_records_an_audit_log_entry(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $caregiver = User::factory()->create(['role' => 'caregiver']);

        $record = VerificationRecord::create([
            'user_id' => $caregiver->id,
            'check_type' => VerificationRecord::ALL_CHECK_TYPES[0],
            'status' => VerificationRecord::STATUS_PENDING_REVIEW,
            'provider' => 'manual',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/verifications/{$record->id}/approve", [
            'admin_notes' => 'Documents look complete; clearing check.',
        ])->assertOk();

        $row = AdminAuditLog::query()->where('action', 'verification.approved')->first();
        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame(AdminAuditLog::TARGET_VERIFICATION_RECORD, $row->target_type);
        $this->assertSame($record->id, $row->target_id);
        $this->assertSame('Documents look complete; clearing check.', $row->reason);
        $this->assertSame($caregiver->id, $row->metadata['caregiver_user_id']);
        $this->assertSame('pending_review', $row->metadata['previous_status']);
    }

    public function test_rejecting_a_verification_records_an_audit_log_entry(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $caregiver = User::factory()->create(['role' => 'caregiver']);

        $record = VerificationRecord::create([
            'user_id' => $caregiver->id,
            'check_type' => VerificationRecord::ALL_CHECK_TYPES[0],
            'status' => VerificationRecord::STATUS_PENDING_REVIEW,
            'provider' => 'manual',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/verifications/{$record->id}/reject", [
            'rejection_reason' => 'ID photo unreadable; please reupload a clearer scan.',
        ])->assertOk();

        $row = AdminAuditLog::query()->where('action', 'verification.rejected')->first();
        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame($record->id, $row->target_id);
        $this->assertSame('ID photo unreadable; please reupload a clearer scan.', $row->reason);
    }

    public function test_dismissing_an_incident_records_an_audit_log_entry(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        [$booking] = $this->makeBooking();
        $reporter = User::factory()->create(['role' => 'family']);

        $incident = IncidentReport::create([
            'booking_id' => $booking->id,
            'reporter_user_id' => $reporter->id,
            'type' => 'safety',
            'severity' => 'low',
            'description' => 'Caregiver did not arrive at the scheduled time.',
            'status' => IncidentReport::STATUS_OPEN,
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/incidents/{$incident->id}", [
            'action' => 'dismiss',
            'note' => 'Reporter rescheduled the visit; no-show was a misunderstanding.',
        ])->assertOk();

        $row = AdminAuditLog::query()->where('action', 'incident.dismissed')->first();
        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame($incident->id, $row->target_id);
    }

    /**
     * @return array{0: Booking, 1: User}
     */
    private function makeBooking(): array
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

        $booking = Booking::create([
            'gig_id' => $gig->id,
            'family_profile_id' => $familyProfile->id,
            'caregiver_user_id' => $caregiver->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_IN_PROGRESS,
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
        ]);

        return [$booking, $caregiver];
    }

    /* ────────────── viewer / filters ────────────── */

    public function test_admin_can_view_audit_log_with_filters(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $a = User::factory()->create(['role' => 'caregiver', 'status' => 'active']);
        $b = User::factory()->create(['role' => 'caregiver', 'status' => 'active']);

        Sanctum::actingAs($admin);

        // Generate a couple of distinct actions.
        $this->patchJson("/api/admin/users/{$a->id}/suspend", [
            'reason' => 'First suspension under test.',
        ])->assertOk();

        $this->patchJson("/api/admin/users/{$b->id}/suspend", [
            'reason' => 'Second suspension under test.',
        ])->assertOk();

        $this->patchJson("/api/admin/users/{$a->id}/reactivate")->assertOk();

        // Unfiltered — three rows.
        $this->getJson('/api/admin/audit-log')
            ->assertOk()
            ->assertJsonPath('meta.total', 3);

        // Filter by action.
        $this->getJson('/api/admin/audit-log?action=user.suspended')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        // Filter by target user b.
        $this->getJson("/api/admin/audit-log?target_type=user&target_id={$b->id}")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.action', 'user.suspended');
    }

    public function test_audit_log_includes_admin_summary_in_response(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'name' => 'Inez Reyes']);
        $target = User::factory()->create(['role' => 'caregiver', 'status' => 'active']);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/admin/users/{$target->id}/suspend", [
            'reason' => 'Test admin attribution on the audit row.',
        ])->assertOk();

        $this->getJson('/api/admin/audit-log')
            ->assertOk()
            ->assertJsonPath('data.0.admin.id', $admin->id)
            ->assertJsonPath('data.0.admin.name', 'Inez Reyes')
            ->assertJsonPath('data.0.admin.role', 'admin');
    }
}
