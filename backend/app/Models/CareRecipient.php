<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $family_profile_id
 * @property string $name
 * @property string|null $street_address
 * @property int|null $age
 * @property string|null $postal_code
 * @property string|null $language
 * @property array<int, string>|null $interests
 * @property string|null $accessibility_notes
 * @property-read FamilyProfile $familyProfile
 */
class CareRecipient extends Model
{
    protected $fillable = [
        'family_profile_id',
        'name',
        'street_address',
        'age',
        'postal_code',
        'language',
        'interests',
        'accessibility_notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // FK cast to int — see Booking::casts() for context.
            'family_profile_id' => 'int',
            'interests' => 'array',
            // Phase 15.B — accessibility_notes can carry medical / cognitive
            // context. Never queried, so encrypted-at-rest is safe.
            'accessibility_notes' => 'encrypted',
        ];
    }

    /**
     * @return BelongsTo<FamilyProfile, $this>
     */
    public function familyProfile(): BelongsTo
    {
        return $this->belongsTo(FamilyProfile::class);
    }
}
