<?php

namespace Database\Seeders;

use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Fixed roster of test users for local + CI runs.
 *
 *   1 admin · 4 caregivers · 2 families · all share password "password123!"
 *
 * Each caregiver also lands fully-onboarded for marketplace browsing:
 * profile photo, attached service categories, weekly availability, and
 * 1–2 published gigs. Resources passthrough fully-qualified photo URLs
 * (i.pravatar.cc) without going through the public disk.
 */
class TestUsersSeeder extends Seeder
{
    private const PASSWORD = 'password123!';

    /**
     * Standard 9-to-5 weekday availability JSON shape, matching what
     * MatchingEngine::availableAt and the booking form's soft-warn read.
     *
     * @var array{weekly: array<string, list<array{start: string, end: string}>>}
     */
    private const STANDARD_AVAILABILITY = [
        'weekly' => [
            'mon' => [['start' => '09:00', 'end' => '17:00']],
            'tue' => [['start' => '09:00', 'end' => '17:00']],
            'wed' => [['start' => '09:00', 'end' => '17:00']],
            'thu' => [['start' => '09:00', 'end' => '17:00']],
            'fri' => [['start' => '09:00', 'end' => '17:00']],
            'sat' => [],
            'sun' => [],
        ],
    ];

    public function run(): void
    {
        $hashed = Hash::make(self::PASSWORD);
        $services = ServiceCategory::pluck('id', 'slug');

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
        // Each row carries the matched service slugs (1–2 per caregiver) and
        // a couple of gig templates that get published with status=published.
        $caregivers = [
            [
                'email' => 'caregiver1@kindredcare.test',
                'name' => 'Sarah Mitchell',
                'phone' => '+1 905 555 0101',
                'photo' => 'https://i.pravatar.cc/300?img=47',
                'bio' => 'Five years experience with seniors, including dementia and post-stroke companionship. Friendly, dependable, and excited to help in Durham Region.',
                'rate' => 25.00,
                'years' => 5,
                'languages' => ['English', 'French'],
                'services' => ['companionship', 'walking-companion'],
                'gigs' => [
                    [
                        'category' => 'companionship',
                        'title' => 'Patient companionship visits in Oshawa',
                        'rate' => 25.00,
                        'description' => "I sit with your loved one — chat, share a tea, take a slow walk if they're up for it. Patient with memory loss; happy to read aloud or do simple crafts. Two-hour minimum.",
                        'tasks' => ['Conversation & light social engagement', 'Tea / light snack', 'Reading aloud', 'Simple crafts or board games'],
                    ],
                ],
            ],
            [
                'email' => 'caregiver2@kindredcare.test',
                'name' => 'Aisha Khan',
                'phone' => '+1 905 555 0102',
                'photo' => 'https://i.pravatar.cc/300?img=44',
                'bio' => 'Registered Practical Nurse turned freelance companion. Specialty in errands, meal prep, and gentle medication reminders. Bilingual (English/Urdu).',
                'rate' => 28.00,
                'years' => 8,
                'languages' => ['English', 'Urdu'],
                'services' => ['errands-shopping', 'meal-preparation'],
                'gigs' => [
                    [
                        'category' => 'errands-shopping',
                        'title' => 'Weekly grocery runs + pharmacy pickup',
                        'rate' => 28.00,
                        'description' => 'I do your weekly shop at the store of your choice (Loblaws, Costco, Metro), pick up prescriptions, and put everything away. Receipts handed over and paid up front by you.',
                        'tasks' => ['Pharmacy pickup', 'Grocery shopping with list', 'Drop-off & put-away', 'Receipts handed over'],
                    ],
                    [
                        'category' => 'meal-preparation',
                        'title' => 'Two-hour meal prep — three days of meals',
                        'rate' => 28.00,
                        'description' => 'I cook three days of fresh, simple meals from your favourite cuisine. Diabetic-friendly and low-sodium options available. I leave the kitchen cleaner than I found it.',
                        'tasks' => ['Meal planning around dietary needs', 'Cooking 3 days of meals', 'Portioning and labelling', 'Kitchen cleanup'],
                    ],
                ],
            ],
            [
                'email' => 'caregiver3@kindredcare.test',
                'name' => 'Daniel Singh',
                'phone' => '+1 905 555 0103',
                'photo' => 'https://i.pravatar.cc/300?img=33',
                'bio' => 'Twenty years in tech, ten of those teaching parents and grandparents. I make smart-home setups, video calls, and tablet basics actually stick.',
                'rate' => 30.00,
                'years' => 10,
                'languages' => ['English', 'Punjabi'],
                'services' => ['tech-help'],
                'gigs' => [
                    [
                        'category' => 'tech-help',
                        'title' => 'Tablets, video calls, and smart-home set-ups for seniors',
                        'rate' => 30.00,
                        'description' => 'Patient, jargon-free setup of iPad/iPhone/Alexa/Google Home. I leave a printed cheat-sheet of every step we did so they can do it again on their own.',
                        'tasks' => ['Device setup & account login', 'Video-call walkthrough with family', 'Smart-home device pairing', 'Printed cheat-sheet'],
                    ],
                ],
            ],
            [
                'email' => 'caregiver4@kindredcare.test',
                'name' => 'Emily Chen',
                'phone' => '+1 905 555 0104',
                'photo' => 'https://i.pravatar.cc/300?img=20',
                'bio' => 'Outdoor-loving companion with a soft spot for gardens and dog walks. Reliable through Durham winters; bring my own thermos.',
                'rate' => 22.00,
                'years' => 3,
                'languages' => ['English', 'Mandarin'],
                'services' => ['walking-companion', 'gardening'],
                'gigs' => [
                    [
                        'category' => 'walking-companion',
                        'title' => 'Mid-day walking companion — Oshawa parks',
                        'rate' => 22.00,
                        'description' => "Steady-pace walks at Lakeview Park, McLaughlin Bay, or wherever your loved one likes. I keep an eye on footing and the route, you don't have to worry. Mobility-aid friendly.",
                        'tasks' => ['Pre-walk check-in', '30–60 min walk at their pace', 'Hydration & rest stops', 'Photo of the route on text after'],
                    ],
                    [
                        'category' => 'gardening',
                        'title' => 'Light garden tidy-up — weekly visit',
                        'rate' => 22.00,
                        'description' => 'Weeding, deadheading, watering, light pruning. I bring my own gloves and shears. Yard waste bagged and curbside.',
                        'tasks' => ['Weeding flowerbeds', 'Deadheading & light pruning', 'Watering pots & beds', 'Yard waste bagging'],
                    ],
                ],
            ],
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

            $profile = CaregiverProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'bio' => $cg['bio'],
                    'address' => '123 Test Street',
                    'postal_code' => 'L1H 7K4',
                    'hourly_rate' => $cg['rate'],
                    'travel_radius_km' => 15,
                    'years_of_experience' => $cg['years'],
                    'languages' => $cg['languages'],
                    'photo_path' => $cg['photo'],
                    'photo_status' => 'approved',
                    'availability' => self::STANDARD_AVAILABILITY,
                    'onboarding_complete' => true,
                ],
            );

            // Attach service categories with years_experience pivot.
            $serviceSync = [];
            foreach ($cg['services'] as $slug) {
                if (isset($services[$slug])) {
                    $serviceSync[$services[$slug]] = ['years_experience' => $cg['years']];
                }
            }
            $profile->services()->sync($serviceSync);

            // Publish gigs. Idempotent via title+caregiver_profile_id pair —
            // re-running the seeder updates existing rows rather than spawning
            // duplicates.
            foreach ($cg['gigs'] as $gig) {
                $categoryId = $services[$gig['category']] ?? null;
                if (! $categoryId) {
                    continue;
                }
                Gig::updateOrCreate(
                    [
                        'caregiver_profile_id' => $profile->id,
                        'title' => $gig['title'],
                    ],
                    [
                        'service_category_id' => $categoryId,
                        'hourly_rate_cents' => (int) round($gig['rate'] * 100),
                        'description' => $gig['description'],
                        'tasks_included' => $gig['tasks'],
                        'photo_path' => $cg['photo'],
                        'status' => 'published',
                        'published_at' => now(),
                    ],
                );
            }
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
