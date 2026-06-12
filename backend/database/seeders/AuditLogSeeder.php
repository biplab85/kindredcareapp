<?php

namespace Database\Seeders;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Sample admin audit-log entries so the trail has data across action tones
 * (suspensions, reactivations, panic + incident triage, refunds).
 *
 * Guarded: only seeds when the table is empty, so re-running never duplicates
 * and never disturbs genuine entries appended by real admin actions.
 */
class AuditLogSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@kindredcare.ca')->first();
        if (! $admin) {
            $this->command->warn('admin@kindredcare.ca not found — run TestUsersSeeder first. Nothing seeded.');

            return;
        }

        if (AdminAuditLog::count() > 0) {
            return;
        }

        $targetUserId = User::where('email', 'caregiver1@kindredcare.ca')->value('id') ?? $admin->id;
        $bookingId = Booking::orderBy('id')->value('id');
        $resolvedPanicId = PanicAlert::where('status', 'resolved')->value('id')
            ?? PanicAlert::orderBy('id')->value('id');
        $ackPanicId = PanicAlert::where('status', 'acknowledged')->value('id')
            ?? $resolvedPanicId;
        $resolvedIncidentId = IncidentReport::where('status', 'resolved')->value('id')
            ?? IncidentReport::orderBy('id')->value('id');
        $dismissedIncidentId = IncidentReport::where('status', 'dismissed')->value('id')
            ?? $resolvedIncidentId;
        $assignedIncidentId = IncidentReport::where('status', 'investigating')->value('id')
            ?? $resolvedIncidentId;

        $now = Carbon::now();

        $entries = [
            [
                'action' => 'panic.resolved',
                'target_type' => AdminAuditLog::TARGET_PANIC_ALERT,
                'target_id' => $resolvedPanicId,
                'reason' => 'Reached the caregiver by phone within two minutes. False alarm — phone triggered in pocket. Confirmed both client and caregiver safe.',
                'metadata' => ['channel' => 'phone', 'response_seconds' => 110],
                'created_at' => $now->copy()->subHours(4),
            ],
            [
                'action' => 'panic.acknowledged',
                'target_type' => AdminAuditLog::TARGET_PANIC_ALERT,
                'target_id' => $ackPanicId,
                'reason' => null,
                'metadata' => null,
                'created_at' => $now->copy()->subMinutes(45),
            ],
            [
                'action' => 'incident.assigned',
                'target_type' => AdminAuditLog::TARGET_INCIDENT_REPORT,
                'target_id' => $assignedIncidentId,
                'reason' => null,
                'metadata' => ['assignee_user_id' => $admin->id],
                'created_at' => $now->copy()->subHours(3),
            ],
            [
                'action' => 'incident.resolved',
                'target_type' => AdminAuditLog::TARGET_INCIDENT_REPORT,
                'target_id' => $resolvedIncidentId,
                'reason' => 'Spoke with the caregiver — transit delay. Reminder sent about the 10-minute heads-up rule. Family satisfied.',
                'metadata' => null,
                'created_at' => $now->copy()->subDay(),
            ],
            [
                'action' => 'incident.dismissed',
                'target_type' => AdminAuditLog::TARGET_INCIDENT_REPORT,
                'target_id' => $dismissedIncidentId,
                'reason' => 'Reviewed check-in/out notes and spoke with both parties. No evidence of mishandling; reporter retracted after clarification.',
                'metadata' => null,
                'created_at' => $now->copy()->subHours(20),
            ],
            [
                'action' => 'user.suspended',
                'target_type' => AdminAuditLog::TARGET_USER,
                'target_id' => $targetUserId,
                'reason' => 'Repeated no-shows on confirmed bookings after two written warnings.',
                'metadata' => ['previous_status' => 'active', 'warnings' => 2],
                'created_at' => $now->copy()->subDays(2),
            ],
            [
                'action' => 'user.reactivated',
                'target_type' => AdminAuditLog::TARGET_USER,
                'target_id' => $targetUserId,
                'reason' => 'Appeal upheld — documented medical emergency. Account restored to good standing.',
                'metadata' => ['previous_status' => 'suspended'],
                'created_at' => $now->copy()->subDays(1),
            ],
            [
                'action' => 'booking.refunded',
                'target_type' => AdminAuditLog::TARGET_BOOKING,
                'target_id' => $bookingId,
                'reason' => 'No-show confirmed via GPS log. Refunded in full per policy.',
                'metadata' => ['amount_cents' => 4730, 'mode' => 'full'],
                'created_at' => $now->copy()->subDays(3),
            ],
        ];

        foreach ($entries as $e) {
            // Skip entries whose target couldn't be resolved (e.g. no bookings).
            if ($e['target_id'] === null) {
                continue;
            }
            AdminAuditLog::create(array_merge($e, ['admin_user_id' => $admin->id]));
        }

        $this->command->info('Seeded '.count($entries).' audit-log entries.');
    }
}
