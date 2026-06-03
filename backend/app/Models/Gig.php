<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Caregiver-owned gig listing (Fiverr-style). One row = one productized
 * service offering: title, description, hourly rate, photo, included
 * tasks. A caregiver may publish many gigs across categories. Visit
 * specifics live on the booking row that's created when a family books
 * this gig.
 *
 * @property int $id
 * @property int $caregiver_profile_id
 * @property int $service_category_id
 * @property string $title
 * @property int $hourly_rate_cents
 * @property string $description
 * @property array<int, string>|null $tasks_included
 * @property string|null $photo_path
 * @property string $status draft | published | paused
 * @property Carbon|null $published_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read CaregiverProfile $caregiverProfile
 * @property-read ServiceCategory $serviceCategory
 */
class Gig extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_PAUSED = 'paused';

    public const ALL_STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PUBLISHED,
        self::STATUS_PAUSED,
    ];

    protected $fillable = [
        'caregiver_profile_id',
        'service_category_id',
        'title',
        'hourly_rate_cents',
        'description',
        'tasks_included',
        'photo_path',
        'status',
        'published_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // FKs cast to int — see Booking::casts() for context.
            'caregiver_profile_id' => 'int',
            'service_category_id' => 'int',
            'tasks_included' => 'array',
            'published_at' => 'datetime',
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
     * @return BelongsTo<ServiceCategory, $this>
     */
    public function serviceCategory(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class);
    }

    /**
     * @return HasMany<Booking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    /**
     * @param  Builder<Gig>  $query
     * @return Builder<Gig>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }
}
