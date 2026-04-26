<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 14 cleanup — admin-account CRUD + demand-density view.
 */
class AdminAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── admin CRUD ────────────── */

    public function test_only_admins_can_list_admins(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'caregiver']));
        $this->getJson('/api/admin/admins')->assertForbidden();
    }

    public function test_admin_can_create_another_admin(): void
    {
        $actor = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($actor);

        $this->postJson('/api/admin/admins', [
            'name' => 'New Admin',
            'email' => 'new-admin@kindred.test',
        ])->assertCreated()
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', [
            'email' => 'new-admin@kindred.test',
            'role' => 'admin',
        ]);

        $this->assertNotNull(
            AdminAuditLog::query()->where('action', 'admin.created')->first(),
        );
    }

    public function test_admin_create_rejects_duplicate_email(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        User::factory()->create(['email' => 'taken@kindred.test']);

        $this->postJson('/api/admin/admins', [
            'name' => 'Dupe',
            'email' => 'taken@kindred.test',
        ])->assertStatus(422);
    }

    public function test_admin_can_rename_another_admin(): void
    {
        $actor = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'admin', 'name' => 'Old Name']);
        Sanctum::actingAs($actor);

        $this->patchJson("/api/admin/admins/{$target->id}", [
            'name' => 'New Name',
        ])->assertOk();

        $this->assertSame('New Name', $target->fresh()->name);
        $this->assertNotNull(
            AdminAuditLog::query()->where('action', 'admin.updated')->first(),
        );
    }

    public function test_update_on_non_admin_returns_422(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $caregiver = User::factory()->create(['role' => 'caregiver']);

        $this->patchJson("/api/admin/admins/{$caregiver->id}", [
            'name' => 'Try to rename a caregiver',
        ])->assertStatus(422);
    }

    public function test_admin_can_deactivate_another_admin(): void
    {
        $actor = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['role' => 'admin']);
        // Active token to confirm revocation.
        $token = $target->createToken('s');
        $this->assertSame(1, $target->tokens()->count());

        Sanctum::actingAs($actor);

        $this->deleteJson("/api/admin/admins/{$target->id}")->assertOk();

        $this->assertSame('suspended', $target->fresh()->status);
        $this->assertSame(0, $target->tokens()->count());
        $this->assertNotNull(
            AdminAuditLog::query()->where('action', 'admin.deactivated')->first(),
        );
        unset($token);
    }

    public function test_admin_cannot_deactivate_self(): void
    {
        $actor = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($actor);

        $this->deleteJson("/api/admin/admins/{$actor->id}")->assertStatus(422);
    }

    /* ────────────── demand density ────────────── */

    public function test_demand_density_summarizes_recent_bookings_and_caregiver_supply(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        // Two bookings in Oshawa, one in Whitby — recent.
        $this->makeBooking('Oshawa');
        $this->makeBooking('Oshawa');
        $this->makeBooking('Whitby');

        // A handful of caregivers near Durham Region.
        $this->makeCaregiver(43.90, -78.86);
        $this->makeCaregiver(43.90, -78.86);
        $this->makeCaregiver(43.88, -78.94);

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/admin/demand-density?days=60')->assertOk();

        $demand = $response->json('data.demand');
        $this->assertSame('Oshawa', $demand[0]['area']);
        $this->assertSame(2, $demand[0]['bookings']);

        $supply = $response->json('data.supply');
        $this->assertGreaterThanOrEqual(1, count($supply));

        $this->assertSame(3, $response->json('data.totals.active_caregivers'));
    }

    private function makeBooking(string $neighbourhood): void
    {
        $caregiver = User::factory()->create(['role' => 'caregiver']);
        $family = User::factory()->create(['role' => 'family']);
        $familyProfile = FamilyProfile::create([
            'user_id' => $family->id,
            'relationship' => 'parent',
        ]);
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $start = now()->subDays(10)->setTime(10, 0);

        $gig = Gig::create([
            'family_profile_id' => $familyProfile->id,
            'service_category_id' => $category->id,
            'description' => 'Visit.',
            'location_address' => "123 Main St, {$neighbourhood} ON",
            'latitude' => 43.9,
            'longitude' => -78.86,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addHours(2),
            'status' => Gig::STATUS_BOOKED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        Booking::create([
            'gig_id' => $gig->id,
            'family_profile_id' => $familyProfile->id,
            'caregiver_user_id' => $caregiver->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_COMPLETED,
            'payment_status' => Booking::PAYMENT_CAPTURED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addHours(2),
            'response_deadline_at' => $start->copy()->subHours(4),
            'responded_at' => $start->copy()->subHours(5),
            'address_full' => "123 Main St, {$neighbourhood} ON",
            'address_neighbourhood' => $neighbourhood,
        ]);
    }

    private function makeCaregiver(float $lat, float $lng): void
    {
        $user = User::factory()->create(['role' => 'caregiver', 'status' => 'active']);
        CaregiverProfile::create([
            'user_id' => $user->id,
            'latitude' => $lat,
            'longitude' => $lng,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
        ]);
    }
}
