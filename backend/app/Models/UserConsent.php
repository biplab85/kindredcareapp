<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $kind
 * @property bool $granted
 * @property string|null $policy_version
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property Carbon|null $created_at
 * @property-read User $user
 */
class UserConsent extends Model
{
    public $timestamps = false;

    public const KIND_TERMS_OF_SERVICE = 'terms_of_service';

    public const KIND_PRIVACY_POLICY = 'privacy_policy';

    public const KIND_BIOMETRIC_COLLECTION = 'biometric_collection';

    public const KIND_BACKGROUND_CHECK = 'background_check';

    public const KIND_MARKETING_EMAIL = 'marketing_email';

    public const KIND_MARKETING_SMS = 'marketing_sms';

    public const ALL_KINDS = [
        self::KIND_TERMS_OF_SERVICE,
        self::KIND_PRIVACY_POLICY,
        self::KIND_BIOMETRIC_COLLECTION,
        self::KIND_BACKGROUND_CHECK,
        self::KIND_MARKETING_EMAIL,
        self::KIND_MARKETING_SMS,
    ];

    protected $fillable = [
        'user_id',
        'kind',
        'granted',
        'policy_version',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            // FK cast to int — see Booking::casts() for context.
            'user_id' => 'int',
            'granted' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
