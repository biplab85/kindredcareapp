<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VerificationRecord extends Model
{
    public const TYPE_IDENTITY = 'identity';

    public const TYPE_CPIC = 'cpic';

    public const TYPE_AML = 'aml';

    public const TYPE_REFERENCE = 'reference';

    public const STATUS_NOT_STARTED = 'not_started';

    public const STATUS_PENDING_REVIEW = 'pending_review';

    public const STATUS_CLEARED = 'cleared';

    public const STATUS_FLAGGED = 'flagged';

    public const STATUS_REJECTED = 'rejected';

    public const ALL_CHECK_TYPES = [
        self::TYPE_IDENTITY,
        self::TYPE_CPIC,
        self::TYPE_AML,
        self::TYPE_REFERENCE,
    ];

    protected $fillable = [
        'user_id',
        'check_type',
        'status',
        'provider',
        'provider_reference_id',
        'document_paths',
        'admin_notes',
        'rejection_reason',
        'reviewed_by',
        'reviewed_at',
        'retry_count',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'document_paths' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public static function createDefaultsForUser(int $userId): void
    {
        foreach (self::ALL_CHECK_TYPES as $type) {
            self::firstOrCreate([
                'user_id' => $userId,
                'check_type' => $type,
            ], [
                'status' => self::STATUS_NOT_STARTED,
                'provider' => 'manual',
            ]);
        }
    }
}
