<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $gig_id
 * @property int $caregiver_user_id
 * @property int $family_profile_id
 * @property int $match_rank
 * @property array<int, int>|null $fallback_queue
 * @property string $status
 * @property string $payment_status
 * @property int $hourly_rate_cents
 * @property int $duration_minutes
 * @property int $subtotal_cents
 * @property int $platform_fee_cents
 * @property int $caregiver_payout_cents
 * @property Carbon $scheduled_start
 * @property Carbon $scheduled_end
 * @property string $address_full
 * @property string|null $address_neighbourhood
 * @property Carbon $response_deadline_at
 * @property Carbon|null $responded_at
 * @property Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $stripe_payment_intent_id
 * @property Carbon|null $check_in_at
 * @property float|null $check_in_lat
 * @property float|null $check_in_lng
 * @property int|null $check_in_distance_m
 * @property Carbon|null $check_out_at
 * @property float|null $check_out_lat
 * @property float|null $check_out_lng
 * @property int|null $check_out_distance_m
 * @property array<int, string>|null $tasks_completed
 * @property string|null $caregiver_notes
 * @property Carbon|null $safety_acknowledged_at
 * @property Carbon|null $reminder_24h_sent_at
 * @property Carbon|null $reminder_1h_sent_at
 * @property Carbon|null $flagged_at
 * @property array<int, string>|null $flag_reasons
 * @property Carbon|null $payout_at
 * @property Carbon|null $payout_transferred_at
 * @property string|null $stripe_transfer_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Gig $gig
 * @property-read User $caregiver
 * @property-read FamilyProfile $familyProfile
 */
class Booking extends Model
{
    public const STATUS_PENDING_CAREGIVER = 'pending_caregiver';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_DECLINED = 'declined';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CANCELLED_FAMILY = 'cancelled_by_family';

    public const STATUS_CANCELLED_CAREGIVER = 'cancelled_by_caregiver';

    public const STATUS_NO_SHOW = 'no_show';

    /** Statuses that count as a live engagement on the gig. */
    public const ACTIVE_STATUSES = [
        self::STATUS_PENDING_CAREGIVER,
        self::STATUS_CONFIRMED,
        self::STATUS_IN_PROGRESS,
    ];

    public const PAYMENT_NOT_REQUIRED = 'not_required';

    // Stub-channel states — used when Stripe isn't configured (dev) OR when
    // the family hasn't attached a payment method yet. Phase 9 keeps these
    // around indefinitely so the unconfigured path continues to work.
    public const PAYMENT_AUTHORIZED_STUB = 'authorized_stub';

    public const PAYMENT_CAPTURED_STUB = 'captured_stub';

    public const PAYMENT_RELEASED_STUB = 'released_stub';

    public const PAYMENT_REFUNDED_STUB = 'refunded_stub';

    // Real-Stripe states — written when StripePaymentService is configured
    // and a PaymentIntent backs the booking.
    public const PAYMENT_AUTHORIZED = 'authorized';

    public const PAYMENT_CAPTURED = 'captured';

    public const PAYMENT_RELEASED = 'released';

    public const PAYMENT_REFUNDED = 'refunded';

    // Dispute-triggered freeze — set on dispute creation, cleared only by
    // admin resolution.
    public const PAYMENT_HELD_PENDING_DISPUTE = 'held_pending_dispute';

    public const CANCELLED_BY_FAMILY = 'family';

    public const CANCELLED_BY_CAREGIVER = 'caregiver';

    public const CANCELLED_BY_SYSTEM = 'system';

    public const PLATFORM_FEE_BPS = 750; // 7.50%

    /** Switch to on-demand response window when start is closer than this. */
    public const ON_DEMAND_THRESHOLD_HOURS = 2;

    public const RESPONSE_WINDOW_SCHEDULED_HOURS = 4;

    public const RESPONSE_WINDOW_ON_DEMAND_MINUTES = 15;

    /** Family-side free-cancel window before scheduled start. */
    public const FAMILY_FREE_CANCEL_HOURS = 24;

    /** Minutes after scheduled_start before a missing check-in becomes a no-show. */
    public const NO_SHOW_THRESHOLD_MINUTES = 30;

    /** Hours after check-out during which the family can open a dispute. */
    public const DISPUTE_WINDOW_HOURS = 48;

