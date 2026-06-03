<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $booking_id
 * @property int $sender_user_id
 * @property string $body
 * @property array<int, array<string, string>>|null $redactions
 * @property Carbon|null $hidden_at
 * @property int|null $hidden_by
 * @property string|null $hidden_reason
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Booking $booking
 * @property-read User $sender
 * @property-read User|null $hider
 */
class Message extends Model
{
    protected $fillable = [
        'booking_id',
        'sender_user_id',
        'body',
        'redactions',
        'hidden_at',
        'hidden_by',
        'hidden_reason',
        'read_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // FKs cast to int — see Booking::casts() for context (shared-host
            // PDO drivers return bigint columns as strings, breaking ===).
            'booking_id' => 'int',
            'sender_user_id' => 'int',
            'hidden_by' => 'int',
            // Phase 15.B — message bodies are encrypted at rest. Bodies
            // are already redacted before persistence, but encryption
            // adds a second layer so a DB compromise doesn't leak the
            // post-redaction cleartext either. Never used in WHERE clauses.
            'body' => 'encrypted',
            'redactions' => 'array',
            'hidden_at' => 'datetime',
            'read_at' => 'datetime',
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
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function hider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hidden_by');
    }

    public function isHidden(): bool
    {
        return $this->hidden_at !== null;
    }

    /**
     * @param  Builder<Message>  $query
     * @return Builder<Message>
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->whereNull('hidden_at');
    }
}
