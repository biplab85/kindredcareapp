<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Sample panic alerts + incident reports so the admin Safety queue has data
 * across every status (active / acknowledged / resolved panics; open /
 * investigating / resolved / dismissed incidents).
 *
 * Guarded: only seeds when each table is empty, so re-running never
 * duplicates and never touches genuine alerts created through the app.
 * Alerts attach to caregiver1's existing bookings; family1 reports incidents.
 */
class SafetySeeder extends Seeder
{
    public function run(): void
    {
        $caregiver = User::where('email', 'caregiver1@kindredcare.ca')->first();
        $family = User::where('email', 'family1@kindredcare.ca')->first();
        $admin = User::where('email', 'admin@kindredcare.ca')->first();

        if (! $caregiver || ! $family) {
            $this->command->warn('Seed users missing — run TestUsersSeeder first. Nothing seeded.');

            return;
        }

        $bookings = Booking::where('caregiver_user_id', $caregiver->id)
            ->orderBy('id')
            ->take(6)
            ->get();

        if ($bookings->isEmpty()) {
            $this->command->warn('No bookings for caregiver1 — run DevBookingsSeeder first. Nothing seeded.');

            return;
        }

        // Cycle through available bookings so each alert maps to a real one.
        $bookingId = fn (int $i): int => $bookings[$i % $bookings->count()]->id;

        $now = Carbon::now();
        $adminId = $admin?->id;

        // ──────── Panic alerts ────────
        if (PanicAlert::count() === 0) {
            $panics = [
                // Active, audible, with GPS — the top-priority card.
                [
                    'booking_id' => $bookingId(0),
                    'caregiver_user_id' => $caregiver->id,
                    'triggered_at' => $now->copy()->subMinutes(8),
                    'gps_lat' => 43.8975,
                    'gps_lng' => -78.8658,
                    'silent' => false,
                    'status' => PanicAlert::STATUS_ACTIVE,
                ],
                // Active, silent, GPS denied.
                [
                    'booking_id' => $bookingId(1),
                    'caregiver_user_id' => $caregiver->id,
                    'triggered_at' => $now->copy()->subMinutes(26),
                    'gps_lat' => null,
                    'gps_lng' => null,
                    'silent' => true,
                    'status' => PanicAlert::STATUS_ACTIVE,
                ],
                // Acknowledged, awaiting resolution.
                [
                    'booking_id' => $bookingId(2),
                    'caregiver_user_id' => $caregiver->id,
                    'triggered_at' => $now->copy()->subMinutes(52),
                    'gps_lat' => 43.9012,
                    'gps_lng' => -78.8497,
                    'silent' => false,
                    'status' => PanicAlert::STATUS_ACKNOWLEDGED,
                    'acknowledged_by' => $adminId,
                    'acknowledged_at' => $now->copy()->subMinutes(45),
                ],
                // Resolved — lives in the Resolved tab with a note.
                [
                    'booking_id' => $bookingId(3),
                    'caregiver_user_id' => $caregiver->id,
                    'triggered_at' => $now->copy()->subHours(5),
                    'gps_lat' => 43.8853,
                    'gps_lng' => -78.9426,
                    'silent' => false,
                    'status' => PanicAlert::STATUS_RESOLVED,
                    'acknowledged_by' => $adminId,
                    'acknowledged_at' => $now->copy()->subHours(5)->addMinutes(2),
                    'resolved_by' => $adminId,
                    'resolved_at' => $now->copy()->subHours(4),
                    'resolution_note' => 'Reached the caregiver by phone within two minutes. False alarm — phone triggered in pocket. Confirmed both client and caregiver safe.',
                ],
            ];

            foreach ($panics as $p) {
                PanicAlert::create($p);
            }
            $this->command->info('Seeded '.count($panics).' panic alerts.');
        }

        // ──────── Incident reports ────────
        if (IncidentReport::count() === 0) {
            $incidents = [
                // Critical, open — the highlighted card.
                [
                    'booking_id' => $bookingId(0),
                    'reporter_user_id' => $family->id,
                    'type' => IncidentReport::TYPE_SAFETY,
                    'severity' => IncidentReport::SEVERITY_CRITICAL,
                    'description' => 'Caregiver reported that my mother had a fall in the bathroom during the visit. She is conscious and responsive but complaining of hip pain. Paramedics were called and she was taken to Lakeridge Health for assessment. I need someone from the platform to follow up urgently and confirm what happened.',
                    'status' => IncidentReport::STATUS_OPEN,
                ],
                // High, open.
                [
                    'booking_id' => $bookingId(1),
                    'reporter_user_id' => $family->id,
                    'type' => IncidentReport::TYPE_SCOPE_VIOLATION,
                    'severity' => IncidentReport::SEVERITY_HIGH,
                    'description' => 'Caregiver administered medication despite our profile clearly stating non-medical services only. Please review.',
                    'status' => IncidentReport::STATUS_OPEN,
                ],
                // Medium, investigating, assigned.
                [
                    'booking_id' => $bookingId(2),
                    'reporter_user_id' => $family->id,
                    'type' => IncidentReport::TYPE_PROPERTY_DAMAGE,
                    'severity' => IncidentReport::SEVERITY_MEDIUM,
                    'description' => 'A ceramic vase in the living room was broken during the visit. Caregiver mentioned it but we would like it documented.',
                    'status' => IncidentReport::STATUS_INVESTIGATING,
                    'assigned_to' => $adminId,
                    'assigned_at' => $now->copy()->subHours(3),
                ],
                // Low, resolved — Resolved tab.
                [
                    'booking_id' => $bookingId(3),
                    'reporter_user_id' => $family->id,
                    'type' => IncidentReport::TYPE_OTHER,
                    'severity' => IncidentReport::SEVERITY_LOW,
                    'description' => 'Caregiver arrived about 15 minutes late without notice.',
                    'status' => IncidentReport::STATUS_RESOLVED,
                    'assigned_to' => $adminId,
                    'resolved_by' => $adminId,
                    'resolved_at' => $now->copy()->subDay(),
                    'resolution_note' => 'Spoke with the caregiver — transit delay. Reminder sent about the 10-minute heads-up rule. Family satisfied.',
                ],
                // Medium, dismissed — Resolved tab.
                [
                    'booking_id' => $bookingId(4),
                    'reporter_user_id' => $family->id,
                    'type' => IncidentReport::TYPE_ABUSE,
                    'severity' => IncidentReport::SEVERITY_MEDIUM,
                    'description' => 'Initial concern about rough handling during transfer.',
                    'status' => IncidentReport::STATUS_DISMISSED,
                    'assigned_to' => $adminId,
                    'resolved_by' => $adminId,
                    'resolved_at' => $now->copy()->subHours(20),
                    'resolution_note' => 'Reviewed check-in/out notes and spoke with both parties. No evidence of mishandling; reporter retracted after clarification. Dismissed.',
                ],
            ];

            foreach ($incidents as $i) {
                IncidentReport::create($i);
            }
            $this->command->info('Seeded '.count($incidents).' incident reports.');
        }
    }
}
