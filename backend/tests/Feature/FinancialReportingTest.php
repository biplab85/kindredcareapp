<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinancialReportingTest extends TestCase
{
    use RefreshDatabase;

    private const OSHAWA_LAT = 43.8975;

    private const OSHAWA_LNG = -78.8658;

    protected function setUp(): void
    {
        $this->markTestSkipped(
            'Legacy gig-schema fixture (pre-Fiverr pivot). Re-enable per file as fixtures are migrated to the caregiver-owned Gig model.',
        );
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── Annual earnings statement ────────────── */

    public function test_caregiver_can_download_own_annual_statement(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        $year = (int) now()->format('Y');

        // Three completed bookings this year.
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(3)->setDay(5));
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(7)->setDay(12));
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(11)->setDay(1));

        // One from last year — should not be counted.
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year - 1)->setMonth(6)->setDay(15));

        Sanctum::actingAs($caregiver->user);

        $response = $this->getJson("/api/me/earnings/statement/{$year}")->assertOk();

        $response->assertJsonPath('data.year', $year);
        $response->assertJsonPath('data.totals.visits', 3);
        $response->assertJsonPath('data.totals.gross_cents', 5000 * 3);
        $response->assertJsonPath('data.totals.fee_cents', 375 * 3);
        $response->assertJsonPath('data.totals.net_cents', 4625 * 3);
        $response->assertJsonPath('data.t4a.box_048_cents', 5000 * 3);
    }

    public function test_t4a_threshold_flag_fires_only_above_500(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();

        $year = (int) now()->format('Y');

        // $50 gross — well under the $500 T4A threshold.
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(4));

        Sanctum::actingAs($caregiver->user);

        $response = $this->getJson("/api/me/earnings/statement/{$year}")->assertOk();
        $response->assertJsonPath('data.t4a.over_threshold', false);
    }

    public function test_family_cannot_access_earnings_statement(): void
    {
        $family = $this->familyWithProfile();
        $year = (int) now()->format('Y');

        Sanctum::actingAs($family->user);

        $this->getJson("/api/me/earnings/statement/{$year}")->assertForbidden();
    }

    public function test_statement_only_counts_own_bookings(): void
    {
        $family = $this->familyWithProfile();
        $me = $this->verifiedCaregiver();
        $other = $this->verifiedCaregiver();

        $year = (int) now()->format('Y');

        $this->makeCapturedBooking($family, $me, now()->setYear($year)->setMonth(5));
        $this->makeCapturedBooking($family, $other, now()->setYear($year)->setMonth(5));

        Sanctum::actingAs($me->user);

        $response = $this->getJson("/api/me/earnings/statement/{$year}")->assertOk();
        $response->assertJsonPath('data.totals.visits', 1);
    }

    public function test_statement_year_range_is_validated(): void
    {
        $caregiver = $this->verifiedCaregiver();
        Sanctum::actingAs($caregiver->user);

        $this->getJson('/api/me/earnings/statement/2019')->assertStatus(422);
        $this->getJson('/api/me/earnings/statement/9999')->assertStatus(422);
    }

    /* ────────────── Admin revenue report ────────────── */

    public function test_admin_revenue_endpoint_buckets_by_month_by_default(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $admin = $this->adminUser();

        // Two bookings in March, one in April — same year.
        $year = (int) now()->format('Y');
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(3)->setDay(2));
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(3)->setDay(20));
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(4)->setDay(10));

        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/admin/revenue?from={$year}-01-01&to={$year}-12-31")->assertOk();

        $response->assertJsonPath('data.period', 'monthly');
        $this->assertCount(2, $response->json('data.series'));

        $march = collect($response->json('data.series'))->first(fn ($row) => str_contains($row['label'], 'March'));
        $this->assertNotNull($march);
        $this->assertSame(2, $march['visits']);
        $this->assertSame(5000 * 2, $march['gmv_cents']);
        $this->assertSame(375 * 2, $march['commission_cents']);

        $response->assertJsonPath('data.totals.visits', 3);
        $response->assertJsonPath('data.totals.commission_cents', 375 * 3);
    }

    public function test_admin_revenue_respects_period_parameter(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $admin = $this->adminUser();

        $year = (int) now()->format('Y');
        // Two bookings on the same day.
        $day = now()->setYear($year)->setMonth(6)->setDay(15);
        $this->makeCapturedBooking($family, $caregiver, $day->copy());
        $this->makeCapturedBooking($family, $caregiver, $day->copy());

        Sanctum::actingAs($admin);

        $daily = $this->getJson("/api/admin/revenue?period=daily&from={$year}-06-01&to={$year}-06-30")->assertOk();
        $daily->assertJsonPath('data.period', 'daily');
        $this->assertCount(1, $daily->json('data.series'));
        $this->assertSame(2, $daily->json('data.series.0.visits'));
    }

    public function test_family_cannot_access_admin_revenue(): void
    {
        $family = $this->familyWithProfile();
        Sanctum::actingAs($family->user);

        $this->getJson('/api/admin/revenue')->assertForbidden();
    }

    public function test_caregiver_cannot_access_admin_revenue(): void
    {
        $caregiver = $this->verifiedCaregiver();
        Sanctum::actingAs($caregiver->user);

        $this->getJson('/api/admin/revenue')->assertForbidden();
    }

    public function test_guest_cannot_access_admin_revenue(): void
    {
        $this->getJson('/api/admin/revenue')->assertUnauthorized();
    }

    public function test_admin_revenue_rejects_invalid_period(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/revenue?period=quarterly')->assertStatus(422);
    }

    public function test_admin_revenue_includes_refund_subtractions(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $admin = $this->adminUser();

        $year = (int) now()->format('Y');

        // One captured, one refunded — same month.
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(8)->setDay(5));
        $refunded = $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(8)->setDay(10));
        $refunded->update(['payment_status' => Booking::PAYMENT_REFUNDED_STUB]);

        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/admin/revenue?from={$year}-08-01&to={$year}-08-31")->assertOk();

        $this->assertSame(5000, $response->json('data.series.0.refunds_cents'));
        $this->assertSame(1, $response->json('data.totals.visits')); // only non-refunded counts toward visits
        $this->assertSame(5000, $response->json('data.totals.refunds_cents'));
    }

    public function test_admin_revenue_returns_category_breakdown_per_bucket(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $admin = $this->adminUser();
        $companionshipId = ServiceCategory::where('slug', 'companionship')->firstOrFail()->id;

        $year = (int) now()->format('Y');

        // Two captured visits in August — both companionship.
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(8)->setDay(5));
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(8)->setDay(20));

        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/admin/revenue?from={$year}-08-01&to={$year}-08-31")->assertOk();

        $this->assertSame(2, $response->json("data.series.0.categories.{$companionshipId}"));
        $this->assertSame(2, $response->json("data.totals.categories.{$companionshipId}"));

        // Catalog is returned for chart legends.
        $this->assertNotEmpty($response->json('data.categories'));
        $this->assertArrayHasKey('id', $response->json('data.categories.0'));
    }

    public function test_admin_revenue_includes_prior_period_totals(): void
    {
        $family = $this->familyWithProfile();
        $caregiver = $this->verifiedCaregiver();
        $admin = $this->adminUser();

        $year = (int) now()->format('Y');

        // One in July (the prior period when current = August).
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(7)->setDay(15));
        // One in August (current period).
        $this->makeCapturedBooking($family, $caregiver, now()->setYear($year)->setMonth(8)->setDay(15));

        Sanctum::actingAs($admin);

        $response = $this->getJson("/api/admin/revenue?from={$year}-08-01&to={$year}-08-31")->assertOk();

        $this->assertSame(1, $response->json('data.totals.visits'));
        $this->assertSame(1, $response->json('data.prior_period.totals.visits'));
        $this->assertSame(5000, $response->json('data.prior_period.totals.gmv_cents'));
        $this->assertNotNull($response->json('data.prior_period.from'));
        $this->assertNotNull($response->json('data.prior_period.to'));
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

    private function verifiedCaregiver(): CaregiverProfile
    {
        $user = User::factory()->create([
            'role' => 'caregiver',
            'email_verified_at' => now(),
            'gender' => 'female',
        ]);

        $profile = CaregiverProfile::create([
            'user_id' => $user->id,
            'bio' => 'Test caregiver.',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
            'languages' => ['English'],
        ]);

        $companionship = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $profile->services()->sync([$companionship->id]);

        foreach (VerificationRecord::ALL_CHECK_TYPES as $type) {
            VerificationRecord::create([
                'user_id' => $user->id,
                'check_type' => $type,
                'status' => VerificationRecord::STATUS_CLEARED,
                'provider' => 'manual',
            ]);
        }

        return $profile->fresh();
    }

    private function adminUser(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
    }

    private function makeGig(FamilyProfile $family, Carbon $start): Gig
    {
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();

        return Gig::create([
            'family_profile_id' => $family->id,
            'service_category_id' => $category->id,
            'description' => 'Afternoon companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => self::OSHAWA_LAT,
            'longitude' => self::OSHAWA_LNG,
            'scheduled_start' => $start,
            'scheduled_end' => (clone $start)->addHours(2),
            'status' => Gig::STATUS_COMPLETED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);
    }

    private function makeCapturedBooking(FamilyProfile $family, CaregiverProfile $caregiver, Carbon $checkOutAt): Booking
    {
        $checkInAt = $checkOutAt->copy()->subHours(2);
        $gig = $this->makeGig($family, $checkInAt);

        return Booking::create([
            'gig_id' => $gig->id,
            'caregiver_user_id' => $caregiver->user_id,
            'family_profile_id' => $family->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $checkInAt,
            'scheduled_end' => $checkOutAt,
            'address_full' => $gig->location_address,
            'address_neighbourhood' => 'Oshawa',
            'response_deadline_at' => CarbonImmutable::now()->subDays(7),
            'responded_at' => $checkInAt->copy()->subMinutes(30),
            'check_in_at' => $checkInAt,
            'check_in_lat' => self::OSHAWA_LAT,
            'check_in_lng' => self::OSHAWA_LNG,
            'check_in_distance_m' => 10,
            'check_out_at' => $checkOutAt,
            'check_out_lat' => self::OSHAWA_LAT,
            'check_out_lng' => self::OSHAWA_LNG,
            'check_out_distance_m' => 12,
        ]);
    }
}
