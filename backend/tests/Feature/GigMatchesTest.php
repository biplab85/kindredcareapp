<?php

namespace Tests\Feature;

use App\Models\CaregiverProfile;
use App\Models\CareRecipient;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Carbon\CarbonImmutable;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GigMatchesTest extends TestCase
{
    use RefreshDatabase;

    // Durham Region anchor point — the Oshawa centroid used across the app.
    private const OSHAWA_LAT = 43.8975;

    private const OSHAWA_LNG = -78.8658;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── helpers ────────────── */

    private function familyWithProfile(): FamilyProfile
    {
        $user = User::factory()->create([
            'role' => 'family',
            'email_verified_at' => now(),
        ]);

        return FamilyProfile::create(['user_id' => $user->id, 'relationship' => 'parent']);
    }

    /**
     * @param  array<int|string, mixed>  $overrides
     * @param  array<int, string>  $serviceSlugs
     */
    private function verifiedCaregiver(
        array $overrides = [],
        array $serviceSlugs = ['companionship'],
        bool $fullyVerified = true,
    ): CaregiverProfile {
        $user = User::factory()->create(array_merge([
            'role' => 'caregiver',
            'email_verified_at' => now(),
            'gender' => 'female',
        ], $overrides['user'] ?? []));

        $profile = CaregiverProfile::create(array_merge([
            'user_id' => $user->id,
            'bio' => 'Warm, patient caregiver who loves walks and card games.',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
            'languages' => ['English'],
            'interests' => ['gardening', 'reading'],
            'availability' => null,
        ], array_diff_key($overrides, array_flip(['user']))));

        if (! empty($serviceSlugs)) {
            $ids = ServiceCategory::whereIn('slug', $serviceSlugs)->pluck('id')->all();
            $profile->services()->sync($ids);
        }

        if ($fullyVerified) {
            foreach (VerificationRecord::ALL_CHECK_TYPES as $type) {
                VerificationRecord::create([
                    'user_id' => $user->id,
                    'check_type' => $type,
                    'status' => VerificationRecord::STATUS_CLEARED,
                    'provider' => 'manual',
                ]);
            }
        }

        return $profile->fresh();
    }

    private function makeGig(FamilyProfile $family, array $overrides = []): Gig
    {
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();

        return Gig::create(array_merge([
            'family_profile_id' => $family->id,
            'service_category_id' => $category->id,
            'description' => 'Afternoon companionship with a walk and a chat.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'scheduled_start' => now()->addDay()->setTime(10, 0),
            'scheduled_end' => now()->addDay()->setTime(13, 0),
            'status' => Gig::STATUS_OPEN,
            'posting_mode' => Gig::POSTING_MATCHED,
        ], $overrides));
    }

    /* ────────────── authorization ────────────── */

    public function test_guest_cannot_request_matches(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);

        $this->postJson("/api/gigs/{$gig->id}/matches")->assertUnauthorized();
    }

    public function test_only_owner_can_request_matches(): void
    {
        $owner = $this->familyWithProfile();
        $stranger = $this->familyWithProfile();
        $gig = $this->makeGig($owner);

        Sanctum::actingAs($stranger->user);

        $this->postJson("/api/gigs/{$gig->id}/matches")->assertForbidden();
    }

    public function test_caregiver_cannot_request_matches_for_someones_gig(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $caregiver = $this->verifiedCaregiver();

        Sanctum::actingAs($caregiver->user);

        $this->postJson("/api/gigs/{$gig->id}/matches")->assertForbidden();
    }

    public function test_matches_require_open_status(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, ['status' => Gig::STATUS_BOOKED]);

        Sanctum::actingAs($family->user);

        $this->postJson("/api/gigs/{$gig->id}/matches")->assertStatus(422);
    }

    /* ────────────── hard filters ────────────── */

    public function test_returns_only_caregivers_offering_the_service(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);

        $offers = $this->verifiedCaregiver(serviceSlugs: ['companionship']);
        $wrongService = $this->verifiedCaregiver(serviceSlugs: ['tech-help']);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($offers->id, $ids);
        $this->assertNotContains($wrongService->id, $ids);
    }

    public function test_excludes_unverified_caregivers(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);

        $unverified = $this->verifiedCaregiver(fullyVerified: false);
        $verified = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($verified->id, $ids);
        $this->assertNotContains($unverified->id, $ids);
    }

    public function test_excludes_caregivers_outside_travel_radius(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);

        // Far-away caregiver (~100 km north) with a small radius.
        $far = $this->verifiedCaregiver([
            'latitude' => 44.8000,
            'longitude' => -78.8658,
            'travel_radius_km' => 10,
        ]);
        $near = $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($near->id, $ids);
        $this->assertNotContains($far->id, $ids);
    }

    public function test_excludes_caregivers_over_rate_cap(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, ['preferences' => ['rate_max' => 22]]);

        $expensive = $this->verifiedCaregiver(['hourly_rate' => 30]);
        $affordable = $this->verifiedCaregiver(['hourly_rate' => 20]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($affordable->id, $ids);
        $this->assertNotContains($expensive->id, $ids);
    }

    public function test_respects_gender_preference(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, ['preferences' => ['gender' => 'female']]);

        $male = $this->verifiedCaregiver(['user' => ['gender' => 'male']]);
        $female = $this->verifiedCaregiver(['user' => ['gender' => 'female']]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($female->id, $ids);
        $this->assertNotContains($male->id, $ids);
    }

    public function test_respects_language_preference(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, ['preferences' => ['language' => 'Hindi']]);

        $englishOnly = $this->verifiedCaregiver(['languages' => ['English']]);
        $bilingual = $this->verifiedCaregiver(['languages' => ['English', 'Hindi']]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($bilingual->id, $ids);
        $this->assertNotContains($englishOnly->id, $ids);
    }

    public function test_enforces_weekly_availability(): void
    {
        $family = $this->familyWithProfile();
        // Tuesday 10am–1pm local (America/Toronto) — stored UTC 14:00–17:00 during DST,
        // UTC 15:00–18:00 in standard time, both within the 09:00–17:00 availability window.
        $tuesday = now()->next('Tuesday')->setTime(14, 0);
        $gig = $this->makeGig($family, [
            'scheduled_start' => $tuesday,
            'scheduled_end' => $tuesday->copy()->addHours(3),
        ]);

        $fitsTuesday = $this->verifiedCaregiver([
            'availability' => [
                'weekly' => [
                    'tue' => [['start' => '09:00', 'end' => '17:00']],
                ],
            ],
        ]);
        $tuesdayBlocked = $this->verifiedCaregiver([
            'availability' => [
                'weekly' => [
                    'mon' => [['start' => '09:00', 'end' => '17:00']],
                    // No Tuesday ranges.
                ],
            ],
        ]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($fitsTuesday->id, $ids);
        $this->assertNotContains($tuesdayBlocked->id, $ids);
    }

    public function test_availability_is_checked_in_operating_timezone(): void
    {
        // Tue 2026-04-28 01:00–02:00 UTC is Mon 2026-04-27 21:00–22:00 America/Toronto (EDT).
        // A caregiver whose availability only has Monday evenings must still match,
        // and a caregiver whose availability only has Tuesday mornings must not.
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family, [
            'scheduled_start' => CarbonImmutable::parse('2026-04-28 01:00:00', 'UTC'),
            'scheduled_end' => CarbonImmutable::parse('2026-04-28 02:00:00', 'UTC'),
        ]);

        $mondayEvening = $this->verifiedCaregiver([
            'availability' => [
                'weekly' => [
                    'mon' => [['start' => '20:00', 'end' => '23:00']],
                ],
            ],
        ]);
        $tuesdayMorning = $this->verifiedCaregiver([
            'availability' => [
                'weekly' => [
                    'tue' => [['start' => '09:00', 'end' => '17:00']],
                ],
            ],
        ]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($mondayEvening->id, $ids, 'caregiver with local-Monday availability should match a gig whose local time is Monday evening');
        $this->assertNotContains($tuesdayMorning->id, $ids, 'caregiver whose only availability is Tuesday morning should not match a Monday-evening local gig');
    }

    /* ────────────── ranking ────────────── */

    public function test_closer_caregiver_ranks_higher_than_a_further_one(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);

        // Identical profiles except location.
        $near = $this->verifiedCaregiver([
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'user' => ['name' => 'Nora Near'],
        ]);
        $far = $this->verifiedCaregiver([
            'latitude' => self::OSHAWA_LAT + 0.15, // ~16 km north, still within 20 km radius
            'longitude' => self::OSHAWA_LNG,
            'user' => ['name' => 'Fiona Far'],
        ]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $data = $response->json('data');
        $this->assertCount(2, $data);
        $this->assertSame($near->id, $data[0]['id']);
        $this->assertSame($far->id, $data[1]['id']);
        $this->assertGreaterThan(
            $data[1]['match_components']['distance'],
            $data[0]['match_components']['distance'],
        );
    }

    public function test_result_shape_includes_components_and_meta(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);
        $this->verifiedCaregiver();

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $response->assertJsonStructure([
            'data' => [
                ['id', 'display_name', 'hourly_rate', 'distance_km', 'match_score',
                    'match_components' => ['distance', 'trust', 'overlap', 'availability', 'rate'],
                    'trust_score', 'trust_is_new'],
            ],
            'meta' => ['pool_size', 'qualifying', 'returned'],
        ]);
    }

    public function test_caps_results_at_10(): void
    {
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family);

        for ($i = 0; $i < 12; $i++) {
            $this->verifiedCaregiver();
        }

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $this->assertCount(10, $response->json('data'));
        $this->assertSame(12, $response->json('meta.qualifying'));
        $this->assertSame(10, $response->json('meta.returned'));
    }

    public function test_interest_overlap_boosts_score(): void
    {
        $family = $this->familyWithProfile();
        $recipient = CareRecipient::create([
            'family_profile_id' => $family->id,
            'name' => 'Grace',
            'interests' => ['gardening', 'reading'],
        ]);
        $gig = $this->makeGig($family, ['care_recipient_id' => $recipient->id]);

        $overlaps = $this->verifiedCaregiver([
            'interests' => ['gardening', 'reading'],
        ]);
        $noOverlap = $this->verifiedCaregiver([
            'interests' => ['cycling', 'movies'],
        ]);

        Sanctum::actingAs($family->user);

        $response = $this->postJson("/api/gigs/{$gig->id}/matches")->assertOk();

        $data = collect($response->json('data'))->keyBy('id');
        $this->assertGreaterThan(
            (int) $data[$noOverlap->id]['match_components']['overlap'],
            (int) $data[$overlaps->id]['match_components']['overlap'],
        );
    }
}
