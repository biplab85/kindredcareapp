<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $booking_id
 * @property int $rater_user_id
 * @property int $ratee_user_id
 * @property int $stars
 * @property string|null $body
 * @property Carbon $submitted_at
 * @property Carbon|null $visible_at
 * @property Carbon|null $flagged_at
 * @property int|null $flagged_by_user_id
 * @property string|null $flag_reason
 * @property Carbon|null $hidden_at
 * @property int|null $resolved_by
 * @property Carbon|null $resolved_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Booking $booking
 * @property-read User $rater
 * @property-read User $ratee
 */
class Review extends Model
{
    public const FLAG_INAPPROPRIATE = 'inappropriate';

    public const FLAG_RETALIATORY = 'retaliatory';

    public const FLAG_HARASSMENT = 'harassment';

    public const FLAG_FALSE = 'false';

    public const FLAG_OTHER = 'other';

    public const FLAG_REASONS = [
        self::FLAG_INAPPROPRIATE,
        self::FLAG_RETALIATORY,
        self::FLAG_HARASSMENT,
        self::FLAG_FALSE,
        self::FLAG_OTHER,
    ];

    protected $fillable = [
        'booking_id',
        'rater_user_id',
        'ratee_user_id',
        'stars',
        'body',
        'submitted_at',
        'visible_at',
        'flagged_at',
        'flagged_by_user_id',
        'flag_reason',
        'hidden_at',
        'resolved_by',
        'resolved_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // FKs cast to int — see Booking::casts() for context.
            'booking_id' => 'int',
            'rater_user_id' => 'int',
            'ratee_user_id' => 'int',
            'flagged_by_user_id' => 'int',
            'resolved_by' => 'int',
            'submitted_at' => 'datetime',
            'visible_at' => 'datetime',
            'flagged_at' => 'datetime',
            'hidden_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Booking, $this>
     */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function rater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rater_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function ratee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ratee_user_id');
    }

    public function isVisible(): bool
    {
        return $this->visible_at !== null && $this->hidden_at === null;
    }

    /**
     * @param  Builder<Review>  $query
     * @return Builder<Review>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->whereNotNull('visible_at')->whereNull('hidden_at');
    }

    /**
     * @param  Builder<Review>  $query
     * @return Builder<Review>
     */
    public function scopeForRatee(Builder $query, int $userId): Builder
    {
        return $query->where('ratee_user_id', $userId);
    }
}
