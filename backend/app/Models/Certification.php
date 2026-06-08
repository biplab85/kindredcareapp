<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One caregiver certification — Standard First Aid, PSW diploma, etc.
 *
 * Lifecycle: `self_reported` is the floor (caregiver typed it in, no
 * document on file). Uploading a document moves it to `pending_review`;
 * admin flips it to `verified` or `rejected`. `expired` is reserved for
 * the Phase 2 expiry cron and currently unused.
 *
 * @property int $id
 * @property int $caregiver_profile_id
 * @property string $name
 * @property string|null $issuer
 * @property int|null $year
 * @property string|null $document_path
 * @property string $status
 * @property Carbon|null $expires_at
 * @property int|null $reviewed_by
 * @property Carbon|null $reviewed_at
 * @property string|null $rejection_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read CaregiverProfile $caregiverProfile
 * @property-read User|null $reviewer
 */
class Certification extends Model
{
    protected $table = 'caregiver_certifications';

    public const STATUS_SELF_REPORTED = 'self_reported';

    public const STATUS_PENDING_REVIEW = 'pending_review';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_EXPIRED = 'expired';

    public const ALL_STATUSES = [
        self::STATUS_SELF_REPORTED,
        self::STATUS_PENDING_REVIEW,
        self::STATUS_VERIFIED,
        self::STATUS_REJECTED,
        self::STATUS_EXPIRED,
    ];

    protected $fillable = [
        'caregiver_profile_id',
        'name',
        'issuer',
        'year',
        'document_path',
        'status',
        'expires_at',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
    ];

    /**
     * Never expose the private-disk path. Admin previews go through a
     * signed URL helper, and caregivers don't need the path at all.
     *
     * @var list<string>
     */
    protected $hidden = ['document_path'];

    /**
     * Surface `has_document` instead so the frontend can distinguish
     * "uploaded" from "self-reported" without seeing the raw path.
     *
     * @var list<string>
     */
    protected $appends = ['has_document'];

    public function getHasDocumentAttribute(): bool
    {
        return $this->document_path !== null;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // FKs cast to int — see Booking::casts() for context.
            'caregiver_profile_id' => 'int',
            'reviewed_by' => 'int',
            'year' => 'int',
            'expires_at' => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<CaregiverProfile, $this>
     */
    public function caregiverProfile(): BelongsTo
    {
        return $this->belongsTo(CaregiverProfile::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isVerified(): bool
    {
        return $this->status === self::STATUS_VERIFIED;
    }

    public function isSelfReported(): bool
    {
        return $this->status === self::STATUS_SELF_REPORTED;
    }
}
