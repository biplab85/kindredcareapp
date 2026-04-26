<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\Message;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Services\MessageRedactor;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 10 — booking-scoped messaging with redaction guards. Covers the
 * participant ACL, the redaction pipeline, and the read-receipt side
 * effect on thread open.
 */
class MessagingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── ACL ────────────── */

    public function test_caregiver_can_send_and_read_messages_on_own_booking(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking();

        Sanctum::actingAs($caregiver);

        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'On my way — about ten minutes out.',
        ])->assertCreated();

        Sanctum::actingAs($family);

        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Thanks, see you soon.',
        ])->assertCreated();

        $this->getJson("/api/bookings/{$booking->id}/messages")
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_outsider_cannot_read_or_send_messages(): void
    {
        [$booking] = $this->makeBooking();
        $outsider = User::factory()->create(['role' => 'family']);

        Sanctum::actingAs($outsider);

        $this->getJson("/api/bookings/{$booking->id}/messages")->assertForbidden();
        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Hi from outside.',
        ])->assertForbidden();
    }

    public function test_admin_can_read_thread(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Visit complete.',
        ])->assertCreated();

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->getJson("/api/bookings/{$booking->id}/messages")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    /* ────────────── redaction ────────────── */

    public function test_redaction_strips_phone_email_postal_and_off_platform_terms(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Sanctum::actingAs($caregiver);

        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Reach me at sarah@example.com or 416-555-0199. Postal L1H 7K4. Use WhatsApp instead.',
        ])->assertCreated();

        $body = $response->json('data.body');
        $this->assertStringNotContainsString('sarah@example.com', $body);
        $this->assertStringNotContainsString('416-555-0199', $body);
        $this->assertStringNotContainsString('L1H 7K4', $body);
        $this->assertStringNotContainsString('WhatsApp', $body);

        $this->assertStringContainsString('[email redacted]', $body);
        $this->assertStringContainsString('[phone redacted]', $body);
        $this->assertStringContainsString('[postal_code redacted]', $body);
        $this->assertStringContainsString('[off_platform redacted]', $body);

        $this->assertSame(4, $response->json('data.redaction_count'));
    }

    public function test_recipient_does_not_see_original_redacted_strings(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'My number is 416-555-0199.',
        ])->assertCreated();

        Sanctum::actingAs($family);
        $response = $this->getJson("/api/bookings/{$booking->id}/messages")->assertOk();

        $this->assertStringNotContainsString('416-555-0199', $response->getContent());
        // Recipients see redaction_count but not the detail array.
        $this->assertNull($response->json('data.0.redactions'));
        $this->assertSame(1, $response->json('data.0.redaction_count'));
    }

    public function test_clean_message_has_no_redactions(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Looking forward to meeting you tomorrow.',
        ])->assertCreated();

        $this->assertSame(0, $response->json('data.redaction_count'));
    }

    /* ────────────── side effects ────────────── */

    public function test_opening_thread_marks_inbound_messages_as_read(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Hello.',
        ])->assertCreated();

        $message = Message::query()->latest('id')->firstOrFail();
        $this->assertNull($message->read_at);

        // Family opens — read_at should fill in.
        Sanctum::actingAs($family);
        $this->getJson("/api/bookings/{$booking->id}/messages")->assertOk();

        $this->assertNotNull($message->fresh()->read_at);
    }

    public function test_validation_rejects_empty_or_overlong_body(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Sanctum::actingAs($caregiver);

        $this->postJson("/api/bookings/{$booking->id}/messages", ['body' => ''])
            ->assertStatus(422);

        $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => str_repeat('a', 2001),
        ])->assertStatus(422);
    }

    /* ────────────── admin moderation ────────────── */

    public function test_admin_can_hide_a_message_and_audit_log_records_it(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'A message that turns out to need moderation.',
        ])->assertCreated();

        $messageId = $response->json('data.id');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/messages/{$messageId}/hide", [
            'reason' => 'Contained instructions to meet off-platform.',
        ])->assertOk();

        $this->assertNotNull(Message::find($messageId)?->hidden_at);

        $row = AdminAuditLog::query()
            ->where('action', 'message.hidden')
            ->first();
        $this->assertNotNull($row);
        $this->assertSame($admin->id, $row->admin_user_id);
        $this->assertSame($messageId, $row->target_id);
    }

    public function test_recipient_sees_placeholder_for_hidden_message(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Original message body.',
        ])->assertCreated();
        $messageId = $response->json('data.id');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);
        $this->patchJson("/api/admin/messages/{$messageId}/hide", [
            'reason' => 'Inappropriate content.',
        ])->assertOk();

        // Family (recipient) sees placeholder.
        Sanctum::actingAs($family);
        $thread = $this->getJson("/api/bookings/{$booking->id}/messages")->assertOk();
        $this->assertSame('[Message removed by moderation.]', $thread->json('data.0.body'));
        $this->assertTrue($thread->json('data.0.is_hidden'));

        // Sender still sees their own original text.
        Sanctum::actingAs($caregiver);
        $thread = $this->getJson("/api/bookings/{$booking->id}/messages")->assertOk();
        $this->assertSame('Original message body.', $thread->json('data.0.body'));
    }

    public function test_unhide_restores_visibility(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Sanctum::actingAs($caregiver);
        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Will be hidden then restored.',
        ])->assertCreated();
        $messageId = $response->json('data.id');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);
        $this->patchJson("/api/admin/messages/{$messageId}/hide", [
            'reason' => 'Hide first to verify unhide.',
        ])->assertOk();

        $this->patchJson("/api/admin/messages/{$messageId}/unhide")->assertOk();

        $fresh = Message::findOrFail($messageId);
        $this->assertNull($fresh->hidden_at);
        $this->assertNull($fresh->hidden_reason);

        $this->assertNotNull(
            AdminAuditLog::query()->where('action', 'message.unhidden')->first(),
        );
    }

    public function test_hide_requires_reason(): void
    {
        [$booking, $caregiver] = $this->makeBooking();
        Sanctum::actingAs($caregiver);
        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Hide me.',
        ])->assertCreated();
        $messageId = $response->json('data.id');

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->patchJson("/api/admin/messages/{$messageId}/hide", [])->assertStatus(422);
    }

    public function test_double_hide_is_rejected(): void
    {
        [$booking, $caregiver] = $this->makeBooking();
        Sanctum::actingAs($caregiver);
        $response = $this->postJson("/api/bookings/{$booking->id}/messages", [
            'body' => 'Already-hidden case.',
        ])->assertCreated();
        $messageId = $response->json('data.id');

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->patchJson("/api/admin/messages/{$messageId}/hide", [
            'reason' => 'First hide call.',
        ])->assertOk();
        $this->patchJson("/api/admin/messages/{$messageId}/hide", [
            'reason' => 'Second hide call should fail.',
        ])->assertStatus(422);
    }

    /* ────────────── unit-level redactor sanity ────────────── */

    public function test_redactor_returns_empty_redaction_list_for_clean_input(): void
    {
        $r = new MessageRedactor;
        $result = $r->redact('Hello, looking forward to the visit.');

        $this->assertSame('Hello, looking forward to the visit.', $result['body']);
        $this->assertSame([], $result['redactions']);
    }

    public function test_redactor_emits_kind_metadata_per_match(): void
    {
        $r = new MessageRedactor;
        $result = $r->redact('Email me at hi@x.com and call 416-555-1234.');

        $kinds = array_column($result['redactions'], 'kind');
        $this->assertContains('email', $kinds);
        $this->assertContains('phone', $kinds);
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
