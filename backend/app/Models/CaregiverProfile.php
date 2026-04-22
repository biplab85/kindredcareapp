<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

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
