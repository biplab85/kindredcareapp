<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareRecipient extends Model
{
    protected $fillable = [
        'family_profile_id',
        'name',
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
            'interests' => 'array',
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
