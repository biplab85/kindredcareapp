<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_profile_id
 * @property int|null $care_recipient_id
 * @property int $service_category_id
 * @property string $description
 * @property string $location_address
 * @property float $latitude
 * @property float $longitude
 * @property Carbon $scheduled_start
 * @property Carbon $scheduled_end
 * @property bool $is_recurring
 * @property array<string, mixed>|null $recurrence_pattern
 * @property array<string, mixed>|null $preferences
 * @property string|null $photo_path
 * @property string $status
 * @property string $posting_mode
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read FamilyProfile $familyProfile
 * @property-read CareRecipient|null $careRecipient
 * @property-read ServiceCategory $serviceCategory
 */
class Gig extends Model
{
    public const STATUS_OPEN = 'open';

    public const STATUS_MATCHED = 'matched';

    public const STATUS_BOOKED = 'booked';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const POSTING_MATCHED = 'matched';

    public const POSTING_OPEN = 'open';

    public const POSTING_MODES = [
        self::POSTING_MATCHED,
        self::POSTING_OPEN,
    ];

    protected $fillable = [
        'family_profile_id',
        'care_recipient_id',
        'service_category_id',
        'description',
        'location_address',
        'latitude',
        'longitude',
        'scheduled_start',
        'scheduled_end',
        'is_recurring',
        'recurrence_pattern',
        'preferences',
        'photo_path',
        'status',
        'posting_mode',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'is_recurring' => 'boolean',
            'recurrence_pattern' => 'array',
            'preferences' => 'array',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
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
     * @return BelongsTo<ServiceCategory, $this>
     */
    public function serviceCategory(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class);
    }

    public function isEditable(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }

    /**
     * @param  Builder<Gig>  $query
     * @return Builder<Gig>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_OPEN);
    }
}
