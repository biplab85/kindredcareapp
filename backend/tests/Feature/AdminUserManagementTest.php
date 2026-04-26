<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\UserController;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Services\MatchingEngine;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 14.1 — admin user management: search, show, suspend, reactivate.
 */
class AdminUserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── auth ────────────── */

    public function test_non_admin_cannot_list_users(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'family']));
        $this->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_guest_cannot_list_users(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();
    }

    /* ────────────── search / browse ────────────── */

    public function test_admin_can_list_users_paginated(): void
    {
        User::factory()->count(5)->create(['role' => 'family']);
        User::factory()->count(3)->create(['role' => 'caregiver']);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->getJson('/api/admin/users?per_page=10')->assertOk();

        // 5 family + 3 caregiver + 1 admin (the acting admin) = 9.
        $response->assertJsonCount(9, 'data');
        $response->assertJsonPath('meta.total', 9);
    }

    public function test_search_query_matches_name_email_phone_and_id(): void
    {
        $target = User::factory()->create([
            'role' => 'caregiver',
            'name' => 'Priya Chen',
            'email' => 'priya@example.com',
            'phone' => '+14165551234',
        ]);
        User::factory()->count(3)->create(['role' => 'caregiver']);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        // Name substring.
        $this->getJson('/api/admin/users?q=priya')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $target->id);

        // Email substring.
        $this->getJson('/api/admin/users?q=priya%40example')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        // Phone substring.
        $this->getJson('/api/admin/users?q=5551234')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        // Exact numeric id.
        $this->getJson("/api/admin/users?q={$target->id}")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $target->id);
    }

    public function test_role_and_status_filters_narrow_results(): void
    {
        User::factory()->count(2)->create(['role' => 'family']);
        User::factory()->count(2)->create(['role' => 'caregiver']);
        $suspended = User::factory()->create([
            'role' => 'caregiver',
            'status' => UserController::STATUS_SUSPENDED,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/admin/users?role=caregiver')
            ->assertOk()
            ->assertJsonPath('meta.total', 3);

        $response = $this->getJson('/api/admin/users?status=suspended')->assertOk();
        $response->assertJsonPath('meta.total', 1);
        $response->assertJsonPath('data.0.id', $suspended->id);
    }

    /* ────────────── show ────────────── */

    public function test_show_returns_full_user_detail(): void
    {
        $caregiver = User::factory()->create([
            'role' => 'caregiver',
            'name' => 'Jordan Leung',
        ]);

        VerificationRecord::create([
            'user_id' => $caregiver->id,
            'check_type' => VerificationRecord::ALL_CHECK_TYPES[0],
            'status' => VerificationRecord::STATUS_CLEARED,
            'provider' => 'manual',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $response = $this->getJson("/api/admin/users/{$caregiver->id}")->assertOk();

        $response
            ->assertJsonPath('data.id', $caregiver->id)
            ->assertJsonPath('data.name', 'Jordan Leung')
            ->assertJsonPath('data.cleared_checks', 1)
            ->assertJsonPath('data.verification_records.0.status', VerificationRecord::STATUS_CLEARED)
            ->assertJsonStructure([
                'data' => [
                    'bookings' => ['as_caregiver' => ['total', 'by_status']],
                    'ratings' => ['count', 'average_stars'],
                ],
            ]);
    }

    /* ────────────── suspend / reactivate ────────────── */

    public function test_admin_can_suspend_user_with_reason(): void
    {
        $target = User::factory()->create(['role' => 'caregiver']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson("/api/admin/users/{$target->id}/suspend", [
            'reason' => 'Inconsistent behaviour reports; pending investigation.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', UserController::STATUS_SUSPENDED)
            ->assertJsonPath('data.suspension_reason', 'Inconsistent behaviour reports; pending investigation.');

        $this->assertSame(UserController::STATUS_SUSPENDED, $target->fresh()->status);
    }

    public function test_suspension_requires_reason(): void
    {
        $target = User::factory()->create(['role' => 'caregiver']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson("/api/admin/users/{$target->id}/suspend", ['reason' => 'no'])
            ->assertStatus(422);
    }

    public function test_admin_cannot_suspend_self(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/users/{$admin->id}/suspend", [
            'reason' => 'Deliberate attempt to self-lock.',
        ])->assertStatus(422);
    }

    public function test_double_suspension_is_rejected(): void
    {
        $target = User::factory()->create([
            'role' => 'caregiver',
            'status' => UserController::STATUS_SUSPENDED,
        ]);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson("/api/admin/users/{$target->id}/suspend", [
            'reason' => 'Already suspended, this should 422.',
        ])->assertStatus(422);
    }

    public function test_admin_can_reactivate_suspended_user(): void
    {
        $target = User::factory()->create([
            'role' => 'caregiver',
            'status' => UserController::STATUS_SUSPENDED,
        ]);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson("/api/admin/users/{$target->id}/reactivate")
            ->assertOk()
            ->assertJsonPath('data.status', UserController::STATUS_ACTIVE);

        $this->assertSame(UserController::STATUS_ACTIVE, $target->fresh()->status);
    }

    public function test_reactivate_rejected_on_already_active_user(): void
    {
        $target = User::factory()->create(['role' => 'caregiver']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->patchJson("/api/admin/users/{$target->id}/reactivate")
            ->assertStatus(422);
    }

    public function test_admin_can_anonymize_a_user_with_reason(): void
    {
        $target = User::factory()->create([
            'role' => 'caregiver',
            'name' => 'To Be Deleted',
            'email' => 'tobe@kindred.test',
        ]);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/admin/users/{$target->id}", [
            'reason' => 'Confirmed fraud — multiple flagged verifications.',
        ])->assertOk();

        // Personal fields scrubbed; status flipped.
        $fresh = $target->fresh();
        $this->assertSame('[deleted user]', $fresh->name);
        $this->assertSame('deleted', $fresh->status);

        // Row still exists for tax retention.
        $this->assertDatabaseHas('users', ['id' => $target->id]);
    }

    public function test_admin_destroy_requires_reason(): void
    {
        $target = User::factory()->create(['role' => 'caregiver']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/admin/users/{$target->id}", [])
            ->assertStatus(422);
    }

    public function test_admin_cannot_delete_self(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/admin/users/{$admin->id}", [
            'reason' => 'Trying to delete myself.',
        ])->assertStatus(422);
    }

    public function test_admin_cannot_double_delete(): void
    {
        $target = User::factory()->create(['role' => 'caregiver', 'status' => 'deleted']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->deleteJson("/api/admin/users/{$target->id}", [
            'reason' => 'Already deleted.',
        ])->assertStatus(422);
    }

    /* ────────────── integration: suspension removes caregiver from matching ────────────── */

    public function test_suspending_caregiver_removes_them_from_matching(): void
    {
        // Basic matching fixture: a gig in Oshawa, a caregiver that covers the area.
        $family = User::factory()->create(['role' => 'family']);
        $familyProfile = FamilyProfile::create([
            'user_id' => $family->id,
            'relationship' => 'parent',
        ]);

        $caregiverUser = User::factory()->create(['role' => 'caregiver']);
        $caregiverProfile = CaregiverProfile::create([
            'user_id' => $caregiverUser->id,
            'bio' => 'Available caregiver.',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'hourly_rate' => 25,
            'travel_radius_km' => 20,
            'years_of_experience' => 3,
            'languages' => ['English'],
        ]);
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();
        $caregiverProfile->services()->sync([$category->id]);
        foreach (VerificationRecord::ALL_CHECK_TYPES as $type) {
            VerificationRecord::create([
                'user_id' => $caregiverUser->id,
                'check_type' => $type,
                'status' => VerificationRecord::STATUS_CLEARED,
                'provider' => 'manual',
            ]);
        }

        $gig = Gig::create([
            'family_profile_id' => $familyProfile->id,
            'service_category_id' => $category->id,
            'description' => 'Companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'scheduled_start' => now()->addDay()->setTime(10, 0),
            'scheduled_end' => now()->addDay()->setTime(12, 0),
            'status' => Gig::STATUS_OPEN,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        $result = app(MatchingEngine::class)->matchesFor($gig);
        $this->assertCount(1, $result['matches'], 'Caregiver should match before suspension.');

        // Now suspend via the admin endpoint.
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->patchJson("/api/admin/users/{$caregiverUser->id}/suspend", [
            'reason' => 'Temporarily removed from matching for this test.',
        ])->assertOk();

        $result = app(MatchingEngine::class)->matchesFor($gig);
        $this->assertCount(0, $result['matches'], 'Suspended caregiver must drop out of matching.');
    }
}
