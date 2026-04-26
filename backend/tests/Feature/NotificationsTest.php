<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Notifications\MessageReceived;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 12 — in-app notification surface + MessageReceived dispatch.
 */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    public function test_index_returns_user_notifications_with_unread_count(): void
    {
        $user = User::factory()->create();
        // Create one notification for this user via the database channel.
        $user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\BookingOffered',
            'data' => ['booking_id' => 42, 'caregiver_name' => 'Sarah'],
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/notifications')->assertOk();

        $response->assertJsonPath('meta.unread', 1);
        $response->assertJsonPath('meta.total', 1);
        $response->assertJsonPath('data.0.type', 'booking_offered');
        $response->assertJsonPath('data.0.data.booking_id', 42);
    }

    public function test_user_only_sees_own_notifications(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $bob->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\BookingOffered',
            'data' => ['booking_id' => 99],
        ]);

        Sanctum::actingAs($alice);

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_mark_read_idempotent_and_sets_timestamp(): void
    {
        $user = User::factory()->create();
        $id = (string) Str::uuid();
        $user->notifications()->create([
            'id' => $id,
            'type' => 'App\\Notifications\\BookingOffered',
            'data' => [],
        ]);

        Sanctum::actingAs($user);

        $this->patchJson("/api/notifications/{$id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $id);

        $this->assertNotNull($user->notifications()->find($id)->read_at);

        // Second call shouldn't fail.
        $this->patchJson("/api/notifications/{$id}/read")->assertOk();
    }

    public function test_mark_all_read_clears_unread(): void
    {
        $user = User::factory()->create();
        for ($i = 0; $i < 3; $i++) {
            $user->notifications()->create([
                'id' => (string) Str::uuid(),
                'type' => 'App\\Notifications\\BookingOffered',
                'data' => [],
            ]);
        }

        Sanctum::actingAs($user);

        $this->patchJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('meta.unread', 0);

        $this->assertSame(0, $user->unreadNotifications()->count());
    }

    public function test_mark_read_returns_404_for_other_users_notification(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $id = (string) Str::uuid();
        $bob->notifications()->create([
            'id' => $id,
            'type' => 'App\\Notifications\\BookingOffered',
            'data' => [],
        ]);

        Sanctum::actingAs($alice);
        $this->patchJson("/api/notifications/{$id}/read")->assertNotFound();
    }

    public function test_sending_a_message_dispatches_message_received_to_recipient(): void
    {
        Notification::fake();

        [$booking, $caregiver, $family] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'On my way.',
        ])->assertCreated();

        // Family is the recipient when caregiver sends.
        Notification::assertSentTo($family, MessageReceived::class);
        Notification::assertNotSentTo($caregiver, MessageReceived::class);
    }

    /**
     * @return array{0: Booking, 1: User, 2: User}
     */
    private function makeBooking(): array
    {
        $caregiver = User::factory()->create(['role' => 'caregiver']);
        $family = User::factory()->create(['role' => 'family']);
        $familyProfile = FamilyProfile::create([
            'user_id' => $family->id,
            'relationship' => 'parent',
        ]);
        $category = ServiceCategory::where('slug', 'companionship')->firstOrFail();

        $start = now()->setTime(10, 0);
        $gig = Gig::create([
            'family_profile_id' => $familyProfile->id,
            'service_category_id' => $category->id,
            'description' => 'Companionship.',
            'location_address' => '123 King St W, Oshawa ON',
            'latitude' => 43.8975,
            'longitude' => -78.8658,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addHours(2),
            'status' => Gig::STATUS_BOOKED,
            'posting_mode' => Gig::POSTING_MATCHED,
        ]);

        $booking = Booking::create([
            'gig_id' => $gig->id,
            'family_profile_id' => $familyProfile->id,
            'caregiver_user_id' => $caregiver->id,
            'match_rank' => 1,
            'fallback_queue' => [],
            'status' => Booking::STATUS_CONFIRMED,
            'payment_status' => Booking::PAYMENT_AUTHORIZED_STUB,
            'hourly_rate_cents' => 2500,
            'duration_minutes' => 120,
            'subtotal_cents' => 5000,
            'platform_fee_cents' => 375,
            'caregiver_payout_cents' => 4625,
            'scheduled_start' => $start,
            'scheduled_end' => $start->copy()->addHours(2),
            'response_deadline_at' => $start->copy()->subHours(4),
            'responded_at' => $start->copy()->subHours(5),
            'address_full' => '123 King St W, Oshawa ON',
            'address_neighbourhood' => 'Oshawa',
        ]);

        return [$booking, $caregiver, $family];
    }
}
