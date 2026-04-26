<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\CareRecipient;
use App\Models\FamilyProfile;
use App\Models\Gig;
use App\Models\Message;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\UserConsent;
use App\Services\AccountAnonymizer;
use Database\Seeders\ServiceCategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 15.C — PIPEDA compliance: granular consent, full data access
 * export, and anonymization-on-deletion that preserves CRA-mandated
 * tax records.
 */
class PipedaComplianceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ServiceCategorySeeder::class);
    }

    /* ────────────── consent ────────────── */

    public function test_consent_index_returns_all_kinds_with_default_not_granted(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/me/consents')->assertOk();

        $rows = $response->json('data');
        $kinds = array_column($rows, 'kind');

        foreach (UserConsent::ALL_KINDS as $kind) {
            $this->assertContains($kind, $kinds);
        }
        // No consents recorded → all default to false.
        foreach ($rows as $row) {
            $this->assertFalse($row['granted']);
        }
    }

    public function test_consent_grant_records_audit_metadata_and_supersedes_prior_state(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // Initial grant.
        $this->postJson('/api/me/consents', [
            'kind' => UserConsent::KIND_MARKETING_EMAIL,
            'granted' => true,
            'policy_version' => 'v1',
        ])->assertCreated();

        // Revocation.
        $this->postJson('/api/me/consents', [
            'kind' => UserConsent::KIND_MARKETING_EMAIL,
            'granted' => false,
        ])->assertCreated();

        // Two append-only rows on disk; latest wins on read.
        $this->assertSame(2, UserConsent::query()
            ->where('user_id', $user->id)
            ->where('kind', UserConsent::KIND_MARKETING_EMAIL)
            ->count());

        $response = $this->getJson('/api/me/consents')->assertOk();
        $marketing = collect($response->json('data'))
            ->firstWhere('kind', UserConsent::KIND_MARKETING_EMAIL);
        $this->assertFalse($marketing['granted']);
    }

    public function test_consent_kind_is_validated(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/me/consents', [
            'kind' => 'unknown_kind',
            'granted' => true,
        ])->assertStatus(422);
    }

    /* ────────────── data access export ────────────── */

    public function test_export_includes_all_personal_data_categories(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking();

        // Add a message + a review so the export has something to surface.
        Message::create([
            'booking_id' => $booking->id,
            'sender_user_id' => $caregiver->id,
            'body' => 'On the way.',
        ]);

        Sanctum::actingAs($family);
        $response = $this->getJson('/api/me/data-export')->assertOk();

        $response->assertJsonStructure([
            'user',
            'verification_records',
            'bookings' => ['as_caregiver', 'as_family'],
            'messages',
            'reviews' => ['given', 'received'],
            'consents',
            'exported_at',
        ]);
    }

    /* ────────────── anonymization on deletion ────────────── */

    public function test_self_serve_deletion_anonymizes_personal_fields_but_preserves_bookings(): void
    {
        [$booking, $caregiver, $family] = $this->makeBooking();
        $familyProfile = FamilyProfile::query()->where('user_id', $family->id)->firstOrFail();

        // Add a recipient so we can verify it's hard-deleted.
        $recipient = CareRecipient::create([
            'family_profile_id' => $familyProfile->id,
            'name' => 'Mother',
        ]);

        Sanctum::actingAs($family);
        $this->deleteJson('/api/me')->assertOk();

        $fresh = $family->fresh();
        $this->assertSame('[deleted user]', $fresh->name);
        $this->assertStringStartsWith('deleted-', $fresh->email);
        $this->assertStringEndsWith('@kindred.deleted', $fresh->email);
        $this->assertNull($fresh->phone);
        $this->assertNull($fresh->date_of_birth);
        $this->assertSame('deleted', $fresh->status);

        // Booking row survives — CRA tax retention.
        $this->assertNotNull(Booking::query()->find($booking->id));

        // Care recipients are hard-deleted (no tax basis).
        $this->assertNull(CareRecipient::query()->find($recipient->id));
    }

    public function test_deleted_user_cannot_log_in(): void
    {
        $user = User::factory()->create([
            'email' => 'leaver@kindred.test',
            'password' => bcrypt('correct-password'),
        ]);

        // Anonymize directly (no Sanctum::actingAs — that swaps the test
        // guard to RequestGuard which doesn't support attempt()).
        app(AccountAnonymizer::class)->anonymize($user);

        // Original email no longer resolves to a user → standard 401.
        $this->postJson('/api/auth/login', [
            'email' => 'leaver@kindred.test',
            'password' => 'correct-password',
        ])->assertStatus(401);
    }

    public function test_messages_authored_by_deleted_user_show_placeholder(): void
    {
        [$booking, $caregiver] = $this->makeBooking();

        Message::create([
            'booking_id' => $booking->id,
            'sender_user_id' => $caregiver->id,
            'body' => 'Sensitive message body.',
        ]);

        Sanctum::actingAs($caregiver);
        $this->deleteJson('/api/me')->assertOk();

        $msg = Message::query()->where('booking_id', $booking->id)->firstOrFail();
        $this->assertSame('[Message removed at user request.]', $msg->body);
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
            'check_in_at' => $start,
            'check_out_at' => $start->copy()->addHours(2),
            'address_full' => '123 King St W, Oshawa ON',
            'address_neighbourhood' => 'Oshawa',
        ]);

        return [$booking, $caregiver, $family];
    }
}
