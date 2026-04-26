<?php

namespace App\Http\Resources;

use App\Models\Booking;
use App\Models\Gig;
use App\Models\PanicAlert;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin Booking
 *
 * Shape differs slightly by viewer:
 * - Family sees caregiver contact summary + full address + fallback queue length.
 * - Caregiver sees family/care-recipient names but only the full address once
 *   the booking is confirmed (otherwise just the neighbourhood).
 */
class BookingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $viewer */
        $viewer = $request->user();
        $isCaregiver = $viewer !== null && $viewer->id === $this->caregiver_user_id;
        $revealAddress = $this->shouldRevealAddress($isCaregiver);

        return [
            'id' => $this->id,
            'gig_id' => $this->gig_id,
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'match_rank' => $this->match_rank,
            'fallback_queue_size' => count($this->fallback_queue ?? []),
            'scheduled_start' => $this->scheduled_start->toIso8601String(),
            'scheduled_end' => $this->scheduled_end->toIso8601String(),
            'response_deadline_at' => $this->response_deadline_at->toIso8601String(),
            'is_expired' => $this->isExpired(),
            'responded_at' => $this->responded_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancelled_by' => $this->cancelled_by,
            'cancellation_reason' => $this->cancellation_reason,
            'duration_minutes' => $this->duration_minutes,
            'hourly_rate_cents' => $this->hourly_rate_cents,
            'subtotal_cents' => $this->subtotal_cents,
            'platform_fee_cents' => $this->platform_fee_cents,
            'caregiver_payout_cents' => $this->caregiver_payout_cents,
            'address_neighbourhood' => $this->address_neighbourhood,
            'address_full' => $revealAddress ? $this->address_full : null,
            'caregiver' => $this->caregiverCard(),
            'gig' => $this->whenLoaded('gig', fn () => $this->gigCard()),
            'visit' => $this->visitBlock($isCaregiver),
            'safety_acknowledged_at' => $this->safety_acknowledged_at?->toIso8601String(),
            'active_panic_alert' => $this->activePanicAlert(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * EVV / visit summary block. Always present but most fields are null
     * until check-in. Raw lat/lng only exposed to the caregiver themselves
     * (the family sees distance-from-gig, not exact coordinates).
     *
     * @return array<string, mixed>
     */
    private function visitBlock(bool $isCaregiver): array
    {
        return [
            'check_in_at' => $this->check_in_at?->toIso8601String(),
            'check_in_distance_m' => $this->check_in_distance_m,
            'check_in_lat' => $isCaregiver ? ($this->check_in_lat !== null ? (float) $this->check_in_lat : null) : null,
            'check_in_lng' => $isCaregiver ? ($this->check_in_lng !== null ? (float) $this->check_in_lng : null) : null,
            'check_out_at' => $this->check_out_at?->toIso8601String(),
            'check_out_distance_m' => $this->check_out_distance_m,
            'check_out_lat' => $isCaregiver ? ($this->check_out_lat !== null ? (float) $this->check_out_lat : null) : null,
            'check_out_lng' => $isCaregiver ? ($this->check_out_lng !== null ? (float) $this->check_out_lng : null) : null,
            'tasks_completed' => $this->tasks_completed ?? [],
            'caregiver_notes' => $this->caregiver_notes,
            'is_flagged' => $this->isFlagged(),
            'flag_reasons' => $this->flag_reasons ?? [],
        ];
    }

    /**
     * Compact snapshot of the booking's open panic alert, if any. Populated
     * only when `panicAlerts` has been eager-loaded so the resource stays
     * cheap for list endpoints. Returns null when no active/acknowledged
     * alert exists.
     *
     * @return array<string, mixed>|null
     */
    private function activePanicAlert(): ?array
    {
        if (! $this->relationLoaded('panicAlerts')) {
            return null;
        }

        /** @var PanicAlert|null $alert */
        $alert = $this->panicAlerts
            ->whereIn('status', PanicAlert::OPEN_STATUSES)
            ->sortByDesc('triggered_at')
            ->first();

        if ($alert === null) {
            return null;
        }

        return [
            'id' => $alert->id,
            'triggered_at' => $alert->triggered_at->toIso8601String(),
            'silent' => (bool) $alert->silent,
            'status' => $alert->status,
            'acknowledged_at' => $alert->acknowledged_at?->toIso8601String(),
        ];
    }

    private function shouldRevealAddress(bool $isCaregiver): bool
    {
        if (! $isCaregiver) {
            return true; // family always sees their own address
        }

        // Caregiver only sees the full address once confirmed — per the
        // Phase 5 caregiver-facing gig detail page, which promised the
        // address would be revealed "on booking".
        return in_array($this->status, [
            Booking::STATUS_CONFIRMED,
            Booking::STATUS_IN_PROGRESS,
            Booking::STATUS_COMPLETED,
        ], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function caregiverCard(): array
    {
        $caregiver = $this->caregiver;
        $profile = $caregiver->caregiverProfile;

        return [
            'id' => $caregiver->id,
            'name' => $caregiver->name,
            'photo_url' => $profile?->photo_path
                ? Storage::disk('public')->url($profile->photo_path)
                : null,
            'hourly_rate' => $profile ? (float) $profile->hourly_rate : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function gigCard(): array
    {
        /** @var Gig $gig */
        $gig = $this->gig;

        return [
            'id' => $gig->id,
            'description' => $gig->description,
            'latitude' => (float) $gig->latitude,
            'longitude' => (float) $gig->longitude,
            'service_category' => $gig->relationLoaded('serviceCategory')
                ? [
                    'id' => $gig->serviceCategory->id,
                    'name' => $gig->serviceCategory->name,
                    'slug' => $gig->serviceCategory->slug,
                    'default_tasks' => $gig->serviceCategory->default_tasks ?? [],
                ]
                : null,
        ];
    }
}
