<?php

namespace App\Http\Resources;

use App\Models\PanicAlert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PanicAlert
 */
class PanicAlertResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'caregiver' => [
                'id' => $this->caregiver_user_id,
                'name' => $this->relationLoaded('caregiver') ? $this->caregiver->name : null,
            ],
            'triggered_at' => $this->triggered_at->toIso8601String(),
            'gps_lat' => $this->gps_lat,
            'gps_lng' => $this->gps_lng,
            'silent' => $this->silent,
            'status' => $this->status,
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_note' => $this->resolution_note,
        ];
    }
}
