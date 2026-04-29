<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Legacy resource from the demand-driven model — the /jobs caregiver
 * feed no longer exists. We keep this class only because BookingService
 * uses the static `haversineKm()` helper for EVV distance checks. The
 * `toArray()` shape is intentionally minimal so static analysis stops
 * complaining about Gig fields that no longer exist.
 *
 * Follow-up: extract `haversineKm` into a dedicated `Geo` utility and
 * drop this file entirely.
 */
class CaregiverGigResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [];
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
