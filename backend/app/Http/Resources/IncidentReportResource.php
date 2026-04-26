<?php

namespace App\Http\Resources;

use App\Models\IncidentReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin IncidentReport
 */
class IncidentReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'type' => $this->type,
            'severity' => $this->severity,
            'description' => $this->description,
            'evidence_paths' => $this->evidence_paths ?? [],
            'status' => $this->status,
            'reporter' => [
                'id' => $this->reporter_user_id,
                'name' => $this->relationLoaded('reporter') ? $this->reporter->name : null,
            ],
            'assigned_to' => $this->assigned_to,
            'assigned_at' => $this->assigned_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_note' => $this->resolution_note,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
