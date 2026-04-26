<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $bio
 * @property string|null $address
 * @property string|null $postal_code
 * @property float|null $latitude
 * @property float|null $longitude
 * @property numeric $hourly_rate
 * @property int $travel_radius_km
 * @property int $years_of_experience
 * @property array<int, string>|null $languages
 * @property array<int, string>|null $interests
 * @property array<int, string>|null $personality_tags
 * @property array<int, mixed>|null $certifications
 * @property array<int, mixed>|null $references
 * @property string|null $emergency_contact_name
 * @property string|null $emergency_contact_phone
 * @property string|null $emergency_contact_relationship
 * @property array<string, mixed>|null $availability
 * @property string|null $photo_path
 * @property string $photo_status
 * @property bool $onboarding_complete
 * @property string|null $stripe_connect_account_id
 * @property bool $payouts_enabled
 * @property Carbon|null $connect_onboarded_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read Collection<int, ServiceCategory> $services
 */
class CaregiverProfile extends Model
{
    protected $fillable = [
        'user_id',
        'bio',
        'address',
        'postal_code',
        'latitude',
        'longitude',
        'hourly_rate',
        'travel_radius_km',
        'years_of_experience',
        'languages',
        'interests',
        'personality_tags',
        'certifications',
        'references',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'availability',
        'photo_path',
        'photo_status',
        'onboarding_complete',
        'stripe_connect_account_id',
        'payouts_enabled',
        'connect_onboarded_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'languages' => 'array',
            'interests' => 'array',
            'personality_tags' => 'array',
            'certifications' => 'array',
            'references' => 'array',
            'availability' => 'array',
            'hourly_rate' => 'decimal:2',
            'onboarding_complete' => 'boolean',
            'payouts_enabled' => 'boolean',
            'connect_onboarded_at' => 'datetime',
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
     * @return BelongsToMany<ServiceCategory, $this>
     */
    public function services(): BelongsToMany
    {
        return $this->belongsToMany(ServiceCategory::class, 'caregiver_service')
            ->withPivot('years_experience');
    }
}
