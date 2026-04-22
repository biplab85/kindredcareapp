<?php

namespace App\Http\Resources;

use App\Models\Gig;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A redacted view of a Gig for caregivers browsing the feed. The exact
 * street address is replaced with a neighbourhood label, and family/photo
 * details are omitted until a booking is accepted.
 *
 * @mixin Gig
 */
class CaregiverGigResource extends JsonResource
{
    /** Durham Region neighbourhood centres — must match the /gigs/new picker. */
    private const NEIGHBOURHOODS = [
        ['slug' => 'oshawa', 'name' => 'Oshawa', 'lat' => 43.8975, 'lng' => -78.8658],
        ['slug' => 'whitby', 'name' => 'Whitby', 'lat' => 43.8975, 'lng' => -78.9428],
        ['slug' => 'ajax', 'name' => 'Ajax', 'lat' => 43.8509, 'lng' => -79.0204],
        ['slug' => 'pickering', 'name' => 'Pickering', 'lat' => 43.8384, 'lng' => -79.0868],
        ['slug' => 'clarington', 'name' => 'Clarington', 'lat' => 43.9121, 'lng' => -78.6878],
    ];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'description' => $this->description,
            'neighbourhood' => self::nearestNeighbourhood($this->latitude, $this->longitude),
            'scheduled_start' => $this->scheduled_start->toIso8601String(),
            'scheduled_end' => $this->scheduled_end->toIso8601String(),
            'is_recurring' => $this->is_recurring,
            'recurrence_pattern' => $this->recurrence_pattern,
            'preferences' => $this->preferences ?? [],
            'service_category' => $this->whenLoaded(
                'serviceCategory',
                fn () => new ServiceCategoryResource($this->serviceCategory),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Snap arbitrary coordinates to the nearest named Durham Region community.
     *
     * @return array{slug: string, name: string, label: string}
     */
    public static function nearestNeighbourhood(float $lat, float $lng): array
    {
        $best = null;
        $bestDistance = PHP_FLOAT_MAX;

        foreach (self::NEIGHBOURHOODS as $n) {
            $distance = self::haversineKm($lat, $lng, $n['lat'], $n['lng']);
            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $n;
            }
        }

        // Fallback — shouldn't hit in practice since NEIGHBOURHOODS is non-empty.
        $best ??= self::NEIGHBOURHOODS[0];

        return [
            'slug' => $best['slug'],
            'name' => $best['name'],
            'label' => "Near {$best['name']}",
        ];
    }

    public static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthKm = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthKm * $c;
    }
}
