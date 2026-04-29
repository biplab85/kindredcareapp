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
            'title' => $this->title,
            'status' => $this->status,
            'description' => $this->description,
            'tasks_included' => $this->tasks_included ?? [],
            'hourly_rate_cents' => (int) $this->hourly_rate_cents,
            'hourly_rate_dollars' => round($this->hourly_rate_cents / 100, 2),
            'photo_url' => $this->photo_path ? Storage::disk('public')->url($this->photo_path) : null,
            'published_at' => $this->published_at?->toIso8601String(),
            'service_category' => $this->whenLoaded(
                'serviceCategory',
                fn () => new ServiceCategoryResource($this->serviceCategory),
            ),
            'caregiver' => $this->whenLoaded(
                'caregiverProfile',
                fn () => $this->shapeCaregiver(),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Caregiver summary that the family marketplace card needs — name,
     * photo, headline-y signals. Full profile lives at /caregivers/{id}.
     *
     * @return array<string, mixed>
     */
    private function shapeCaregiver(): array
    {
        $profile = $this->caregiverProfile;
        $user = $profile->user;

        return [
            'user_id' => $user?->id,
            'profile_id' => $profile->id,
            'display_name' => $user?->name,
            'photo_url' => $profile->photo_path
                ? Storage::disk('public')->url($profile->photo_path)
                : null,
            'years_of_experience' => $profile->years_of_experience,
            'languages' => $profile->languages ?? [],
            // The booking page uses this to soft-warn when the family's
            // requested window falls outside the caregiver's published hours.
            // The matcher reads the same shape (`weekly.{day}` = array of
            // {start, end}); empty/null means "always available".
            'availability' => $profile->availability ?? null,
        ];
    }
}
