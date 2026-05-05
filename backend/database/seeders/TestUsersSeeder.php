<?php

namespace Database\Seeders;

use App\Models\CaregiverProfile;
use App\Models\CareRecipient;
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
 * exactly four published gigs (16 total across the cast). Resources
 * passthrough fully-qualified photo URLs (i.pravatar.cc) without going
 * through the public disk.
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
            ['email' => 'admin@kindredcare.ca'],
            [
                'name' => 'Admin User',
                'password' => $hashed,
                'role' => 'admin',
                'email_verified_at' => now(),
                'status' => 'active',
            ],
        );

        // ──────── Caregivers ────────
        // Each row carries the matched service slugs and exactly four gig
        // templates per caregiver, all published. Variety within each set
        // (different time slots, audiences, focus) so the marketplace
        // doesn't feel cookie-cutter even though the cast is small.
        $caregivers = [
            [
                'email' => 'caregiver1@kindredcare.ca',
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
                    [
                        'category' => 'companionship',
                        'title' => 'Weekend afternoons at the family home',
                        'rate' => 25.00,
                        'description' => "Saturday or Sunday 2–6 PM block. Great for families who want regular respite without midweek juggling. I'll bring a deck of cards or a movie if your loved one's up for it.",
                        'tasks' => ['Four-hour afternoon block', 'Card games or movies', 'Light snack & drinks', 'Wellness check at the end'],
                    ],
                    [
                        'category' => 'companionship',
                        'title' => 'Evening conversation visits — dementia-aware',
                        'rate' => 25.00,
                        'description' => "Late afternoon to early evening, when sundowning anxiety can spike. I'm trained in redirection and validation. We keep a calm room, soft lighting, and a familiar routine.",
                        'tasks' => ['Calming routine setup', 'Sundowning redirection', 'Bedtime prep prompt', 'Notes for the family group chat'],
                    ],
                    [
                        'category' => 'walking-companion',
                        'title' => 'Gentle weekday strolls — Lakeview Park',
                        'rate' => 25.00,
                        'description' => "Lakeview Park's flat paved loop is perfect for walkers and rollators. We go at your loved one's pace, with built-in benches every 200 m. Rain plan: indoor mall walk instead.",
                        'tasks' => ['Pre-walk hydration', '20–45 min flat-path walk', 'Bench rest stops as needed', 'Rain backup at the mall'],
                    ],
                ],
            ],
            [
                'email' => 'caregiver2@kindredcare.ca',
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
                        'category' => 'errands-shopping',
                        'title' => 'On-demand errand runs — same-day',
                        'rate' => 28.00,
                        'description' => 'One-off pickups when something runs out. Bank deposit, dry-cleaning, gift shop, anything within Durham. Text me by 10 AM, done by dinner.',
                        'tasks' => ['Single-store / single-stop pickup', 'Bank or post office stops', 'Door-to-door delivery', 'Photo confirmation on text'],
                    ],
                    [
                        'category' => 'meal-preparation',
                        'title' => 'Two-hour meal prep — three days of meals',
                        'rate' => 28.00,
                        'description' => 'I cook three days of fresh, simple meals from your favourite cuisine. Diabetic-friendly and low-sodium options available. I leave the kitchen cleaner than I found it.',
                        'tasks' => ['Meal planning around dietary needs', 'Cooking 3 days of meals', 'Portioning and labelling', 'Kitchen cleanup'],
                    ],
                    [
                        'category' => 'meal-preparation',
                        'title' => 'Single hot-meal visit — eat together',
                        'rate' => 28.00,
                        'description' => 'Sometimes the company matters as much as the meal. I cook a fresh hot lunch or dinner, plate it nicely, and we eat together. Two hours, including dishes.',
                        'tasks' => ['Single fresh meal cooked on-site', 'Eat together at the table', 'Conversation & companionship', 'Dishes done before I leave'],
                    ],
                ],
            ],
            [
                'email' => 'caregiver3@kindredcare.ca',
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
                    [
                        'category' => 'tech-help',
                        'title' => 'Online banking & scam-spotting — one-on-one',
                        'rate' => 30.00,
                        'description' => "I walk through their bank's app together, set up alerts and limits, and we role-play five common scams (the CRA call, the grandkid emergency, the gift-card pay) so they recognize them.",
                        'tasks' => ['Banking-app setup with alerts', 'Two-factor login walkthrough', 'Five common-scam roleplays', 'Quick-reference fridge magnet'],
                    ],
                    [
                        'category' => 'tech-help',
                        'title' => 'Photos & video calls with the grandkids',
                        'rate' => 30.00,
                        'description' => "Get FaceTime / WhatsApp / Google Meet set up for the kid line, with the grandkids' contacts pinned to the home screen. We do a real call together so they see it work end-to-end.",
                        'tasks' => ['Pinned contacts for grandkids', 'Test call together with the family', 'Photo gallery sync setup', 'Cheat-sheet by the phone'],
                    ],
                    [
                        'category' => 'tech-help',
                        'title' => 'Tech anxiety calm-down — first-time setup',
                        'rate' => 30.00,
                        'description' => "For someone who's avoided their new device because it feels overwhelming. We go slow. Start with one button. Build up. By the end of two hours they'll have done a video call themselves.",
                        'tasks' => ['Confidence-building first steps', 'Single-task milestones', 'Plain-English glossary', 'No-jargon next-steps list'],
                    ],
                ],
            ],
            [
                'email' => 'caregiver4@kindredcare.ca',
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
                        'category' => 'walking-companion',
                        'title' => 'Evening reflective-vest walks — winter-ready',
                        'rate' => 22.00,
                        'description' => "After-dark walks aren't off the table. I bring two reflective vests and a flashlight. Routes stay on lit residential streets. Safer than skipping the walk altogether.",
                        'tasks' => ['Reflective gear for both of us', 'Lit-street route only', 'Headlamp for tricky sections', 'Phone share-location with family'],
                    ],
                    [
                        'category' => 'gardening',
                        'title' => 'Light garden tidy-up — weekly visit',
                        'rate' => 22.00,
                        'description' => 'Weeding, deadheading, watering, light pruning. I bring my own gloves and shears. Yard waste bagged and curbside.',
                        'tasks' => ['Weeding flowerbeds', 'Deadheading & light pruning', 'Watering pots & beds', 'Yard waste bagging'],
                    ],
                    [
                        'category' => 'gardening',
                        'title' => 'Patio container watering — drop-in visits',
                        'rate' => 22.00,
                        'description' => "For loved ones who care about their patio pots but can't kneel any more. I do a 30-minute drop-in: water, deadhead, prune, and send a photo of the patio when I leave.",
                        'tasks' => ['Watering all containers', 'Deadheading spent blooms', 'Quick weed pull', 'Photo update on text'],
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
        // family1 represents the family-arranges-care flow (one parent recipient)
        // family2 represents the senior-self flow (recipient = the user themselves)
        $families = [
            [
                'email' => 'family1@kindredcare.ca',
                'name' => 'Mohammad Rahman',
                'phone' => '+1 905 555 0201',
                'relationship' => 'parent',
                'recipients' => [
                    [
                        'name' => 'Salma Rahman',
                        'street_address' => '42 Maple Crescent, Oshawa',
                        'postal_code' => 'L1J 5K2',
                        'age' => 78,
                        'language' => 'Bengali',
                        'interests' => ['gardening', 'morning walks', 'tea'],
                        'accessibility_notes' => 'Uses a walker; arthritis in both knees.',
                    ],
                ],
            ],
            [
                'email' => 'family2@kindredcare.ca',
                'name' => 'Priya Patel',
                'phone' => '+1 905 555 0202',
                'relationship' => 'self',
                'recipients' => [
                    [
                        // Self-flow: recipient name matches user.name.
                        'name' => 'Priya Patel',
                        'street_address' => '108 Stevenson Rd N, Oshawa',
                        'postal_code' => 'L1H 7K4',
                        'age' => 71,
                        'language' => 'English',
                        'interests' => ['reading', 'cards', 'CBC radio'],
                        'accessibility_notes' => 'Mild hearing loss in the left ear.',
                    ],
                ],
            ],
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

            $profile = FamilyProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'relationship' => $fam['relationship'],
                    'postal_code' => 'L1H 7K4',
                    'city' => 'Oshawa',
                    'onboarding_complete' => true,
                ],
            );

            foreach ($fam['recipients'] as $r) {
                CareRecipient::updateOrCreate(
                    ['family_profile_id' => $profile->id, 'name' => $r['name']],
                    [
                        'street_address' => $r['street_address'],
                        'postal_code' => $r['postal_code'],
                        'age' => $r['age'],
                        'language' => $r['language'],
                        'interests' => $r['interests'],
                        'accessibility_notes' => $r['accessibility_notes'],
                    ],
                );
            }
        }
    }
}
