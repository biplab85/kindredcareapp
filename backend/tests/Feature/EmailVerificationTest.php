<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * Email verification through the SPA: signed URL points to the frontend,
 * the frontend forwards the request to the backend's API verify route,
 * the route validates the signature and flips email_verified_at.
 */
class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_signup_dispatches_frontend_verification_link(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test User',
            'email' => 'newuser@kindred.test',
            'password' => 'secret-password-9!',
            'password_confirmation' => 'secret-password-9!',
            'role' => 'family',
            'phone' => '+14165550000',
        ])->assertCreated();

        $user = User::query()->where('email', 'newuser@kindred.test')->firstOrFail();

        Notification::assertSentTo($user, VerifyEmailNotification::class, function ($notification) {
            // The mailable URL must point at the configured frontend host.
            $url = (new \ReflectionMethod($notification, 'verificationUrl'))
                ->invoke($notification, User::query()->where('email', 'newuser@kindred.test')->firstOrFail());

            return str_starts_with($url, config('app.frontend_url'))
                && str_contains($url, '/verify-email?')
                && str_contains($url, 'signature=')
                && str_contains($url, 'expires=');
        });
    }

    public function test_signed_url_marks_email_verified(): void
    {
        $user = User::factory()->create([
            'email' => 'verify@kindred.test',
            'email_verified_at' => null,
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addHour(),
            [
                'id' => $user->id,
                'hash' => sha1($user->getEmailForVerification()),
            ],
        );

        // The frontend would extract path + query and forward this same URL.
        $this->getJson($signedUrl)
            ->assertOk()
            ->assertJsonPath('already_verified', false);

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_already_verified_responds_idempotently(): void
    {
        $user = User::factory()->create([
            'email' => 'already@kindred.test',
            'email_verified_at' => now(),
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addHour(),
            ['id' => $user->id, 'hash' => sha1($user->email)],
        );

        $this->getJson($signedUrl)
            ->assertOk()
            ->assertJsonPath('already_verified', true);
    }

    public function test_tampered_signature_is_rejected(): void
    {
        $user = User::factory()->create(['email_verified_at' => null]);

        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addHour(),
            ['id' => $user->id, 'hash' => sha1($user->email)],
        );

        // Flip a character in the signature.
        $tampered = preg_replace('/signature=([a-f0-9]+)/', 'signature=ffffffffffffffffffff', $signedUrl);

        $this->getJson($tampered)->assertStatus(403);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_wrong_hash_is_rejected_even_with_valid_signature(): void
    {
        $user = User::factory()->create(['email_verified_at' => null]);

        // Generate a signed URL with the WRONG hash (doesn't match the email).
        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addHour(),
            ['id' => $user->id, 'hash' => sha1('different@email.test')],
        );

        $this->getJson($signedUrl)->assertStatus(403);
    }

    public function test_expired_signature_is_rejected(): void
    {
        $user = User::factory()->create(['email_verified_at' => null]);

        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->subMinutes(5), // already expired
            ['id' => $user->id, 'hash' => sha1($user->email)],
        );

        $this->getJson($signedUrl)->assertStatus(403);
    }
}
