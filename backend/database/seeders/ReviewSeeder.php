<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Review;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Sample public reviews so caregiver profile pages and the admin "Quality
 * pulse" card show real ratings instead of an empty state, and caregivers
 * cross the 3-review threshold into a ranked Trust Score bucket.
 *
 * Idempotent per-booking: one review per completed booking (the booking's
 * family is the rater, the caregiver the ratee). A booking that already has a
 * review is skipped, so re-running never duplicates and genuine reviews are
 * left untouched. Covers every caregiver that has completed bookings.
 */
class ReviewSeeder extends Seeder
{
    /**
     * Per-caregiver pools of [stars, body]. Reviews are paired to the
     * caregiver's completed bookings in order; pools repeat if a caregiver
     * has more bookings than lines. A default pool covers anyone else.
     *
     * @var array<string, list<array{0:int,1:string}>>
     */
    private array $reviewsByEmail = [
        'caregiver1@kindredcare.ca' => [
            [5, 'Sarah was wonderful with my mother — patient, warm, and right on time. We booked her again the same week.'],
            [5, 'Genuinely caring and dependable. Mom looks forward to her visits now.'],
            [4, 'Great companionship and very reliable. Communication could be a touch faster, but no complaints overall.'],
            [5, 'Above and beyond. Took Mom on a gentle walk and sent us photos afterward. Highly recommend.'],
            [4, 'Lovely with my father. Punctual and kind. Would book again.'],
            [5, 'Trustworthy and attentive — exactly what our family needed.'],
            [3, 'Good visit overall; arrived a little late but kept us informed and made up the time.'],
        ],
        'caregiver2@kindredcare.ca' => [
            [5, 'So patient and easy to talk to. Dad warmed up to him right away.'],
            [4, 'Reliable and respectful. Showed up prepared and kept us in the loop.'],
            [5, 'Handled a tricky afternoon with real grace. We felt completely at ease.'],
            [4, 'Friendly, professional, and on time every visit. Recommend.'],
        ],
        'caregiver3@kindredcare.ca' => [
            [5, 'Kind, calm, and genuinely attentive. Mom felt safe the whole time.'],
            [4, 'Good with errands and great company. A pleasure to work with.'],
        ],
        'caregiver4@kindredcare.ca' => [
            [5, 'Emily was fantastic — gentle, organised, and wonderful company for my aunt.'],
            [5, 'Punctual, warm, and very thoughtful. She left detailed notes after every visit.'],
            [4, 'Lovely with my mother and very dependable. Would happily book again.'],
        ],
    ];

    /** @var list<array{0:int,1:string}> */
    private array $defaultReviews = [
        [5, 'Caring, dependable, and a real comfort to our family. Highly recommend.'],
        [4, 'Punctual and professional. A genuinely good visit.'],
        [5, 'Went above and beyond — attentive and kind throughout.'],
    ];

    public function run(): void
    {
        $caregivers = User::where('role', 'caregiver')->orderBy('id')->get();
        if ($caregivers->isEmpty()) {
            $this->command->warn('No caregivers found — run TestUsersSeeder first. Nothing seeded.');

            return;
        }

        $now = Carbon::now();
        $created = 0;

        foreach ($caregivers as $caregiver) {
            $bookings = Booking::with('familyProfile')
                ->where('caregiver_user_id', $caregiver->id)
                ->where('status', Booking::STATUS_COMPLETED)
                ->orderBy('id')
                ->get();

            if ($bookings->isEmpty()) {
                continue;
            }

            $pool = $this->reviewsByEmail[$caregiver->email] ?? $this->defaultReviews;

            foreach ($bookings as $i => $booking) {
                // Skip bookings that already carry a review (keeps re-runs idempotent
                // and preserves genuine reviews).
                if (Review::where('booking_id', $booking->id)->exists()) {
                    continue;
                }

                $rater = $booking->familyProfile?->user_id;
                if (! $rater) {
                    continue;
                }

                [$stars, $body] = $pool[$i % count($pool)];
                $submitted = $now->copy()->subDays(($bookings->count() - $i) * 2 + 1);

                Review::create([
                    'booking_id' => $booking->id,
                    'rater_user_id' => $rater,
                    'ratee_user_id' => $caregiver->id,
                    'stars' => $stars,
                    'body' => $body,
                    'submitted_at' => $submitted,
                    // Visible immediately so it counts toward public aggregates.
                    'visible_at' => $submitted,
                ]);
                $created++;
            }
        }

        $this->command->info("Seeded {$created} public reviews across {$caregivers->count()} caregivers.");
    }
}
