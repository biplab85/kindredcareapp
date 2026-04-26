<?php

namespace App\Http\Resources;

use App\Models\BookingDispute;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin BookingDispute
 */
class BookingDisputeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'reporter_user_id' => $this->reporter_user_id,
            'reason_code' => $this->reason_code,
            'description' => $this->description,
            'evidence_paths' => $this->evidence_paths ?? [],
            'status' => $this->status,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_code' => $this->resolution_code,
            'resolution_refund_cents' => $this->resolution_refund_cents,
            'resolution_note' => $this->resolution_note,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
