<?php

namespace Database\Seeders;

use App\Models\CaregiverProfile;
use App\Models\Certification;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Sample caregiver certifications spread across every review status so the
 * admin certifications queue (and its tabs / review modal) has data to
 * exercise locally. Idempotent: keyed on caregiver_profile_id + name, so
 * re-running updates rather than duplicating.
 *
 * Document paths point at the private disk; the files don't need to exist
 * for the queue to render — the admin preview just falls back gracefully.
 */
class CertificationSeeder extends Seeder
{
    public function run(): void
    {
        $adminId = User::where('email', 'admin@kindredcare.ca')->value('id');

        /** @var array<string, list<array<string, mixed>>> $byCaregiver */
        $byCaregiver = [
            'caregiver1@kindredcare.ca' => [
                [
                    'name' => 'Standard First Aid & CPR-C',
                    'issuer' => 'Canadian Red Cross',
                    'year' => 2024,
                    'status' => Certification::STATUS_PENDING_REVIEW,
                    'document_path' => 'certifications/sample-first-aid.jpg',
                ],
                [
                    'name' => 'Dementia Care Workshop',
                    'issuer' => 'Alzheimer Society of Durham',
                    'year' => 2023,
                    'status' => Certification::STATUS_PENDING_REVIEW,
                    'document_path' => 'certifications/sample-dementia.jpg',
                ],
            ],
            'caregiver2@kindredcare.ca' => [
                [
                    'name' => 'Personal Support Worker Diploma',
                    'issuer' => 'Durham College',
                    'year' => 2018,
                    'status' => Certification::STATUS_VERIFIED,
                    'document_path' => 'certifications/sample-psw.jpg',
                    'reviewed' => true,
                    'expires_at' => now()->addYears(2)->toDateString(),
                ],
                [
                    'name' => 'Food Handler Certificate',
                    'issuer' => 'Durham Region Health Dept.',
                    'year' => 2022,
                    'status' => Certification::STATUS_SELF_REPORTED,
                ],
            ],
            'caregiver3@kindredcare.ca' => [
                [
                    'name' => 'CompTIA A+',
                    'issuer' => 'CompTIA',
                    'year' => 2015,
                    'status' => Certification::STATUS_REJECTED,
                    'document_path' => 'certifications/sample-comptia.jpg',
                    'reviewed' => true,
                    'rejection_reason' => 'Certificate is expired and unrelated to in-home care. Please upload a current first-aid or PSW certification instead.',
                ],
            ],
            'caregiver4@kindredcare.ca' => [
                [
                    'name' => 'Pet First Aid',
                    'issuer' => "Walks 'N' Wags",
                    'year' => 2023,
                    'status' => Certification::STATUS_SELF_REPORTED,
                ],
                [
                    'name' => 'Standard First Aid & CPR-C',
                    'issuer' => 'St. John Ambulance',
                    'year' => 2024,
                    'status' => Certification::STATUS_VERIFIED,
                    'document_path' => 'certifications/sample-sja.jpg',
                    'reviewed' => true,
                    'expires_at' => now()->addYears(3)->toDateString(),
                ],
            ],
        ];

        foreach ($byCaregiver as $email => $certs) {
            $userId = User::where('email', $email)->value('id');
            if ($userId === null) {
                continue;
            }
            $profileId = CaregiverProfile::where('user_id', $userId)->value('id');
            if ($profileId === null) {
                continue;
            }

            foreach ($certs as $c) {
                $reviewed = (bool) ($c['reviewed'] ?? false);
                Certification::updateOrCreate(
                    [
                        'caregiver_profile_id' => $profileId,
                        'name' => $c['name'],
                    ],
                    [
                        'issuer' => $c['issuer'] ?? null,
                        'year' => $c['year'] ?? null,
                        'document_path' => $c['document_path'] ?? null,
                        'status' => $c['status'],
                        'expires_at' => $c['expires_at'] ?? null,
                        'reviewed_by' => $reviewed ? $adminId : null,
                        'reviewed_at' => $reviewed ? now() : null,
                        'rejection_reason' => $c['rejection_reason'] ?? null,
                    ],
                );
            }
        }
    }
}
