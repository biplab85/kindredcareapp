<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Phase 15.B — auth-flow hardening regressions:
 *   - Suspended / deleted users cannot log in.
 *   - Password reset revokes every existing access token.
 */
class AuthHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_suspended_user_cannot_log_in(): void
    {
        User::factory()->create([
            'email' => 'suspended@kindred.test',
            'password' => Hash::make('correct-password'),
            'status' => 'suspended',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'suspended@kindred.test',
            'password' => 'correct-password',
        ])->assertStatus(403);
    }

    public function test_active_user_can_log_in(): void
    {
        User::factory()->create([
            'email' => 'active@kindred.test',
            'password' => Hash::make('correct-password'),
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'active@kindred.test',
            'password' => 'correct-password',
        ])->assertOk()->assertJsonStructure(['user', 'token']);
    }

    public function test_password_reset_revokes_existing_tokens(): void
    {
        $user = User::factory()->create([
            'email' => 'reset@kindred.test',
            'password' => Hash::make('old-password'),
        ]);

        // Create two tokens; both should be wiped after reset.
        $user->createToken('session-1');
        $user->createToken('session-2');
        $this->assertSame(2, $user->tokens()->count());

        // Generate a real reset token via the framework.
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'reset@kindred.test',
            'password' => 'new-password-456!',
            'password_confirmation' => 'new-password-456!',
        ])->assertOk();

        $this->assertSame(0, $user->fresh()->tokens()->count());
    }
}
