<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    /**
     * Phase 15.A — named rate limiters applied across the API. Tighter on
     * auth-adjacent endpoints (login, reset, phone-OTP) where brute-force
     * pressure is highest, looser on read endpoints where normal dashboard
     * polling needs headroom.
     */
    private function configureRateLimiters(): void
    {
        // Default for any authenticated route — keyed per user.
        // 60/min covers normal dashboard usage with margin for polling.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(60)
            ->by(optional($request->user())->id ?: $request->ip()));

        // Authenticated write endpoints — POST/PATCH/DELETE on bookings,
        // messages, etc. Tighter than read so a token leak hurts less.
        RateLimiter::for('api-write', fn (Request $request) => Limit::perMinute(30)
            ->by(optional($request->user())->id ?: $request->ip()));

        // Login + password reset — keyed per IP+email so attackers can't
        // rotate IPs to defeat per-user counters or rotate emails to
        // defeat per-IP counters. 5/min is industry standard.
        RateLimiter::for('auth-strict', function (Request $request) {
            $email = (string) $request->input('email', '');
            $key = $request->ip().'|'.strtolower($email);

            return Limit::perMinute(5)->by($key);
        });

        // Signup + email-verification resend + general public POSTs.
        // 10/min is loose enough for legitimate users hitting Send twice,
        // tight enough to slow scraping.
        RateLimiter::for('auth-loose', fn (Request $request) => Limit::perMinute(10)
            ->by($request->ip()));

        // Provider webhooks (Stripe, Veriff, Certn) — high ceiling because
        // a single Stripe operation can fan out to multiple webhook events.
        // HMAC verification is the real defense; this just absorbs floods.
        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(120)
            ->by($request->ip()));
    }
}
