<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\StripePaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Caregiver-side Stripe Connect Express onboarding. Mirrors the shape of
 * PaymentController — 503 + explanatory meta when Stripe isn't configured,
 * same graceful-degradation story.
 */
class CaregiverConnectController extends Controller
{
    public function __construct(private readonly StripePaymentService $stripe) {}

    /**
     * Return current local-side state + a freshness hint so the frontend
     * can decide whether to offer a Refresh button. Stripe isn't called
     * here — use refresh() for that.
     */
    public function status(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], Response::HTTP_FORBIDDEN);
        }

        $profile = $user->caregiverProfile;
        if (! $profile) {
            return response()->json(['message' => 'Complete your caregiver profile first.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json([
            'data' => [
                'connected' => (bool) $profile->stripe_connect_account_id,
                'payouts_enabled' => $profile->payouts_enabled,
                'onboarded_at' => $profile->connect_onboarded_at?->toIso8601String(),
            ],
            'meta' => [
                'stripe_configured' => $this->stripe->isConfigured(),
            ],
        ]);
    }

    /**
     * Lazily create the Express account (if needed) and return a hosted
     * onboarding URL. The frontend redirects the caregiver there; they
     * come back via return_url when done.
     */
    public function onboarding(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], Response::HTTP_FORBIDDEN);
        }

        $profile = $user->caregiverProfile;
        if (! $profile) {
            return response()->json(['message' => 'Complete your caregiver profile first.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $this->stripe->isConfigured()) {
            return $this->stripeNotReadyResponse();
        }

        $frontend = (string) config('app.frontend_url', config('app.url'));
        $link = $this->stripe->createConnectOnboardingLink(
            $profile,
            returnUrl: $frontend.'/settings/payouts?status=complete',
            refreshUrl: $frontend.'/settings/payouts?status=refresh',
        );

        if (! $link) {
            return response()->json(['message' => 'Could not start Stripe Connect onboarding.'], Response::HTTP_BAD_GATEWAY);
        }

        return response()->json([
            'data' => [
                'url' => $link->url,
                'expires_at' => $link->expires_at,
            ],
        ]);
    }

    /**
     * Pull the latest account state from Stripe and mirror the flags onto
     * the local profile. Called by the frontend when the caregiver comes
     * back from the hosted onboarding page.
     */
    public function refresh(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], Response::HTTP_FORBIDDEN);
        }

        $profile = $user->caregiverProfile;
        if (! $profile) {
            return response()->json(['message' => 'Complete your caregiver profile first.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $this->stripe->isConfigured()) {
            return $this->stripeNotReadyResponse();
        }

        $account = $this->stripe->refreshConnectAccountStatus($profile);
        $fresh = $profile->fresh();

        return response()->json([
            'data' => [
                'connected' => (bool) $fresh->stripe_connect_account_id,
                'payouts_enabled' => $fresh->payouts_enabled,
                'onboarded_at' => $fresh->connect_onboarded_at?->toIso8601String(),
                'details_submitted' => $account ? (bool) ($account->details_submitted ?? false) : false,
            ],
        ]);
    }

    private function stripeNotReadyResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'Stripe Connect is not configured yet. Payouts still work via the stub channel — your earnings are tracked and will transfer the moment Stripe is live.',
            'meta' => ['stripe_configured' => false],
        ], Response::HTTP_SERVICE_UNAVAILABLE);
    }
}
