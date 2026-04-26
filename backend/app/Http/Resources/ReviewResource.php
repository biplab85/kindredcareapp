<?php

namespace App\Http\Resources;

use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Review
 */
class ReviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'stars' => $this->stars,
            'body' => $this->body,
            'submitted_at' => $this->submitted_at->toIso8601String(),
            'visible_at' => $this->visible_at?->toIso8601String(),
            'is_visible' => $this->isVisible(),
            'flagged_at' => $this->flagged_at?->toIso8601String(),
            'hidden_at' => $this->hidden_at?->toIso8601String(),
            'rater' => [
                'id' => $this->rater_user_id,
                'name' => $this->relationLoaded('rater') ? $this->rater->name : null,
            ],
            'ratee' => [
                'id' => $this->ratee_user_id,
            ],
        ];
    }
}
