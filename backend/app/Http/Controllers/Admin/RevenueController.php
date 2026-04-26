<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\ServiceCategory;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin time-series revenue report. Complements AnalyticsController::index
 * (which is a dashboard snapshot) with period-bucketed aggregates across
 * a configurable date range.
 *
 * Phase 14.4 layers per-bucket service-category breakdowns and a
 * prior-period comparison on top of the Phase 9.3 cut. Bucketing stays
 * driver-agnostic in PHP — when data volume grows we'll drop to SQL
 * window functions, but the API shape will hold.
 */
class RevenueController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['sometimes', Rule::in(['daily', 'weekly', 'monthly'])],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date', 'after_or_equal:from'],
        ]);

        $period = $validated['period'] ?? 'monthly';
        $from = isset($validated['from'])
            ? CarbonImmutable::parse($validated['from'])->startOfDay()
            : now()->startOfYear()->toImmutable();
        $to = isset($validated['to'])
            ? CarbonImmutable::parse($validated['to'])->endOfDay()
            : now()->endOfDay()->toImmutable();

        $current = $this->aggregate($from, $to, $period, withSeries: true);

        // Prior period — same length, immediately preceding `from`. Lets the
        // dashboard show "vs previous month" deltas on each totals tile.
        // Carbon 3's diffInSeconds is signed; we want the absolute window.
        $windowSeconds = (int) abs($to->diffInSeconds($from));
        $priorTo = $from->copy()->subSecond();
        $priorFrom = $priorTo->copy()->subSeconds($windowSeconds)->startOfDay();
        $prior = $this->aggregate($priorFrom, $priorTo, $period, withSeries: false);

        return response()->json([
            'data' => [
                'period' => $period,
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'series' => $current['series'],
                'totals' => $current['totals'],
                'prior_period' => [
                    'from' => $priorFrom->toIso8601String(),
                    'to' => $priorTo->toIso8601String(),
                    'totals' => $prior['totals'],
                ],
                'categories' => $this->categoryCatalog(),
            ],
        ]);
    }

    /**
     * Compute the bucket series + totals for the given range.
     *
     * @return array{
     *   series: array<int, array<string, mixed>>,
     *   totals: array<string, mixed>,
     * }
     */
    private function aggregate(
        CarbonImmutable $from,
        CarbonImmutable $to,
        string $period,
        bool $withSeries,
    ): array {
        $completed = Booking::query()
            ->whereIn('payment_status', [
                Booking::PAYMENT_CAPTURED,
                Booking::PAYMENT_CAPTURED_STUB,
                Booking::PAYMENT_HELD_PENDING_DISPUTE,
            ])
            ->whereBetween('check_out_at', [$from, $to])
            ->with('gig:id,service_category_id')
            ->get(['id', 'check_out_at', 'subtotal_cents', 'platform_fee_cents', 'gig_id']);

        $refunded = Booking::query()
            ->whereIn('payment_status', [
                Booking::PAYMENT_REFUNDED,
                Booking::PAYMENT_REFUNDED_STUB,
            ])
            ->whereBetween('check_out_at', [$from, $to])
            ->get(['check_out_at', 'subtotal_cents']);

        $buckets = [];
        $totalsCategories = [];

        foreach ($completed as $booking) {
            $key = $this->bucketKey($booking->check_out_at, $period);
            $buckets[$key] ??= $this->emptyBucket($key, $booking->check_out_at, $period);
            $buckets[$key]['visits']++;
            $buckets[$key]['gmv_cents'] += (int) $booking->subtotal_cents;
            $buckets[$key]['commission_cents'] += (int) $booking->platform_fee_cents;

            $categoryId = $booking->gig->service_category_id;
            $buckets[$key]['categories'][$categoryId] =
                ($buckets[$key]['categories'][$categoryId] ?? 0) + 1;
            $totalsCategories[$categoryId] = ($totalsCategories[$categoryId] ?? 0) + 1;
        }

        foreach ($refunded as $booking) {
            $key = $this->bucketKey($booking->check_out_at, $period);
            $buckets[$key] ??= $this->emptyBucket($key, $booking->check_out_at, $period);
            $buckets[$key]['refunds_cents'] += (int) $booking->subtotal_cents;
        }

        foreach ($buckets as &$bucket) {
            $bucket['net_cents'] = $bucket['commission_cents'] - $bucket['refunds_cents'];
        }
        unset($bucket);

        ksort($buckets);
        $series = array_values($buckets);

        $totals = [
            'visits' => array_sum(array_column($series, 'visits')),
            'gmv_cents' => array_sum(array_column($series, 'gmv_cents')),
            'commission_cents' => array_sum(array_column($series, 'commission_cents')),
            'refunds_cents' => array_sum(array_column($series, 'refunds_cents')),
            'net_cents' => array_sum(array_column($series, 'net_cents')),
            'categories' => $totalsCategories,
        ];

        return [
            'series' => $withSeries ? $series : [],
            'totals' => $totals,
        ];
    }

    /**
     * The catalog of categories the frontend uses to label colored stripes.
     * Returned in MVP-stable order so chart colors don't shuffle between
     * requests.
     *
     * @return array<int, array{id: int, slug: string, name: string}>
     */
    private function categoryCatalog(): array
    {
        return ServiceCategory::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'slug', 'name'])
            ->map(fn (ServiceCategory $c) => [
                'id' => (int) $c->id,
                'slug' => (string) $c->slug,
                'name' => (string) $c->name,
            ])
            ->all();
    }

    private function bucketKey(CarbonInterface $date, string $period): string
    {
        return match ($period) {
            'daily' => $date->format('Y-m-d'),
            // Monday-start week key for consistent sort.
            'weekly' => $date->copy()->startOfWeek(CarbonInterface::MONDAY)->format('Y-m-d'),
            default => $date->format('Y-m'),
        };
    }

    /**
     * @return array{bucket: string, label: string, visits: int, gmv_cents: int, commission_cents: int, refunds_cents: int, net_cents: int, categories: array<int, int>}
     */
    private function emptyBucket(string $key, CarbonInterface $sample, string $period): array
    {
        $label = match ($period) {
            'daily' => $sample->format('M j, Y'),
            'weekly' => 'Week of '.$sample->copy()->startOfWeek(CarbonInterface::MONDAY)->format('M j'),
            default => $sample->format('F Y'),
        };

        return [
            'bucket' => $key,
            'label' => $label,
            'visits' => 0,
            'gmv_cents' => 0,
            'commission_cents' => 0,
            'refunds_cents' => 0,
            'net_cents' => 0,
            'categories' => [],
        ];
    }
}
