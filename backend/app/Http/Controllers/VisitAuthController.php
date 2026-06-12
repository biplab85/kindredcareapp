<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Magic-link auto-login for caregivers landing from a shift-reminder email.
 *
 * The route is signed (Laravel `signed` middleware verifies the URL against
 * the app key and rejects tampering) and TTL-limited via the signed URL's
 * own expiry. On top of that we gate with a runtime window check —
 * 2h before scheduled_start through 1h after scheduled_end — so a leaked
 * link from an old reminder can't be replayed after the visit closes.
 *
 * The SPA runs on Sanctum personal access tokens (Bearer auth), not the
 * session cookie guard, so this controller issues a short-lived token for
 * the caregiver and hands it off to the /auth/magic SPA page via query
 * params. That page persists the token to the auth store and bounces to
 * /bookings/[id]. From there every check-in/check-out event is recorded
 * against the caregiver's user id, preserving the audit trail.
 */
class VisitAuthController extends Controller
{
    public function authenticate(Request $request, Booking $booking): RedirectResponse
    {
        $frontend = rtrim(config('app.frontend_url'), '/');

        // Runtime window — the signed URL itself can be valid for 25h+ so
        // the same link sent at T-24h still works at T-1h. The window guard
        // here is what keeps stale links from being usable after the visit.
        $now = now();
        $windowOpen = $booking->scheduled_start->copy()->subHours(2);
        $windowClose = $booking->scheduled_end->copy()->addHour();

        if ($now->lt($windowOpen) || $now->gt($windowClose)) {
            return redirect()->away($frontend.'/login?error=link_expired');
        }

        // Only confirmed or already-in-progress bookings get auto-login.
        // Declined/expired/cancelled bookings shouldn't grant access.
        $allowed = [Booking::STATUS_CONFIRMED, Booking::STATUS_IN_PROGRESS];
        if (! in_array($booking->status, $allowed, true)) {
            return redirect()->away($frontend.'/login?error=visit_unavailable');
        }

        // Short-lived token — 4h is enough to cover the visit window with
        // slack on either side, but tight enough that a leaked token from
        // mid-shift can't be reused tomorrow. Sanctum's `expiresAt` arg
        // overrides the global `expiration` config.
        $token = $booking->caregiver
            ->createToken('visit-magic-link', ['*'], now()->addHours(4))
            ->plainTextToken;

        // The caregiver lands on the focused /visits/[id] page — a stripped
        // mobile-first surface (no DashboardShell) that shows just the
        // address and the single status-appropriate panel for the moment
        // they're in. From there a "Full booking" link bridges to the
        // detailed /bookings/[id] page if they need more context.
        $params = http_build_query([
            'token' => $token,
            'redirect' => '/visits/'.$booking->id,
        ]);

        return redirect()->away($frontend.'/auth/magic?'.$params);
    }
}
