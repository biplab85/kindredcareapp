<?php

namespace Tests\Feature;

use App\Models\CareRecipient;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GigControllerTest extends TestCase
{
    use RefreshDatabase;

    private ServiceCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
        $this->category = ServiceCategory::where('slug', 'companionship')->firstOrFail();
    }

    /* ────────────── helpers ────────────── */

    private function familyUser(): User
    {
        $user = User::factory()->create([
            'role' => 'family',
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
        FamilyProfile::create(['user_id' => $user->id, 'relationship' => 'parent']);

        return $user->fresh();
    }

    private function caregiverUser(): User
    {
        return User::factory()->create([
            'role' => 'caregiver',
            'email_verified_at' => now(),
        ])->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'service_category_id' => $this->category->id,
            'description' => 'Need company for an afternoon walk and some conversation about gardening.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'scheduled_start' => now()->addDay()->setTime(9, 0)->toIso8601String(),
            'scheduled_end' => now()->addDay()->setTime(13, 0)->toIso8601String(),
        ], $overrides);
    }

    /* ────────────── store ────────────── */

    public function test_family_can_create_gig(): void
    {
        Sanctum::actingAs($this->familyUser());

        $response = $this->postJson('/api/gigs', $this->validPayload());

        $response->assertCreated();
        $response->assertJsonPath('data.status', Gig::STATUS_OPEN);
        $response->assertJsonPath('data.service_category.slug', 'companionship');

        $this->assertDatabaseCount('gigs', 1);
    }

    public function test_caregiver_cannot_create_gig(): void
    {
        Sanctum::actingAs($this->caregiverUser());

        $this->postJson('/api/gigs', $this->validPayload())->assertForbidden();
        $this->assertDatabaseCount('gigs', 0);
    }

    public function test_guest_cannot_create_gig(): void
    {
        $this->postJson('/api/gigs', $this->validPayload())->assertUnauthorized();
    }

    public function test_description_must_be_at_least_20_chars(): void
    {
        Sanctum::actingAs($this->familyUser());

        $this->postJson('/api/gigs', $this->validPayload(['description' => 'too short']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('description');
    }

    public function test_schedule_must_not_be_in_the_past(): void
    {
        Sanctum::actingAs($this->familyUser());

        $this->postJson('/api/gigs', $this->validPayload([
            'scheduled_start' => now()->subDay()->toIso8601String(),
            'scheduled_end' => now()->subDay()->addHours(2)->toIso8601String(),
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('scheduled_start');
    }

    public function test_gig_must_be_at_least_1_hour(): void
    {
        Sanctum::actingAs($this->familyUser());

        $start = now()->addDay()->setTime(9, 0);

        $this->postJson('/api/gigs', $this->validPayload([
            'scheduled_start' => $start->toIso8601String(),
            'scheduled_end' => $start->copy()->addMinutes(30)->toIso8601String(),
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('scheduled_end');
    }

    public function test_recurring_gig_requires_days(): void
    {
        Sanctum::actingAs($this->familyUser());

        $this->postJson('/api/gigs', $this->validPayload([
            'is_recurring' => true,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recurrence_pattern']);
    }

    public function test_recurring_gig_accepts_valid_pattern(): void
    {
        Sanctum::actingAs($this->familyUser());

        $response = $this->postJson('/api/gigs', $this->validPayload([
            'is_recurring' => true,
            'recurrence_pattern' => [
                'days' => ['mon', 'wed', 'fri'],
                'end_date' => now()->addMonth()->toDateString(),
            ],
        ]));

        $response->assertCreated();
        $response->assertJsonPath('data.is_recurring', true);
        $response->assertJsonPath('data.recurrence_pattern.days', ['mon', 'wed', 'fri']);
    }

    public function test_rate_max_is_constrained(): void
    {
        Sanctum::actingAs($this->familyUser());

        $this->postJson('/api/gigs', $this->validPayload([
            'preferences' => ['rate_max' => 200],
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('preferences.rate_max');
    }

    public function test_store_uploads_photo(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->familyUser());

        $response = $this->post('/api/gigs', array_merge($this->validPayload(), [
            'photo' => UploadedFile::fake()->image('grocery.jpg', 400, 300),
        ]), ['Accept' => 'application/json']);

        $response->assertCreated();
        $photoUrl = $response->json('data.photo_url');
        $this->assertNotNull($photoUrl);
        $this->assertStringContainsString('gig-photos/', $photoUrl);
    }

    public function test_cannot_attach_another_families_recipient(): void
    {
        $family = $this->familyUser();
        $otherFamily = $this->familyUser();
        $otherRecipient = CareRecipient::create([
            'family_profile_id' => $otherFamily->familyProfile->id,
            'name' => 'Ruth',
        ]);

        Sanctum::actingAs($family);

        $this->postJson('/api/gigs', $this->validPayload([
            'care_recipient_id' => $otherRecipient->id,
        ]))->assertForbidden();
    }

    /* ────────────── index ────────────── */

    public function test_index_returns_only_own_gigs(): void
    {
        $family = $this->familyUser();
        $otherFamily = $this->familyUser();

        Gig::create([
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Mine aaaaaaaaaaaaaaaaaaaaaaa',
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
        ]);

        Gig::create([
            'family_profile_id' => $otherFamily->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Theirs aaaaaaaaaaaaaaaaaaaaa',
            'location_address' => 'there',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
        ]);

        Sanctum::actingAs($family);

        $response = $this->getJson('/api/gigs');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    public function test_index_filters_by_status(): void
    {
        $family = $this->familyUser();

        $base = [
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
        ];
        Gig::create(array_merge($base, ['description' => 'Open one aaaaaaaaaaaaaa', 'status' => Gig::STATUS_OPEN]));
        Gig::create(array_merge($base, ['description' => 'Done one aaaaaaaaaaaaaa', 'status' => Gig::STATUS_COMPLETED]));

        Sanctum::actingAs($family);

        $response = $this->getJson('/api/gigs?status=open');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame(Gig::STATUS_OPEN, $response->json('data.0.status'));
    }

    /* ────────────── show ────────────── */

    public function test_show_requires_ownership(): void
    {
        $family = $this->familyUser();
        $otherFamily = $this->familyUser();

        $gig = Gig::create([
            'family_profile_id' => $otherFamily->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Someone else s gig aaaaaaa',
            'location_address' => 'there',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
        ]);

        Sanctum::actingAs($family);

        $this->getJson("/api/gigs/{$gig->id}")->assertForbidden();
    }

    /* ────────────── update ────────────── */

    public function test_can_update_open_gig(): void
    {
        $family = $this->familyUser();
        $gig = Gig::create([
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Original description aaaaaaaaa',
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
        ]);

        Sanctum::actingAs($family);

        $response = $this->patchJson("/api/gigs/{$gig->id}", [
            'description' => 'Updated description with plenty of detail',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.description', 'Updated description with plenty of detail');
    }

    public function test_cannot_update_booked_gig(): void
    {
        $family = $this->familyUser();
        $gig = Gig::create([
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Already booked please no edits',
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
            'status' => Gig::STATUS_BOOKED,
        ]);

        Sanctum::actingAs($family);

        $this->patchJson("/api/gigs/{$gig->id}", [
            'description' => 'Trying to change this description here',
        ])->assertStatus(422);
    }

    /* ────────────── cancel / destroy ────────────── */

    public function test_can_cancel_open_gig(): void
    {
        $family = $this->familyUser();
        $gig = Gig::create([
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Cancelling this one later aaaa',
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
        ]);

        Sanctum::actingAs($family);

        $response = $this->patchJson("/api/gigs/{$gig->id}/cancel");

        $response->assertOk();
        $response->assertJsonPath('data.status', Gig::STATUS_CANCELLED);
    }

    public function test_cannot_destroy_booked_gig(): void
    {
        $family = $this->familyUser();
        $gig = Gig::create([
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Already booked nope nope nope aa',
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
            'status' => Gig::STATUS_BOOKED,
        ]);

        Sanctum::actingAs($family);

        $this->deleteJson("/api/gigs/{$gig->id}")->assertStatus(422);
        $this->assertDatabaseHas('gigs', ['id' => $gig->id]);
    }

    public function test_destroy_removes_open_gig_and_photo(): void
    {
        Storage::fake('public');
        $family = $this->familyUser();
        $gig = Gig::create([
            'family_profile_id' => $family->familyProfile->id,
            'service_category_id' => $this->category->id,
            'description' => 'Hard delete this one please yes',
            'location_address' => 'here',
            'latitude' => 43.9,
            'longitude' => -78.9,
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(2),
            'photo_path' => 'gig-photos/1/photo.jpg',
        ]);
        Storage::disk('public')->put($gig->photo_path, 'fake');

        Sanctum::actingAs($family);

        $this->deleteJson("/api/gigs/{$gig->id}")->assertOk();

        $this->assertDatabaseMissing('gigs', ['id' => $gig->id]);
        Storage::disk('public')->assertMissing($gig->photo_path);
    }
}
