<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\User;
use App\Notifications\IncidentReported;
use App\Notifications\PanicTriggered;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Illuminate\Validation\ValidationException;

/**
 * Central service for the Phase 13 safety layer: panic alerts, incident
 * reports, and pre-visit safety acknowledgement.
 *
 * All admin-user notifications fan out via NotificationFacade::send so a
 * single trigger reaches every active admin at once (mail + database).
 * SMS/push fan-out lands in Phase 12; for now the admin database inbox is
 * the primary channel and mail is the backup.
 */
class SafetyService
{
    /**
     * Caregiver taps the panic button during an active visit. GPS coords
     * are optional — denied permission still lets the alert through because
     * the caregiver might not have time to grant location.
     *
     * @throws ValidationException
     */
    public function triggerPanic(
        Booking $booking,
        User $caregiver,
        ?float $lat,
        ?float $lng,
        bool $silent,
    ): PanicAlert {
        if ($caregiver->id !== $booking->caregiver_user_id) {
            throw ValidationException::withMessages([
                'caregiver' => 'Only the caregiver on this booking can trigger a panic alert.',
            ]);
        }

        // Active visit OR confirmed-before-check-in both qualify — if the
        // caregiver arrived at an unsafe doorstep before tapping Start
        // Visit they still need help.
        if (! in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_IN_PROGRESS], true)) {
            throw ValidationException::withMessages([
                'status' => 'Panic alerts are only available for confirmed or in-progress visits.',
            ]);
        }

        return DB::transaction(function () use ($booking, $caregiver, $lat, $lng, $silent) {
            /** @var PanicAlert $alert */
            $alert = PanicAlert::create([
                'booking_id' => $booking->id,
                'caregiver_user_id' => $caregiver->id,
                'triggered_at' => now(),
                'gps_lat' => $lat,
                'gps_lng' => $lng,
                'silent' => $silent,
                'status' => PanicAlert::STATUS_ACTIVE,
            ]);

            $this->notifyAdmins(new PanicTriggered($alert->load('caregiver')));

            return $alert;
        });
    }

    public function acknowledgePanic(PanicAlert $alert, User $admin): PanicAlert
    {
        $this->assertAdmin($admin);

        if ($alert->status !== PanicAlert::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'status' => 'This alert has already been acknowledged or resolved.',
            ]);
        }

        $alert->update([
            'status' => PanicAlert::STATUS_ACKNOWLEDGED,
            'acknowledged_by' => $admin->id,
            'acknowledged_at' => now(),
        ]);

        return $alert->fresh();
    }

    public function resolvePanic(PanicAlert $alert, User $admin, ?string $note = null): PanicAlert
    {
        $this->assertAdmin($admin);

        if ($alert->status === PanicAlert::STATUS_RESOLVED) {
            throw ValidationException::withMessages([
                'status' => 'This alert is already resolved.',
            ]);
        }

        $alert->update([
            'status' => PanicAlert::STATUS_RESOLVED,
            'resolved_by' => $admin->id,
            'resolved_at' => now(),
            'resolution_note' => $note,
        ]);

        return $alert->fresh();
    }

    /**
     * Either party on the booking can file an incident report (caregiver
     * safety + family property-damage/abuse concerns both flow through
     * the same table).
     *
     * @param  array<int, string>  $evidencePaths
     *
     * @throws ValidationException
     */
    public function submitIncident(
        Booking $booking,
        User $reporter,
        string $type,
        string $severity,
        string $description,
        array $evidencePaths = [],
    ): IncidentReport {
        $this->assertBookingParty($booking, $reporter);

        if (! in_array($type, IncidentReport::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Unknown incident type.']);
        }

        if (! in_array($severity, IncidentReport::SEVERITIES, true)) {
            throw ValidationException::withMessages(['severity' => 'Unknown severity level.']);
        }

        return DB::transaction(function () use ($booking, $reporter, $type, $severity, $description, $evidencePaths) {
            /** @var IncidentReport $incident */
            $incident = IncidentReport::create([
                'booking_id' => $booking->id,
                'reporter_user_id' => $reporter->id,
                'type' => $type,
                'severity' => $severity,
                'description' => $description,
                'evidence_paths' => $evidencePaths === [] ? null : $evidencePaths,
                'status' => IncidentReport::STATUS_OPEN,
            ]);

            $this->notifyAdmins(new IncidentReported($incident->load('reporter')));

            return $incident;
        });
    }

    /**
     * Caregiver confirms they feel safe proceeding with the visit. Called
     * from the pre-check-in safety checklist. Sets safety_acknowledged_at
     * so the visit timeline has an audit trail.
     *
     * @throws ValidationException
     */
    public function acknowledgeSafety(Booking $booking, User $caregiver): Booking
    {
        if ($caregiver->id !== $booking->caregiver_user_id) {
            throw ValidationException::withMessages([
                'caregiver' => 'Only the caregiver can acknowledge safety for this booking.',
            ]);
        }

        if ($booking->status !== Booking::STATUS_CONFIRMED) {
            throw ValidationException::withMessages([
                'status' => 'Safety acknowledgement only applies before check-in.',
            ]);
        }

        $booking->update(['safety_acknowledged_at' => now()]);

        return $booking->fresh();
    }

    public function assignIncident(IncidentReport $incident, User $admin, User $assignee): IncidentReport
    {
        $this->assertAdmin($admin);

        if (! $assignee->isAdmin()) {
            throw ValidationException::withMessages([
                'assignee' => 'Incidents can only be assigned to admin users.',
            ]);
        }

        $incident->update([
            'assigned_to' => $assignee->id,
            'assigned_at' => now(),
            'status' => $incident->status === IncidentReport::STATUS_OPEN
                ? IncidentReport::STATUS_INVESTIGATING
                : $incident->status,
        ]);

        return $incident->fresh();
    }

    public function resolveIncident(
        IncidentReport $incident,
        User $admin,
        string $status,
        ?string $note = null,
    ): IncidentReport {
        $this->assertAdmin($admin);

        if (! in_array($status, [IncidentReport::STATUS_RESOLVED, IncidentReport::STATUS_DISMISSED], true)) {
            throw ValidationException::withMessages([
                'status' => 'Resolution requires status of resolved or dismissed.',
            ]);
        }

        $incident->update([
            'status' => $status,
            'resolved_by' => $admin->id,
            'resolved_at' => now(),
            'resolution_note' => $note,
        ]);

        return $incident->fresh();
    }

    /* ──────────── helpers ──────────── */

    private function notifyAdmins(object $notification): void
    {
        $admins = User::query()->where('role', 'admin')->get();

        if ($admins->isEmpty()) {
            return;
        }

        NotificationFacade::send($admins, $notification);
    }

    private function assertAdmin(User $user): void
    {
        if (! $user->isAdmin()) {
            throw ValidationException::withMessages([
                'status' => 'Admin-only action.',
            ]);
        }
    }

    private function assertBookingParty(Booking $booking, User $user): void
    {
        $isCaregiver = $user->id === $booking->caregiver_user_id;
        $familyProfile = $user->familyProfile;
        $isFamily = $familyProfile !== null && $familyProfile->id === $booking->family_profile_id;

        if (! $isCaregiver && ! $isFamily) {
            throw ValidationException::withMessages([
                'reporter' => 'You are not a party to this booking.',
            ]);
        }
    }
}
