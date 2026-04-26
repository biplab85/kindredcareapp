<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 15.A — assertions on the security-header set + rate limiter
 * surface. Headers are middleware-set, so a single endpoint smoke-test
 * is enough to confirm the pipeline.
 */
class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_response_carries_security_headers(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertOk()
            ->assertHeader('Strict-Transport-Security')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Permissions-Policy')
            ->assertHeader('Cross-Origin-Resource-Policy', 'same-origin');

        // Vendor identifier should be stripped.
        $response->assertHeaderMissing('X-Powered-By');
    }

    public function test_login_endpoint_throttles_after_five_attempts_per_ip_email(): void
    {
        // Create the target so the password mismatches don't 422-validate
        // before they hit the throttle.
        User::factory()->create([
            'email' => 'target@kindred.test',
            'password' => bcrypt('correct-password'),
        ]);

        // 5 attempts at the bad password should all return 422 (or 401),
        // then the 6th should return 429 from the throttle.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'target@kindred.test',
                'password' => 'wrong-password',
            ]);
        }

        $response = $this->postJson('/api/auth/login', [
            'email' => 'target@kindred.test',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(429);
    }

    public function test_throttle_is_keyed_per_email_so_other_accounts_are_unaffected(): void
    {
        User::factory()->create([
            'email' => 'alice@kindred.test',
            'password' => bcrypt('alice-correct'),
        ]);
        User::factory()->create([
            'email' => 'bob@kindred.test',
            'password' => bcrypt('bob-correct'),
        ]);

        // Burn alice's bucket.
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'alice@kindred.test',
                'password' => 'wrong',
            ]);
        }

        // Bob is on a different bucket — should still be allowed through.
        $this->postJson('/api/auth/login', [
            'email' => 'bob@kindred.test',
            'password' => 'bob-correct',
        ])->assertStatus(200);
    }
}
