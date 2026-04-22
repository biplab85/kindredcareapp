<?php

namespace App\Services;

use App\Models\CaregiverProfile;
use App\Models\User;

class ProfileCompletionService
{
    /** @var array<string, array{weight: int, label: string}> */
    private const FIELD_WEIGHTS = [
        'bio' => ['weight' => 15, 'label' => 'Write a bio (50+ characters)'],
        'photo' => ['weight' => 10, 'label' => 'Upload a profile photo'],
        'date_of_birth' => ['weight' => 5, 'label' => 'Add your date of birth'],
        'gender' => ['weight' => 3, 'label' => 'Select your gender'],
        'address' => ['weight' => 7, 'label' => 'Add your address and postal code'],
        'services' => ['weight' => 10, 'label' => 'Select at least one service'],
        'service_experience' => ['weight' => 5, 'label' => 'Add years of experience per service'],
        'years_of_experience' => ['weight' => 5, 'label' => 'Set your overall years of experience'],
        'languages' => ['weight' => 5, 'label' => 'Select at least one language'],
        'certifications' => ['weight' => 8, 'label' => 'Add at least one certification'],
        'hourly_rate' => ['weight' => 5, 'label' => 'Set your hourly rate'],
        'availability' => ['weight' => 7, 'label' => 'Set your weekly availability'],
        'emergency_contact' => ['weight' => 5, 'label' => 'Add an emergency contact'],
        'references' => ['weight' => 7, 'label' => 'Add 2 professional references'],
        'personality_tags' => ['weight' => 2, 'label' => 'Select personality traits'],
        'interests' => ['weight' => 1, 'label' => 'Add your interests'],
    ];

    private const MATCHABLE_THRESHOLD = 70;

    /**
     * @return array{percentage: int, is_matchable: bool, completed: list<string>, missing: list<array{field: string, label: string, weight: int}>}
     */
    public function calculate(User $user): array
    {
        $profile = $user->caregiverProfile;

        if (! $profile) {
            return [
                'percentage' => 0,
                'is_matchable' => false,
                'completed' => [],
                'missing' => array_map(fn ($key) => [
                    'field' => $key,
                    'label' => self::FIELD_WEIGHTS[$key]['label'],
                    'weight' => self::FIELD_WEIGHTS[$key]['weight'],
                ], array_keys(self::FIELD_WEIGHTS)),
            ];
        }

        $profile->load('services');

        $score = 0;
        $completed = [];
        $missing = [];

        foreach (self::FIELD_WEIGHTS as $field => $config) {
            $isFilled = $this->isFieldFilled($user, $profile, $field);

            if ($isFilled) {
                $score += $config['weight'];
                $completed[] = $field;
            } else {
                $missing[] = [
                    'field' => $field,
                    'label' => $config['label'],
                    'weight' => $config['weight'],
                ];
            }
        }

        return [
            'percentage' => min(100, $score),
            'is_matchable' => $score >= self::MATCHABLE_THRESHOLD,
            'completed' => $completed,
            'missing' => $missing,
        ];
    }

    private function isFieldFilled(User $user, CaregiverProfile $profile, string $field): bool
    {
        return match ($field) {
            'bio' => $profile->bio && strlen($profile->bio) >= 50,
            'photo' => (bool) $profile->photo_path,
            'date_of_birth' => (bool) $user->date_of_birth,
            'gender' => (bool) $user->gender,
            'address' => $profile->postal_code && strlen($profile->postal_code) >= 6,
            'services' => $profile->services->count() > 0,
            'service_experience' => $profile->services->count() > 0 && $profile->years_of_experience > 0,
            'years_of_experience' => $profile->years_of_experience > 0,
            'languages' => ! empty($profile->languages),
            'certifications' => ! empty($profile->certifications),
            'hourly_rate' => $profile->hourly_rate >= 18,
            'availability' => ! empty($profile->availability),
            'emergency_contact' => (bool) $profile->emergency_contact_name && (bool) $profile->emergency_contact_phone,
            'references' => $this->hasReferences($profile),
            'personality_tags' => ! empty($profile->personality_tags),
            'interests' => ! empty($profile->interests),
            default => false,
        };
    }

    private function hasReferences(CaregiverProfile $profile): bool
    {
        /** @var array<int, array<string, mixed>>|null $refs */
        $refs = $profile->references;

        return is_array($refs) && count($refs) >= 2;
    }
}
