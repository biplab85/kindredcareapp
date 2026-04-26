<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\IncidentReport;
use App\Models\PanicAlert;
use App\Models\Review;
use App\Models\VerificationRecord;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin alerts feed — aggregates "things that need attention" from across
 * the platform into one chronological view. Each entry links to the
 * canonical surface (safety queue, booking detail, verification queue).
 *
 * Sources:
 *   - panic        : active or acknowledged PanicAlert rows
 *   - incident     : open or investigating IncidentReport rows
 *   - dispute      : open or under-review BookingDispute rows
 *   - flagged_booking  : Booking.flagged_at NOT NULL
 *   - flagged_verification : VerificationRecord.status='flagged'
 *   - flagged_review   : Review.flagged_at NOT NULL
 *
 * The controller hits each source independently, normalises the rows into
 * a uniform alert shape, and merges them by occurred_at desc. Volume is
 * bounded per source so a noisy table can't drown the feed.
 */
class AlertsController extends Controller
{
    /** Per-source row cap. Keeps a single noisy table from drowning the feed. */
    private const PER_SOURCE_CAP = 50;

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'kinds' => ['sometimes', 'nullable', 'string', 'max:200'],
        ]);

        $allowedKinds = [
            'panic', 'incident', 'dispute',
            'flagged_booking', 'flagged_verification', 'flagged_review',
        ];

        $kindsFilter = null;
        $kindsRaw = $request->string('kinds')->toString();
        if ($kindsRaw !== '') {
            $kindsFilter = array_values(array_filter(
                array_map('trim', explode(',', $kindsRaw)),
                fn ($k) => in_array($k, $allowedKinds, true),
            ));
        }

        $alerts = [];

        if ($kindsFilter === null || in_array('panic', $kindsFilter, true)) {
            $alerts = array_merge($alerts, $this->fromPanic());
        }
        if ($kindsFilter === null || in_array('incident', $kindsFilter, true)) {
            $alerts = array_merge($alerts, $this->fromIncidents());
        }
        if ($kindsFilter === null || in_array('dispute', $kindsFilter, true)) {
            $alerts = array_merge($alerts, $this->fromDisputes());
        }
        if ($kindsFilter === null || in_array('flagged_booking', $kindsFilter, true)) {
            $alerts = array_merge($alerts, $this->fromFlaggedBookings());
        }
        if ($kindsFilter === null || in_array('flagged_verification', $kindsFilter, true)) {
            $alerts = array_merge($alerts, $this->fromFlaggedVerifications());
        }
        if ($kindsFilter === null || in_array('flagged_review', $kindsFilter, true)) {
            $alerts = array_merge($alerts, $this->fromFlaggedReviews());
        }

        // Sort by occurred_at desc, falling back to a stable composite id
        // for rows that share a timestamp.
        usort($alerts, function (array $a, array $b) {
            return ($b['occurred_at_unix'] <=> $a['occurred_at_unix'])
                ?: strcmp($a['id'], $b['id']);
        });

        // Strip the sort helper before returning.
        $alerts = array_map(function (array $row) {
            unset($row['occurred_at_unix']);

            return $row;
        }, $alerts);

        $byKind = [];
        foreach ($alerts as $row) {
            $byKind[$row['kind']] = ($byKind[$row['kind']] ?? 0) + 1;
        }

        return response()->json([
            'data' => $alerts,
            'meta' => [
                'total' => count($alerts),
                'by_kind' => $byKind,
            ],
        ]);
    }

    /* ──────────── sources ──────────── */

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromPanic(): array
    {
        $rows = PanicAlert::query()
            ->whereIn('status', PanicAlert::OPEN_STATUSES)
            ->with('caregiver:id,name,email,role')
            ->orderByDesc('triggered_at')
            ->limit(self::PER_SOURCE_CAP)
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $caregiver = $row->caregiver;
            $out[] = [
                'id' => 'panic-'.$row->id,
                'kind' => 'panic',
                'severity' => $row->status === PanicAlert::STATUS_ACTIVE ? 'critical' : 'high',
                'title' => 'Panic alert · '.$caregiver->name,
                'summary' => $row->status === PanicAlert::STATUS_ACTIVE
                    ? 'Active alert — caregiver needs immediate attention.'
                    : 'Alert acknowledged; awaiting resolution.',
                'occurred_at' => $this->iso($row->triggered_at),
                'occurred_at_unix' => $row->triggered_at->getTimestamp(),
                'actor' => [
                    'id' => $caregiver->id,
                    'name' => $caregiver->name,
                    'role' => $caregiver->role,
                ],
                'target_url' => '/admin/safety',
                'metadata' => [
                    'booking_id' => $row->booking_id,
                    'silent' => (bool) $row->silent,
                    'status' => $row->status,
                ],
            ];
        }

        return $out;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromIncidents(): array
    {
        $rows = IncidentReport::query()
            ->whereIn('status', [IncidentReport::STATUS_OPEN, IncidentReport::STATUS_INVESTIGATING])
            ->with('reporter:id,name,role')
            ->orderByDesc('created_at')
            ->limit(self::PER_SOURCE_CAP)
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $occurred = $row->getAttribute('created_at');
            $reporter = $row->reporter;
            $out[] = [
                'id' => 'incident-'.$row->id,
                'kind' => 'incident',
                'severity' => $row->severity,
                'title' => 'Incident · '.str_replace('_', ' ', $row->type),
                'summary' => mb_strimwidth((string) $row->description, 0, 140, '…'),
                'occurred_at' => $this->iso($occurred),
                'occurred_at_unix' => $occurred instanceof CarbonInterface ? $occurred->getTimestamp() : 0,
                'actor' => [
                    'id' => $reporter->id,
                    'name' => $reporter->name,
                    'role' => $reporter->role,
                ],
                'target_url' => '/admin/safety',
                'metadata' => [
                    'booking_id' => $row->booking_id,
                    'status' => $row->status,
                ],
            ];
        }

        return $out;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromDisputes(): array
    {
        $rows = BookingDispute::query()
            ->whereIn('status', BookingDispute::OPEN_STATUSES)
            ->with('reporter:id,name,role')
            ->orderByDesc('created_at')
            ->limit(self::PER_SOURCE_CAP)
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $occurred = $row->getAttribute('created_at');
            $reporter = $row->reporter;
            $out[] = [
                'id' => 'dispute-'.$row->id,
                'kind' => 'dispute',
                'severity' => 'high',
                'title' => 'Dispute · '.str_replace('_', ' ', $row->reason_code),
                'summary' => mb_strimwidth((string) $row->description, 0, 140, '…'),
                'occurred_at' => $this->iso($occurred),
                'occurred_at_unix' => $occurred instanceof CarbonInterface ? $occurred->getTimestamp() : 0,
                'actor' => [
                    'id' => $reporter->id,
                    'name' => $reporter->name,
                    'role' => $reporter->role,
                ],
                'target_url' => '/admin/bookings/'.$row->booking_id,
                'metadata' => [
                    'booking_id' => $row->booking_id,
                    'status' => $row->status,
                ],
            ];
        }

        return $out;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromFlaggedBookings(): array
    {
        $rows = Booking::query()
            ->whereNotNull('flagged_at')
            ->with('caregiver:id,name,role')
            ->orderByDesc('flagged_at')
            ->limit(self::PER_SOURCE_CAP)
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $occurred = $row->getAttribute('flagged_at');
            $reasons = (array) ($row->getAttribute('flag_reasons') ?? []);
            $caregiver = $row->caregiver;
            $out[] = [
                'id' => 'flagged_booking-'.$row->id,
                'kind' => 'flagged_booking',
                'severity' => 'medium',
                'title' => 'Visit auto-flagged · '.$caregiver->name,
                'summary' => $reasons === []
                    ? 'Visit triggered an anomaly check during EVV.'
                    : 'Flags: '.implode(', ', array_map(fn ($r) => str_replace('_', ' ', (string) $r), $reasons)),
                'occurred_at' => $this->iso($occurred),
                'occurred_at_unix' => $occurred instanceof CarbonInterface ? $occurred->getTimestamp() : 0,
                'actor' => [
                    'id' => $caregiver->id,
                    'name' => $caregiver->name,
                    'role' => $caregiver->role,
                ],
                'target_url' => '/admin/bookings/'.$row->id,
                'metadata' => [
                    'booking_id' => $row->id,
                    'flag_reasons' => $reasons,
                ],
            ];
        }

        return $out;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromFlaggedVerifications(): array
    {
        $rows = VerificationRecord::query()
            ->where('status', VerificationRecord::STATUS_FLAGGED)
            ->with('user:id,name,role')
            ->orderByDesc('updated_at')
            ->limit(self::PER_SOURCE_CAP)
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $occurred = $row->getAttribute('updated_at');
            $user = $row->user;
            $out[] = [
                'id' => 'flagged_verification-'.$row->id,
                'kind' => 'flagged_verification',
                'severity' => 'medium',
                'title' => 'Verification flagged · '.($user !== null ? $user->name : 'Caregiver'),
                'summary' => 'Auto-flagged by '.($row->provider ?? 'provider').' — needs admin review.',
                'occurred_at' => $this->iso($occurred),
                'occurred_at_unix' => $occurred instanceof CarbonInterface ? $occurred->getTimestamp() : 0,
                'actor' => $user !== null ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                ] : null,
                'target_url' => '/admin/verifications/'.$row->id,
                'metadata' => [
                    'check_type' => $row->check_type,
                    'provider' => $row->provider,
                ],
            ];
        }

        return $out;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromFlaggedReviews(): array
    {
        $rows = Review::query()
            ->whereNotNull('flagged_at')
            ->with([
                'rater:id,name,role',
                'ratee:id,name,role',
            ])
            ->orderByDesc('flagged_at')
            ->limit(self::PER_SOURCE_CAP)
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $occurred = $row->getAttribute('flagged_at');
            $rater = $row->rater;
            $out[] = [
                'id' => 'flagged_review-'.$row->id,
                'kind' => 'flagged_review',
                'severity' => 'low',
                'title' => 'Review flagged',
                'summary' => $row->body !== null
                    ? mb_strimwidth($row->body, 0, 140, '…')
                    : 'Review with no text body was flagged.',
                'occurred_at' => $this->iso($occurred),
                'occurred_at_unix' => $occurred instanceof CarbonInterface ? $occurred->getTimestamp() : 0,
                'actor' => [
                    'id' => $rater->id,
                    'name' => $rater->name,
                    'role' => $rater->role,
                ],
                'target_url' => '/admin/bookings/'.$row->booking_id,
                'metadata' => [
                    'booking_id' => $row->booking_id,
                    'stars' => $row->stars,
                ],
            ];
        }

        return $out;
    }

    private function iso(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toIso8601String() : null;
    }
}