    /**
     * How long the platform holds captured funds before transferring them
     * to the caregiver. Gives the family a dispute window and matches the
     * mvp-requirements §4.9 escrow promise.
     */
    public const PAYOUT_HOLD_HOURS = 24;

    /** Geofence radius (meters) for a clean GPS check-in. */
    public const CHECK_IN_RADIUS_M = 200;

    /** Outside this, the visit enters admin review. */
    public const CHECK_IN_FLAG_RADIUS_M = 500;

    /** Flag the visit when actual duration is shorter than this ratio of booked. */
    public const DURATION_ANOMALY_RATIO = 0.5;

    /** Flag reason codes. */
    public const FLAG_CHECK_IN_FAR = 'check_in_far';

    public const FLAG_CHECK_OUT_FAR = 'check_out_far';

    public const FLAG_SHORT_DURATION = 'short_duration';

    protected $fillable = [
        'gig_id',
        'caregiver_user_id',
        'family_profile_id',
        'care_recipient_id',
        'notes_from_family',
        'match_rank',
        'fallback_queue',
        'status',
        'payment_status',
        'hourly_rate_cents',
        'duration_minutes',
        'subtotal_cents',
        'platform_fee_cents',
        'caregiver_payout_cents',
        'scheduled_start',
        'scheduled_end',
        'address_full',
        'address_neighbourhood',
        'response_deadline_at',
        'responded_at',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'stripe_payment_intent_id',
        'check_in_at',
        'check_in_lat',
        'check_in_lng',
        'check_in_distance_m',
        'check_out_at',
        'check_out_lat',
        'check_out_lng',
        'check_out_distance_m',
        'tasks_completed',
        'caregiver_notes',
        'safety_acknowledged_at',
        'reminder_24h_sent_at',
        'reminder_1h_sent_at',
        'flagged_at',
        'flag_reasons',
        'payout_at',
        'payout_transferred_at',
        'stripe_transfer_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fallback_queue' => 'array',
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'response_deadline_at' => 'datetime',
            'responded_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'check_in_at' => 'datetime',
            'check_in_lat' => 'float',
            'check_in_lng' => 'float',
            'check_out_at' => 'datetime',
            'check_out_lat' => 'float',
            'check_out_lng' => 'float',
            'tasks_completed' => 'array',
            'safety_acknowledged_at' => 'datetime',
            'reminder_24h_sent_at' => 'datetime',
            'reminder_1h_sent_at' => 'datetime',
            'flagged_at' => 'datetime',
            'flag_reasons' => 'array',
            'payout_at' => 'datetime',
            'payout_transferred_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Gig, $this>
     */
    public function gig(): BelongsTo
    {
        return $this->belongsTo(Gig::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function caregiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caregiver_user_id');
    }

    /**
     * @return BelongsTo<FamilyProfile, $this>
     */
    public function familyProfile(): BelongsTo
    {
        return $this->belongsTo(FamilyProfile::class);
    }

    /**
     * @return BelongsTo<CareRecipient, $this>
     */
    public function careRecipient(): BelongsTo
    {
        return $this->belongsTo(CareRecipient::class);
    }

    /**
     * @return HasMany<Review, $this>
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    /**
     * @return HasMany<PanicAlert, $this>
     */
    public function panicAlerts(): HasMany
    {
        return $this->hasMany(PanicAlert::class);
    }

    /**
     * @return HasMany<BookingDispute, $this>
     */
    public function disputes(): HasMany
    {
        return $this->hasMany(BookingDispute::class);
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * @return HasMany<IncidentReport, $this>
     */
    public function incidentReports(): HasMany
    {
        return $this->hasMany(IncidentReport::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING_CAREGIVER;
    }

    public function isConfirmed(): bool
    {
        return $this->status === self::STATUS_CONFIRMED;
    }

    public function isCancellable(): bool
    {
        return in_array($this->status, [
            self::STATUS_PENDING_CAREGIVER,
            self::STATUS_CONFIRMED,
        ], true);
    }

    public function isExpired(): bool
    {
        return $this->isPending() && $this->response_deadline_at->isPast();
    }

    public function isInProgress(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function isFlagged(): bool
    {
        return $this->flagged_at !== null;
    }

    /**
     * @param  Builder<Booking>  $query
     * @return Builder<Booking>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    /**
     * @param  Builder<Booking>  $query
     * @return Builder<Booking>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING_CAREGIVER);
    }
}
