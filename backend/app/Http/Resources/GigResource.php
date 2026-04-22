<?php

namespace App\Http\Resources;

use App\Models\Gig;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin Gig
 */
class GigResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'posting_mode' => $this->posting_mode,
            'description' => $this->description,
            'location_address' => $this->location_address,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'scheduled_start' => $this->scheduled_start->toIso8601String(),
            'scheduled_end' => $this->scheduled_end->toIso8601String(),
            'is_recurring' => $this->is_recurring,
            'recurrence_pattern' => $this->recurrence_pattern,
            'preferences' => $this->preferences ?? [],
            'photo_url' => $this->photo_path ? Storage::disk('public')->url($this->photo_path) : null,
            'service_category' => $this->whenLoaded(
                'serviceCategory',
                fn () => new ServiceCategoryResource($this->serviceCategory),
            ),
            'care_recipient' => $this->whenLoaded(
                'careRecipient',
                fn () => $this->careRecipient ? [
                    'id' => $this->careRecipient->id,
                    'name' => $this->careRecipient->name,
                ] : null,
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
