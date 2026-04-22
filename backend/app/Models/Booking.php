<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
 * @property string $address_neighbourhood
 * @property Carbon $response_deadline_at
 * @property Carbon|null $responded_at
 * @property Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $stripe_payment_intent_id
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

    public const PAYMENT_AUTHORIZED_STUB = 'authorized_stub';

    public const PAYMENT_CAPTURED_STUB = 'captured_stub';

    public const PAYMENT_RELEASED_STUB = 'released_stub';

    public const PAYMENT_REFUNDED_STUB = 'refunded_stub';

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

    protected $fillable = [
        'gig_id',
        'caregiver_user_id',
        'family_profile_id',
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
