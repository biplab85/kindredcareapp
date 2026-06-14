<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\ArrivalReport;
use App\Models\Booking;
use App\Models\BookingDispute;
use App\Models\Message;
use App\Models\Review;
use App\Models\User;
use App\Services\AdminAuditLogger;
use App\Services\StripePaymentService;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin booking surface — searchable browser, full-detail view (with all
 * adjacent evidence: messages, GPS check-in/out, tasks, panic alerts,
 * incident reports, disputes, reviews), and the dispute-resolution +
 * refund actions that close the loop.
 *
 * Refund path uses StripePaymentService::refundForBooking() when configured;
 * otherwise falls back to a stub flag (`refunded_stub`) so dev + tests can
 * exercise the flow without real Stripe credentials.
 */
class BookingController extends Controller
{
    public function __construct(
        private readonly AdminAuditLogger $auditLogger,
        private readonly StripePaymentService $stripe,
    ) {}

    /**
     * Filterable booking browser. Supports:
     *  - status (single or comma-separated)
     *  - payment_status (single or comma-separated)
     *  - from / to (scheduled_start range)
     *  - caregiver_user_id, family_profile_id
     *  - has_dispute=true (only surfaces bookings with an open dispute)
     *  - q (free-text on family + caregiver name/email)
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'nullable', 'string', 'max:200'],
            'payment_status' => ['sometimes', 'nullable', 'string', 'max:200'],
            'from' => ['sometimes', 'nullable', 'date'],
            'to' => ['sometimes', 'nullable', 'date'],
            'caregiver_user_id' => ['sometimes', 'nullable', 'integer'],
            'family_profile_id' => ['sometimes', 'nullable', 'integer'],
            'has_dispute' => ['sometimes', 'boolean'],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:100'],
        ]);

        $query = Booking::query()
            ->with(['caregiver:id,name,email', 'familyProfile.user:id,name,email', 'gig:id,title,description']);

        if (! empty($data['status'])) {
            $statuses = array_filter(array_map('trim', explode(',', $data['status'])));
            $query->whereIn('status', $statuses);
        }

        if (! empty($data['payment_status'])) {
            $statuses = array_filter(array_map('trim', explode(',', $data['payment_status'])));
            $query->whereIn('payment_status', $statuses);
        }

        if (! empty($data['from'])) {
            $query->where('scheduled_start', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->where('scheduled_start', '<=', $data['to'].' 23:59:59');
        }

        if (! empty($data['caregiver_user_id'])) {
            $query->where('caregiver_user_id', $data['caregiver_user_id']);
        }
        if (! empty($data['family_profile_id'])) {
            $query->where('family_profile_id', $data['family_profile_id']);
        }

        if (! empty($data['has_dispute'])) {
            $query->whereHas('disputes', fn ($q) => $q->whereIn('status', BookingDispute::OPEN_STATUSES));
        }

        if (! empty($data['q'])) {
            $q = trim($data['q']);
            $query->where(function ($sub) use ($q) {
                $sub->whereHas('caregiver', fn ($c) => $c->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%"))
                    ->orWhereHas('familyProfile.user', fn ($f) => $f->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%"));
            });
        }

        $bookings = $query
            ->orderByDesc('scheduled_start')
            ->paginate($data['per_page'] ?? 25);

        return response()->json([
            'data' => $bookings->getCollection()->map(fn (Booking $b) => $this->card($b))->values(),
            'meta' => [
                'current_page' => $bookings->currentPage(),
                'last_page' => $bookings->lastPage(),
                'per_page' => $bookings->perPage(),
                'total' => $bookings->total(),
            ],
        ]);
    }

    /**
     * Full detail with all evidence relevant to dispute resolution.
     */
    public function show(Booking $booking): JsonResponse
    {
        $booking->load([
            'caregiver:id,name,email,phone',
            'familyProfile.user:id,name,email,phone',
            'gig',
            'reviews',
            'panicAlerts',
            'incidentReports',
        ]);

        $messages = Message::query()
            ->where('booking_id', $booking->id)
            ->with('sender:id,name,role')
            ->orderBy('created_at')
            ->get();

        $disputes = BookingDispute::query()
            ->where('booking_id', $booking->id)
            ->with(['reporter:id,name,email,role', 'resolver:id,name,email,role'])
            ->orderByDesc('created_at')
            ->get();

        $arrivalReports = ArrivalReport::query()
            ->where('booking_id', $booking->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => [
                ...$this->card($booking),
                'gig' => [
                    'id' => $booking->gig->id,
                    'title' => $booking->gig->title,
                    'description' => $booking->gig->description,
                ],
                'check_in' => [
                    'at' => $this->isoTimestamp($booking->getAttribute('check_in_at')),
                    'lat' => $booking->getAttribute('check_in_lat'),
                    'lng' => $booking->getAttribute('check_in_lng'),
                ],
                'check_out' => [
                    'at' => $this->isoTimestamp($booking->getAttribute('check_out_at')),
                    'lat' => $booking->getAttribute('check_out_lat'),
                    'lng' => $booking->getAttribute('check_out_lng'),
                ],
                'tasks_completed' => $booking->getAttribute('tasks_completed'),
                'caregiver_notes' => $booking->getAttribute('caregiver_notes'),
                'flag_reasons' => $booking->getAttribute('flag_reasons'),
                'flagged_at' => $this->isoTimestamp($booking->getAttribute('flagged_at')),
                'panic_alerts' => $booking->panicAlerts->map(fn ($p) => [
                    'id' => $p->id,
                    'status' => $p->status,
                    'silent' => (bool) $p->silent,
                    'triggered_at' => $this->isoTimestamp($p->triggered_at),
                    'resolution_note' => $p->resolution_note,
                ]),
                'incident_reports' => $booking->incidentReports->map(fn ($i) => [
                    'id' => $i->id,
                    'type' => $i->type,
                    'severity' => $i->severity,
                    'status' => $i->status,
                    'description' => $i->description,
                    'created_at' => $this->isoTimestamp($i->created_at),
                ]),
                'messages' => $messages->map(fn (Message $m) => [
                    'id' => $m->id,
                    'sender' => [
                        'id' => $m->sender->id,
                        'name' => $m->sender->name,
                        'role' => $m->sender->role,
                    ],
                    'body' => $m->body,
                    'redactions' => $m->redactions,
                    'redaction_count' => is_array($m->redactions) ? count($m->redactions) : 0,
                    'is_hidden' => $m->isHidden(),
                    'hidden_reason' => $m->hidden_reason,
                    'hidden_at' => $this->isoTimestamp($m->hidden_at),
                    'created_at' => $this->isoTimestamp($m->created_at),
                ]),
                'reviews' => $booking->reviews->map(fn (Review $r) => [
                    'id' => $r->id,
                    'rater_user_id' => $r->rater_user_id,
                    'ratee_user_id' => $r->ratee_user_id,
                    'stars' => $r->stars,
                    'body' => $r->body,
                ]),
                'arrival_reports' => $arrivalReports->map(fn (ArrivalReport $r) => [
                    'id' => $r->id,
                    'reason_code' => $r->reason_code,
                    'description' => $r->description,
                    'status' => $r->status,
                    'admin_notes' => $r->admin_notes,
                    'created_at' => $this->isoTimestamp($r->created_at),
                    'resolved_at' => $this->isoTimestamp($r->resolved_at),
                ]),
                'disputes' => $disputes->map(fn (BookingDispute $d) => [
                    'id' => $d->id,
                    'reason_code' => $d->reason_code,
                    'description' => $d->description,
                    'status' => $d->status,
                    'evidence_paths' => $d->evidence_paths,
                    'resolution_code' => $d->resolution_code,
                    'resolution_refund_cents' => $d->resolution_refund_cents,
                    'resolution_note' => $d->resolution_note,
                    'created_at' => $this->isoTimestamp($d->created_at),
                    'resolved_at' => $this->isoTimestamp($d->resolved_at),
                    'reporter' => [
                        'id' => $d->reporter->id,
                        'name' => $d->reporter->name,
                        'email' => $d->reporter->email,
                        'role' => $d->reporter->role,
                    ],
                    'resolver' => $d->resolver ? [
                        'id' => $d->resolver->id,
                        'name' => $d->resolver->name,
                        'email' => $d->resolver->email,
                        'role' => $d->resolver->role,
                    ] : null,
                ]),
            ],
        ]);
    }

    /**
     * Issue a refund. Full or partial. If a dispute id is supplied, the
     * dispute is also resolved as part of the same action.
     */
    public function refund(Request $request, Booking $booking): JsonResponse
    {
        $data = $request->validate([
            'amount_cents' => ['nullable', 'integer', 'min:1', 'max:'.$booking->subtotal_cents],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'dispute_id' => ['sometimes', 'nullable', 'integer'],
            'resolution_code' => ['sometimes', 'nullable', Rule::in([
                BookingDispute::RESOLUTION_FULL_REFUND,
                BookingDispute::RESOLUTION_PARTIAL_REFUND,
                BookingDispute::RESOLUTION_RELEASE_TO_CAREGIVER,
                BookingDispute::RESOLUTION_NO_ACTION,
            ])],
        ]);

        if (! $this->canRefund($booking)) {
            return response()->json([
                'message' => 'This booking is not in a refundable state.',
            ], 422);
        }

        /** @var User $admin */
        $admin = $request->user();

        $amount = $data['amount_cents'] ?? null;
        $isFull = $amount === null || $amount === $booking->subtotal_cents;

        // Stripe call (or stub fallback). We continue regardless because the
        // stub channel is intentional in dev — production deploys will have
        // Stripe configured and `refundForBooking` will return true on success.
        $stripeOk = $this->stripe->refundForBooking($booking, $amount);

        $booking->update([
            'payment_status' => $stripeOk ? Booking::PAYMENT_REFUNDED : Booking::PAYMENT_REFUNDED_STUB,
            'payout_at' => null,
            'payout_transferred_at' => null,
        ]);

        // If linked to a dispute, resolve it too.
        if (! empty($data['dispute_id'])) {
            $dispute = BookingDispute::where('booking_id', $booking->id)
                ->where('id', $data['dispute_id'])
                ->first();

            if ($dispute && $dispute->isOpen()) {
                $dispute->update([
                    'status' => BookingDispute::STATUS_RESOLVED,
                    'resolved_by' => $admin->id,
                    'resolved_at' => now(),
                    'resolution_code' => $data['resolution_code']
                        ?? ($isFull ? BookingDispute::RESOLUTION_FULL_REFUND : BookingDispute::RESOLUTION_PARTIAL_REFUND),
                    'resolution_refund_cents' => $amount ?? $booking->subtotal_cents,
                    'resolution_note' => $data['reason'],
                ]);
            }
        }

        $this->auditLogger->record(
            admin: $admin,
            action: 'booking.refunded',
            targetType: AdminAuditLog::TARGET_BOOKING,
            targetId: $booking->id,
            metadata: [
                'amount_cents' => $amount ?? $booking->subtotal_cents,
                'is_full' => $isFull,
                'stripe_ok' => $stripeOk,
                'dispute_id' => $data['dispute_id'] ?? null,
            ],
            reason: $data['reason'],
        );

        return response()->json([
            'data' => $this->card($booking->fresh()),
        ]);
    }

    private function canRefund(Booking $booking): bool
    {
        return in_array($booking->payment_status, [
            Booking::PAYMENT_CAPTURED,
            Booking::PAYMENT_CAPTURED_STUB,
            Booking::PAYMENT_RELEASED,
            Booking::PAYMENT_RELEASED_STUB,
            Booking::PAYMENT_HELD_PENDING_DISPUTE,
        ], true);
    }

    /**
     * Admin resets the check-in entirely. Used when an arrival report
     * establishes the recorded check_in_at lies — caregiver tapped check-in
     * 20 min before they actually arrived. Clears the GPS slot, returns the
     * booking to `confirmed`, and the caregiver's UI shows the Start visit
     * button again so they have to re-check-in for real.
     *
     * Only works on in_progress visits that haven't checked out yet. The
     * original check_in_at + lat/lng land in the audit log for a fully
     * reversible / inspectable trail.
     */
    public function resetCheckIn(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->check_in_at === null) {
            return response()->json(['message' => 'This booking has no check-in to reset.'], 422);
        }

        if ($booking->status !== Booking::STATUS_IN_PROGRESS) {
            return response()->json(['message' => 'Only in-progress visits can be reset to awaiting check-in.'], 422);
        }

        if ($booking->check_out_at !== null) {
            return response()->json(['message' => 'This visit has already checked out — reset is not allowed after check-out.'], 422);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();
        $oldCheckIn = $booking->check_in_at->toIso8601String();
        $oldLat = $booking->check_in_lat;
        $oldLng = $booking->check_in_lng;

        $booking->update([
            'status' => Booking::STATUS_CONFIRMED,
            'check_in_at' => null,
            'check_in_lat' => null,
            'check_in_lng' => null,
            'check_in_distance_m' => null,
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'booking.check_in_reset',
            targetType: AdminAuditLog::TARGET_BOOKING,
            targetId: $booking->id,
            metadata: [
                'old_check_in_at' => $oldCheckIn,
                'old_check_in_lat' => $oldLat,
                'old_check_in_lng' => $oldLng,
            ],
            reason: $data['reason'],
        );

        return response()->json([
            'data' => $this->card($booking->fresh()),
        ]);
    }

    /**
     * Compact card used by index + embedded in show.
     *
     * @return array<string, mixed>
     */
    private function card(Booking $booking): array
    {
        /** @var User|null $caregiver */
        $caregiver = $booking->caregiver;
        $familyUser = $booking->familyProfile->user;

        return [
            'id' => $booking->id,
            'status' => $booking->status,
            'payment_status' => $booking->payment_status,
            'scheduled_start' => $this->isoTimestamp($booking->scheduled_start),
            'scheduled_end' => $this->isoTimestamp($booking->scheduled_end),
            'duration_minutes' => $booking->duration_minutes,
            'subtotal_cents' => $booking->subtotal_cents,
            'platform_fee_cents' => $booking->platform_fee_cents,
            'caregiver_payout_cents' => $booking->getAttribute('caregiver_payout_cents'),
            'address' => $booking->getAttribute('address_full'),
            'caregiver' => $caregiver ? [
                'id' => $caregiver->id,
                'name' => $caregiver->name,
                'email' => $caregiver->email,
            ] : null,
            'family' => $familyUser ? [
                'id' => $familyUser->id,
                'name' => $familyUser->name,
                'email' => $familyUser->email,
                'family_profile_id' => $booking->family_profile_id,
            ] : null,
            'flagged_at' => $this->isoTimestamp($booking->getAttribute('flagged_at')),
        ];
    }

    private function isoTimestamp(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toIso8601String() : null;
    }
}
