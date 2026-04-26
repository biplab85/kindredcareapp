<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\StripePaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Family-side payment-method and booking-refund endpoints. All methods
 * here degrade to 503 when Stripe isn't configured — the frontend reads
 * that as "show the Stripe setup pending placeholder".
 */
class PaymentController extends Controller
{
    public function __construct(private readonly StripePaymentService $stripe) {}

    /**
     * Issue a SetupIntent client_secret for Stripe Elements to attach a
     * new payment method. Called from the payment-methods settings page.
     */
    public function setupIntent(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isFamily()) {
            return response()->json(['message' => 'Only family accounts attach payment methods.'], Response::HTTP_FORBIDDEN);
        }

        $family = $user->familyProfile;
        if (! $family) {
            return response()->json(['message' => 'Complete your family profile first.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $this->stripe->isConfigured()) {
            return $this->stripeNotReadyResponse();
        }

        $intent = $this->stripe->createSetupIntent($family);
        if (! $intent) {
            return response()->json(['message' => 'Could not start Stripe setup.'], Response::HTTP_BAD_GATEWAY);
        }

        return response()->json([
            'data' => [
                'client_secret' => $intent->client_secret,
                'customer_id' => $family->fresh()->stripe_customer_id,
                'publishable_key' => config('services.stripe.key'),
            ],
        ]);
    }

    /**
     * List the family's saved payment methods. Empty array when Stripe
     * isn't configured so the frontend can still render the shell.
     */
    public function listPaymentMethods(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isFamily()) {
            return response()->json(['message' => 'Only family accounts have payment methods.'], Response::HTTP_FORBIDDEN);
        }

        $family = $user->familyProfile;
        if (! $family) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $this->stripe->listPaymentMethods($family),
            'meta' => [
                'stripe_configured' => $this->stripe->isConfigured(),
                'default_payment_method_id' => $family->default_payment_method_id,
            ],
        ]);
    }

    /**
     * Detach a payment method from the family's customer. Stripe's detach
     * is idempotent; we treat 404-ish errors inside the service as ok.
     */
    public function destroyPaymentMethod(Request $request, string $paymentMethodId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $family = $user->familyProfile;
        if (! $family) {
            return response()->json(['message' => 'Family profile not found.'], Response::HTTP_NOT_FOUND);
        }

        if (! $this->stripe->isConfigured()) {
            return $this->stripeNotReadyResponse();
        }

        $ok = $this->stripe->detachPaymentMethod($family, $paymentMethodId);
        if (! $ok) {
            return response()->json(['message' => 'Stripe detach failed.'], Response::HTTP_BAD_GATEWAY);
        }

        return response()->json(['data' => ['detached' => true]]);
    }

    /**
     * Sets a payment method as the default for off-session booking
     * authorizations. Called after the Elements SetupIntent confirms.
     */
    public function setDefaultPaymentMethod(Request $request): JsonResponse
    {
        $request->validate(['payment_method_id' => 'required|string']);

        /** @var User $user */
        $user = $request->user();
        $family = $user->familyProfile;
        if (! $family) {
            return response()->json(['message' => 'Family profile not found.'], Response::HTTP_NOT_FOUND);
        }

        $family->forceFill(['default_payment_method_id' => $request->string('payment_method_id')->toString()])->save();

        return response()->json(['data' => ['default_payment_method_id' => $family->default_payment_method_id]]);
    }

    private function stripeNotReadyResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'Stripe is not configured in this environment yet. Payments are running on the stub channel — booking still works, real card capture lands once keys are provisioned.',
            'meta' => ['stripe_configured' => false],
        ], Response::HTTP_SERVICE_UNAVAILABLE);
    }
}
