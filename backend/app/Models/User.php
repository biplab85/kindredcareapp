<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'phone_verified_at',
        'date_of_birth',
        'gender',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_recovery_codes',
        'two_factor_secret',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'date_of_birth' => 'date',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /**
     * @return HasOne<CaregiverProfile, $this>
     */
    public function caregiverProfile(): HasOne
    {
        return $this->hasOne(CaregiverProfile::class);
    }

    /**
     * @return HasOne<FamilyProfile, $this>
     */
    public function familyProfile(): HasOne
    {
        return $this->hasOne(FamilyProfile::class);
    }

    /**
     * @return HasMany<VerificationRecord, $this>
     */
    public function verificationRecords(): HasMany
    {
        return $this->hasMany(VerificationRecord::class);
    }

    public function isFullyVerified(): bool
    {
        return $this->verificationRecords()
            ->whereIn('check_type', VerificationRecord::ALL_CHECK_TYPES)
            ->where('status', VerificationRecord::STATUS_CLEARED)
            ->count() === count(VerificationRecord::ALL_CHECK_TYPES);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isCaregiver(): bool
    {
        return $this->role === 'caregiver';
    }

    public function isFamily(): bool
    {
        return $this->role === 'family';
    }
}
