<?php

namespace Database\Seeders;

use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Fixed roster of test users for local + CI runs.
 *
 *   1 admin · 4 caregivers · 2 families · all share password "password123!"
 *
 * Caregivers and families also get a minimal profile row so the app's
 * profile-required code paths don't dead-end on a freshly seeded DB.
 */
class TestUsersSeeder extends Seeder
{
    private const PASSWORD = 'password123!';

    public function run(): void
    {
        $hashed = Hash::make(self::PASSWORD);

        // ──────── Admin ────────
        User::updateOrCreate(
            ['email' => 'admin@kindredcare.test'],
            [
                'name' => 'Admin User',
                'password' => $hashed,
                'role' => 'admin',
                'email_verified_at' => now(),
                'status' => 'active',
            ],
        );

        // ──────── Caregivers ────────
        $caregivers = [
            ['email' => 'caregiver1@kindredcare.test', 'name' => 'Sarah Mitchell', 'phone' => '+1 905 555 0101'],
            ['email' => 'caregiver2@kindredcare.test', 'name' => 'Aisha Khan', 'phone' => '+1 905 555 0102'],
            ['email' => 'caregiver3@kindredcare.test', 'name' => 'Daniel Singh', 'phone' => '+1 905 555 0103'],
            ['email' => 'caregiver4@kindredcare.test', 'name' => 'Emily Chen', 'phone' => '+1 905 555 0104'],
        ];

        foreach ($caregivers as $cg) {
            $user = User::updateOrCreate(
                ['email' => $cg['email']],
                [
                    'name' => $cg['name'],
                    'password' => $hashed,
                    'role' => 'caregiver',
                    'phone' => $cg['phone'],
                    'phone_verified_at' => now(),
                    'email_verified_at' => now(),
                    'status' => 'active',
                ],
            );

            CaregiverProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'bio' => "Friendly, dependable, and ready to help in Durham Region.",
                    'address' => '123 Test Street',
                    'postal_code' => 'L1H 7K4',
                    'hourly_rate' => 25.00,
                    'travel_radius_km' => 15,
                    'years_of_experience' => 3,
                    'languages' => ['English'],
                    'onboarding_complete' => true,
                ],
            );
        }

        // ──────── Families ────────
        $families = [
            ['email' => 'family1@kindredcare.test', 'name' => 'Mohammad Rahman', 'phone' => '+1 905 555 0201'],
            ['email' => 'family2@kindredcare.test', 'name' => 'Priya Patel', 'phone' => '+1 905 555 0202'],
        ];

        foreach ($families as $fam) {
            $user = User::updateOrCreate(
                ['email' => $fam['email']],
                [
                    'name' => $fam['name'],
                    'password' => $hashed,
                    'role' => 'family',
                    'phone' => $fam['phone'],
                    'phone_verified_at' => now(),
                    'email_verified_at' => now(),
                    'status' => 'active',
                ],
            );

            FamilyProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'relationship' => 'child',
                    'postal_code' => 'L1H 7K4',
                    'city' => 'Oshawa',
                    'onboarding_complete' => true,
                ],
            );
        }
    }
}
