<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CaregiverProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Phase 14.4 follow-up — text-based "where is demand happening" view
 * that admins can use to plan caregiver acquisition without a Mapbox
 * subscription. Reports per-neighbourhood booking volume and per-area
 * caregiver density (postal-code prefix as the geo bucket).
 *
 * The full Mapbox heatmap is deferred to v1.1 — this view answers the
 * same operational question (is supply matching demand?) using the
 * same data we'd plot but in a sortable list shape.
 */
class DemandDensityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'days' => ['sometimes', 'integer', 'min:1', 'max:365'],
        ]);

        $days = (int) ($request->query('days') ?? 30);
        $since = now()->subDays($days);

        // Demand: completed + in-flight bookings grouped by neighbourhood.
        // Aggregate columns aren't on the Booking model, so we drop to the
        // query builder so PHPStan sees the right shape.
        $demand = DB::table('bookings')
            ->whereNotNull('address_neighbourhood')
            ->where('scheduled_start', '>=', $since)
            ->selectRaw('address_neighbourhood as area, COUNT(*) as bookings, SUM(subtotal_cents) as gmv_cents')
            ->groupBy('address_neighbourhood')
            ->orderByDesc('bookings')
            ->limit(50)
            ->get();

        // Supply: caregivers grouped by postal-code prefix (FSA — first 3
        // chars of the Canadian postal code). FSA maps roughly to a
        // sortation area / neighbourhood.
        $caregivers = CaregiverProfile::query()
            ->whereHas('user', fn ($q) => $q->where('role', 'caregiver')->where('status', 'active'))
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get(['id', 'latitude', 'longitude']);

        // Latitude/longitude bucketing — round to 2 decimals (~1.1km grid).
        // Phase 14 uses lat/lng instead of postal code because the
        // CaregiverProfile model doesn't carry a postal field.
        $supplyBuckets = [];
        foreach ($caregivers as $profile) {
            $key = sprintf(
                '%.2f,%.2f',
                round((float) $profile->latitude, 2),
                round((float) $profile->longitude, 2),
            );
            $supplyBuckets[$key] = ($supplyBuckets[$key] ?? 0) + 1;
        }
        arsort($supplyBuckets);
        $supply = [];
        foreach (array_slice($supplyBuckets, 0, 50, true) as $bucket => $count) {
            [$lat, $lng] = explode(',', $bucket);
            $supply[] = [
                'bucket' => $bucket,
                'lat' => (float) $lat,
                'lng' => (float) $lng,
                'caregivers' => $count,
            ];
        }

        return response()->json([
            'data' => [
                'window_days' => $days,
                'since' => $since->toIso8601String(),
                'demand' => $demand->map(fn (object $row) => [
                    'area' => (string) $row->area,
                    'bookings' => (int) $row->bookings,
                    'gmv_cents' => (int) $row->gmv_cents,
                ]),
                'supply' => $supply,
                'totals' => [
                    'demand_areas' => $demand->count(),
                    'supply_buckets' => count($supplyBuckets),
                    'active_caregivers' => $caregivers->count(),
                ],
            ],
        ]);
    }
}
