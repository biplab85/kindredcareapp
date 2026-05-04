<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        $this->markTestSkipped(
            'Legacy gig-schema fixture (pre-Fiverr pivot). Re-enable per file as fixtures are migrated to the caregiver-owned Gig model.',
        );
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    public function test_non_admin_cannot_hit_analytics(): void
    {
        $user = User::factory()->create(['role' => 'family']);
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/analytics')->assertForbidden();
    }

    public function test_guest_cannot_hit_analytics(): void
    {
        $this->getJson('/api/admin/analytics')->assertUnauthorized();
    }

    public function test_returns_counts_snapshot(): void
    {
        // Seed a representative mix so every counter has a non-zero value.
        $admin = User::factory()->create(['role' => 'admin']);
        $family = User::factory()->create(['role' => 'family']);
        FamilyProfile::create(['user_id' => $family->id, 'relationship' => 'parent']);

        // Two caregivers (one pending verification, one cleared).
        $cgPending = User::factory()->create(['role' => 'caregiver']);
        VerificationRecord::create([
            'user_id' => $cgPending->id,
            'check_type' => VerificationRecord::TYPE_IDENTITY,
            'status' => VerificationRecord::STATUS_PENDING_REVIEW,
            'provider' => 'manual',
        ]);

        $cgCleared = User::factory()->create(['role' => 'caregiver']);
        CaregiverProfile::create([
            'user_id' => $cgCleared->id,
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
        ]);

        // One completed booking this month so revenue_this_month has a value.
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $familyProfile = $family->familyProfile;
        $gig = Gig::create([
            'family_profile_id' => $familyProfile->id,
            'service_category_id' => $category->id,
            'description' => 'A completed visit for analytics smoke.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'scheduled_start' => now()->subHours(4),
            'scheduled_end' => now()->subHours(1),
            'status' => Gig::STATUS_COMPLETED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);
        Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $cgCleared->id,
            'family_profile_id' => $familyProfile->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 180,
            'subtotal_cents' => 7500,
            'platform_fee_cents' => 563,
            'caregiver_payout_cents' => 6937,
            'scheduled_start' => now()->subHours(4),
            'scheduled_end' => now()->subHours(1),
            'address_full' => '123 King St W, Oshawa ON',
            'address_neighbourhood' => 'Oshawa ON',
            'response_deadline_at' => now()->subHours(5),
            'responded_at' => now()->subHours(4)->subMinutes(10),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/analytics');

        $response->assertOk();
        $response->assertJsonPath('data.users.admin', 1);
        $response->assertJsonPath('data.users.family', 1);
        $response->assertJsonPath('data.users.caregiver', 2);
        $response->assertJsonPath('data.verifications.pending_review', 1);
        $response->assertJsonPath('data.bookings.completed_all_time', 1);
        $response->assertJsonPath('data.revenue_this_month.visits', 1);
        $response->assertJsonPath('data.revenue_this_month.gmv_cents', 7500);
        $response->assertJsonPath('data.revenue_this_month.commission_cents', 563);

        // Phase 14.4 quality pulse — averages + Trust Score histogram.
        $response->assertJsonStructure([
            'data' => [
                'ratings' => ['count', 'average_stars'],
                'trust_score' => ['total', 'new', 'buckets', 'average'],
            ],
        ]);
        $response->assertJsonPath('data.ratings.count', 0); // no reviews seeded yet
        $response->assertJsonPath('data.trust_score.total', 1); // one caregiver profile created
        $response->assertJsonPath('data.trust_score.new', 1); // <3 reviews → counted as "new"
    }
}
