<?php

namespace App\Http\Resources;

use App\Models\CaregiverProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * A single ranked caregiver match. The underlying `resource` is the raw
 * array built by MatchingEngine::scoreCandidate(), not an Eloquent model.
 *
 * @property array{
 *   profile: CaregiverProfile,
 *   distance_km: float,
 *   match_score: int,
 *   match_components: array<string, int>,
 *   trust_components: array<string, int>,
 *   trust_is_new: bool
 * } $resource
 */
class CaregiverMatchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $profile = $this->resource['profile'];
        $user = $profile->user;

        return [
            'id' => $profile->id,
            'user_id' => $user->id,
            'display_name' => $user->name,
            'photo_url' => $this->resolvePhotoUrl($profile->photo_path),
            'bio' => $profile->bio,
            'hourly_rate' => (float) $profile->hourly_rate,
            'years_of_experience' => (int) ($profile->years_of_experience ?? 0),
            'languages' => $profile->languages ?? [],
            'interests' => $profile->interests ?? [],
            'travel_radius_km' => (int) $profile->travel_radius_km,
            'distance_km' => $this->resource['distance_km'],
            'match_score' => $this->resource['match_score'],
            'match_components' => $this->resource['match_components'],
            'trust_score' => $this->composeTrust(),
            'trust_is_new' => $this->resource['trust_is_new'],
        ];
    }

    private function composeTrust(): int
    {
        // Mirror TrustScoreCalculator weights here so the resource carries
        // the final integer without the caller needing the service again.
        $c = $this->resource['trust_components'];
        $weighted = $c['verification'] * 40 + $c['reviews'] * 30 + $c['reliability'] * 20 + $c['tenure'] * 10;

        return (int) round($weighted / 100);
    }

    /**
     * Pass through fully-qualified URLs (seeded placeholders) and resolve
     * relative paths through the public disk (uploaded files).
     */
    private function resolvePhotoUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return Storage::disk('public')->url($path);
    }
}
