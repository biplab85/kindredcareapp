<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Magic-link auto-login for caregivers landing from a shift-reminder email.
 *
 * The route is signed (Laravel `signed` middleware verifies the URL against
 * the app key and rejects tampering) and TTL-limited via the signed URL's
 * own expiry. On top of that we gate with a runtime window check —
 * 2h before scheduled_start through 1h after scheduled_end — so a leaked
 * link from an old reminder can't be replayed after the visit closes.
 *
 * The link bootstraps a normal Sanctum session as the booking's caregiver,
 * then redirects to the SPA. From there every check-in/check-out event is
 * recorded against the caregiver's user id, preserving the audit trail
 * (no anonymous "someone with a link did this" events).
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

        Auth::login($booking->caregiver, remember: false);
        $request->session()->regenerate();

        return redirect()->away($frontend.'/bookings/'.$booking->id);
    }
}
