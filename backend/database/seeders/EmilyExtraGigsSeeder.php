<?php

namespace Database\Seeders;

use App\Models\CaregiverProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Adds five extra gigs to the seeded caregiver "Emily Chen"
 * (caregiver4@kindredcare.ca), each in a distinct service category so the
 * /me/gigs grid renders a title-appropriate image per card.
 *
 * Idempotent: gigs key on (caregiver_profile_id, title) and service
 * categories attach via syncWithoutDetaching, so re-running is a no-op.
 * Deliberately standalone — it never touches the rest of TestUsersSeeder's
 * cast, so existing gigs/families keep their current state.
 */
class EmilyExtraGigsSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::where('email', 'caregiver4@kindredcare.ca')->first();
        if (! $user) {
            $this->command?->warn('EmilyExtraGigsSeeder: caregiver4@kindredcare.ca not found — run TestUsersSeeder first.');

            return;
        }

        $profile = CaregiverProfile::where('user_id', $user->id)->first();
        if (! $profile) {
            $this->command?->warn('EmilyExtraGigsSeeder: no caregiver profile for Emily — skipping.');

            return;
        }

        $categoryIds = ServiceCategory::pluck('id', 'slug');

        // Title → real photo. Stored as the gig's photo_path so the SAME image
        // shows on the grid, the detail page, and the marketplace (the grid no
        // longer relies on a frontend-only stock picker). Absolute URLs pass
        // through GigResource::resolvePhotoUrl untouched.
        $photos = [
            'Mid-day walking companion — Oshawa parks' => $this->img('1447752875215-b2761acb3c5d'),
            'Evening reflective-vest walks — winter-ready' => $this->img('1441974231531-c6227db76b6e'),
            'Light garden tidy-up — weekly visit' => $this->img('1466692476868-aef1dfb1e735'),
            'Patio container watering — drop-in visits' => $this->img('1416879595882-3373a0480b5b'),
            'Afternoon tea & friendly company' => $this->img('1495474472287-4d71bcdd2085'),
            'Smartphone & video-call setup help' => $this->img('1517336714731-489689fd1ca8'),
            'Home-cooked meal prep & batch cooking' => $this->img('1512621776951-a57141f2eefd'),
            'Weekly grocery run & pharmacy pickup' => $this->img('1542838132-92c53300491e'),
            'Door-to-door appointment rides' => $this->img('1449965408869-eaa3f722e40d'),
        ];

        $gigs = [
            [
                'category' => 'companionship',
                'title' => 'Afternoon tea & friendly company',
                'rate' => 24.00,
                'description' => 'A standing visit for conversation, card games, or just sitting together over a pot of tea. Good for loved ones who are home alone most of the day and could use a familiar face.',
                'tasks' => ['Tea & a chat', 'Cards, puzzles or reminiscing', 'Light tidy of the sitting area', 'Text recap to family after'],
            ],
            [
                'category' => 'tech-help',
                'title' => 'Smartphone & video-call setup help',
                'rate' => 28.00,
                'description' => "Patient, no-jargon help getting set up on video calls, messaging the grandkids, or sorting out a phone that's 'doing something weird'. I write the steps down so they stick.",
                'tasks' => ['Video-call setup (FaceTime/WhatsApp)', 'Contacts & photos sorting', 'Scam-text safety basics', 'Written cheat-sheet left behind'],
            ],
            [
                'category' => 'meal-preparation',
                'title' => 'Home-cooked meal prep & batch cooking',
                'rate' => 26.00,
                'description' => "I cook a few days of meals to your loved one's taste and dietary needs, portion them, and label everything for the fridge or freezer. Kitchen left spotless.",
                'tasks' => ['Plan 3–4 meals together', 'Cook & portion for the week', 'Label & date containers', 'Wash up & wipe down'],
            ],
            [
                'category' => 'errands-shopping',
                'title' => 'Weekly grocery run & pharmacy pickup',
                'rate' => 23.00,
                'description' => "Hand me the list (or we build one together) and I'll do the grocery shop and pharmacy pickup. Receipts and change back every time, fridge restocked before I go.",
                'tasks' => ['Grocery shop to a list', 'Pharmacy / prescription pickup', 'Put everything away', 'Receipts & change returned'],
            ],
            [
                'category' => 'transportation',
                'title' => 'Door-to-door appointment rides',
                'rate' => 25.00,
                'description' => 'Safe, unhurried rides to medical appointments, the hairdresser, or visiting friends. I help to and from the car and either wait or come back, whichever you prefer.',
                'tasks' => ['Door-to-door assistance', 'Help in & out of the car', 'Wait or return for pickup', 'Text family on drop-off'],
            ],
        ];

        foreach ($gigs as $gig) {
            $categoryId = $categoryIds[$gig['category']] ?? null;
            if (! $categoryId) {
                $this->command?->warn("EmilyExtraGigsSeeder: category '{$gig['category']}' missing — skipping gig.");

                continue;
            }

            // Keep the profile's service list in step with the new gig so the
            // caregiver reads as genuinely offering it.
            $profile->services()->syncWithoutDetaching([
                $categoryId => ['years_experience' => $profile->years_of_experience ?? 1],
            ]);

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
                    'photo_path' => $photos[$gig['title']] ?? $profile->photo_path,
                    'status' => 'published',
                    'published_at' => now(),
                ],
            );
        }

        // Re-point Emily's original gigs at a title-matching photo too, so the
        // stored image is consistent with the new ones everywhere it renders.
        foreach ($photos as $title => $url) {
            Gig::where('caregiver_profile_id', $profile->id)
                ->where('title', $title)
                ->update(['photo_path' => $url]);
        }

        $this->command?->info('EmilyExtraGigsSeeder: 5 gigs + 9 photos ensured for Emily Chen.');
    }

    /** Build a stable Unsplash delivery URL for a given photo id. */
    private function img(string $id): string
    {
        return "https://images.unsplash.com/photo-{$id}?auto=format&fit=crop&w=1200&q=80";
    }
}
