<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FamilyProfile extends Model
{
    protected $fillable = [
        'user_id',
        'relationship',
        'postal_code',
        'city',
        'onboarding_complete',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
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
     * @return HasMany<CareRecipient, $this>
     */
    public function careRecipients(): HasMany
    {
        return $this->hasMany(CareRecipient::class);
    }
}
