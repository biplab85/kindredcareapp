<?php

namespace Tests\Feature;

use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GigFeedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── helpers ────────────── */

    private function caregiverUser(array $serviceSlugs = ['companionship']): User
    {
        $user = User::factory()->create([
            'role' => 'caregiver',
            'email_verified_at' => now(),
        ])->fresh();

        $profile = CaregiverProfile::create([
            'user_id' => $user->id,
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
        ]);

        if (! empty($serviceSlugs)) {
            $ids = ServiceCategory::whereIn('slug', $serviceSlugs)->pluck('id')->all();
            $profile->services()->sync($ids);
        }

        return $user->fresh();
    }

    private function familyWithProfile(): FamilyProfile
    {
        $user = User::factory()->create([
            'role' => 'family',
            'email_verified_at' => now(),
        ]);

        return FamilyProfile::create(['user_id' => $user->id, 'relationship' => 'parent']);
    }

    private function makeGig(int $familyProfileId, string $categorySlug, array $overrides = []): Gig
    {
        $category = ServiceCategory::where('slug', $categorySlug)->firstOrFail();

        return Gig::create(array_merge([
            'family_profile_id' => $familyProfileId,
            'service_category_id' => $category->id,
            'description' => 'A generic gig description long enough to pass validation',
            'location_address' => '123 Main St',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'scheduled_start' => now()->addDays(2),
            'scheduled_end' => now()->addDays(2)->addHours(3),
            'status' => Gig::STATUS_OPEN,
            'posting_mode' => Gig::POSTING_OPEN,
        ], $overrides));
    }

    /* ────────────── /api/gigs/feed ────────────── */

    public function test_caregiver_sees_only_open_gigs_matching_offered_services(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();

        $match = $this->makeGig($family->id, 'companionship');
        $otherService = $this->makeGig($family->id, 'tech-help'); // caregiver does not offer this
        $cancelled = $this->makeGig($family->id, 'companionship', ['status' => Gig::STATUS_CANCELLED]);

        Sanctum::actingAs($caregiver);

        $response = $this->getJson('/api/gigs/feed');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($match->id, $ids);
        $this->assertNotContains($otherService->id, $ids);
        $this->assertNotContains($cancelled->id, $ids);
    }

    public function test_caregiver_with_no_services_gets_empty_feed(): void
    {
        $caregiver = $this->caregiverUser([]);
        $family = $this->familyWithProfile();
        $this->makeGig($family->id, 'companionship');

        Sanctum::actingAs($caregiver);

        $response = $this->getJson('/api/gigs/feed');

        $response->assertOk();
        $this->assertSame([], $response->json('data'));
    }

    public function test_family_cannot_access_feed(): void
    {
        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->getJson('/api/gigs/feed')->assertForbidden();
    }

    public function test_guest_cannot_access_feed(): void
    {
        $this->getJson('/api/gigs/feed')->assertUnauthorized();
    }

    public function test_feed_redacts_exact_address(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();
        $this->makeGig($family->id, 'companionship', [
            'location_address' => '123 Secret Lane',
        ]);

        Sanctum::actingAs($caregiver);

        $response = $this->getJson('/api/gigs/feed');

        $response->assertOk();
        $payload = $response->json('data.0');
        $this->assertArrayNotHasKey('location_address', $payload);
        $this->assertArrayHasKey('neighbourhood', $payload);
        $this->assertArrayHasKey('label', $payload['neighbourhood']);
        $this->assertStringStartsWith('Near ', $payload['neighbourhood']['label']);
    }

    public function test_feed_respects_service_filter(): void
    {
        $caregiver = $this->caregiverUser(['companionship', 'tech-help']);
        $family = $this->familyWithProfile();

        $comp = $this->makeGig($family->id, 'companionship');
        $tech = $this->makeGig($family->id, 'tech-help');

        Sanctum::actingAs($caregiver);

        $response = $this->getJson('/api/gigs/feed?service=tech-help');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$tech->id], $ids);
        $this->assertNotContains($comp->id, $ids);
    }

    public function test_feed_rejects_unknown_service_filter(): void
    {
        Sanctum::actingAs($this->caregiverUser(['companionship']));

        $this->getJson('/api/gigs/feed?service=not-a-service')->assertStatus(422);
    }

    public function test_feed_hides_past_gigs(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();

        $this->makeGig($family->id, 'companionship', [
            'scheduled_start' => now()->subDay(),
            'scheduled_end' => now()->subDay()->addHours(2),
        ]);

        Sanctum::actingAs($caregiver);

        $this->getJson('/api/gigs/feed')->assertOk()->assertJsonCount(0, 'data');
    }

    /* ────────────── /api/gigs/{id} as caregiver ────────────── */

    public function test_caregiver_can_view_matching_open_gig(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family->id, 'companionship');

        Sanctum::actingAs($caregiver);

        $response = $this->getJson("/api/gigs/{$gig->id}");

        $response->assertOk();
        $this->assertArrayNotHasKey('location_address', $response->json('data'));
        $this->assertArrayHasKey('neighbourhood', $response->json('data'));
    }

    public function test_caregiver_cannot_view_gig_for_service_they_dont_offer(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family->id, 'tech-help');

        Sanctum::actingAs($caregiver);

        $this->getJson("/api/gigs/{$gig->id}")->assertForbidden();
    }

    public function test_caregiver_cannot_view_cancelled_gig(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family->id, 'companionship', ['status' => Gig::STATUS_CANCELLED]);

        Sanctum::actingAs($caregiver);

        $this->getJson("/api/gigs/{$gig->id}")->assertForbidden();
    }

    public function test_feed_hides_gigs_in_matched_posting_mode(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();
        $this->makeGig($family->id, 'companionship', [
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        Sanctum::actingAs($caregiver);

        $this->getJson('/api/gigs/feed')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_caregiver_cannot_view_matched_mode_gig_directly(): void
    {
        $caregiver = $this->caregiverUser(['companionship']);
        $family = $this->familyWithProfile();
        $gig = $this->makeGig($family->id, 'companionship', [
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        Sanctum::actingAs($caregiver);

        $this->getJson("/api/gigs/{$gig->id}")->assertForbidden();
    }
}
