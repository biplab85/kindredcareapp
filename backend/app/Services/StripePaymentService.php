<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\FamilyProfile;
use Illuminate\Support\Facades\Log;
use Stripe\Account;
use Stripe\AccountLink;
use Stripe\Exception\ApiErrorException;
use Stripe\PaymentIntent;
use Stripe\SetupIntent;
use Stripe\StripeClient;
use Stripe\Transfer;

/**
 * Adapter between our booking lifecycle and Stripe's PaymentIntent /
 * Customer APIs. Every method that would hit Stripe first checks
 * {@see isConfigured()} — if we don't have keys, the method returns a
 * sentinel that lets BookingService fall through to the stub channel
 * (authorized_stub / captured_stub / released_stub) established in Phase 7.
 *
 * This keeps the dev environment working before the Stripe Connect platform
 * account is approved, and keeps the production code path identical to
 * what gets exercised once keys land.
 *
 * Connect-specific flows (application_fee_amount, transfer_data) live here
 * in 9.1 but only bite once the caregiver has completed Express onboarding
 * in 9.2. Until then we hold the full amount on the platform and split on
 * the caregiver side in a separate step.
 */
class StripePaymentService
{
    private ?StripeClient $client = null;

    /**
     * Lazily constructed so tests can drive the adapter without a real
     * secret; callers that need the client should go through callWithClient().
     */
    private function client(): StripeClient
    {
        if ($this->client !== null) {
            return $this->client;
        }

        $this->client = new StripeClient([
            'api_key' => (string) config('services.stripe.secret'),
            'stripe_version' => (string) config('services.stripe.api_version'),
        ]);

        return $this->client;
    }

    public function isConfigured(): bool
    {
        return ! empty(config('services.stripe.secret')) && ! empty(config('services.stripe.key'));
    }

    /* ──────────── customers ──────────── */

    /**
     * Idempotent: returns the existing customer id if one is persisted,
     * otherwise creates one on Stripe and writes it back. Caller is
     * responsible for handling the unconfigured case — customers without
     * Stripe fall through to the stub channel.
     */
    public function ensureCustomer(FamilyProfile $family): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        if ($family->stripe_customer_id) {
            return $family->stripe_customer_id;
        }

        $user = $family->user;

        $customer = $this->client()->customers->create([
            'email' => $user?->email,
            'name' => $user?->name,
            'phone' => $user?->phone,
            'metadata' => [
                'family_profile_id' => (string) $family->id,
                'user_id' => (string) $family->user_id,
            ],
        ]);

        $family->forceFill(['stripe_customer_id' => $customer->id])->save();

        return $customer->id;
    }

    /**
     * Returns a SetupIntent client_secret so Stripe Elements can collect +
     * attach a payment method without charging. Frontend calls confirmSetup
     * with this secret; Stripe then fires setup_intent.succeeded via webhook,
     * which persists the resulting `pm_...` id as the family's default.
     */
    public function createSetupIntent(FamilyProfile $family): ?SetupIntent
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $customerId = $this->ensureCustomer($family);
        if ($customerId === null) {
            return null;
        }

        return $this->client()->setupIntents->create([
            'customer' => $customerId,
            'payment_method_types' => ['card'],
            'usage' => 'off_session', // we'll charge on booking-accept without the family present
            'metadata' => [
                'family_profile_id' => (string) $family->id,
            ],
        ]);
    }

    /**
     * List the customer's attached payment methods — used by the settings
     * page to render the saved-card rows.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listPaymentMethods(FamilyProfile $family): array
    {
        if (! $this->isConfigured() || ! $family->stripe_customer_id) {
            return [];
        }

        try {
            $pms = $this->client()->customers->allPaymentMethods($family->stripe_customer_id, [
                'type' => 'card',
                'limit' => 10,
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe listPaymentMethods failed', ['error' => $e->getMessage()]);

            return [];
        }

        return array_map(static fn ($pm) => [
            'id' => $pm->id,
            'brand' => $pm->card->brand ?? null,
            'last4' => $pm->card->last4 ?? null,
            'exp_month' => $pm->card->exp_month ?? null,
            'exp_year' => $pm->card->exp_year ?? null,
            'is_default' => $pm->id === $family->default_payment_method_id,
        ], $pms->data);
    }

    public function detachPaymentMethod(FamilyProfile $family, string $paymentMethodId): bool
    {
        if (! $this->isConfigured()) {
            return false;
        }

        try {
            $this->client()->paymentMethods->detach($paymentMethodId);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe detachPaymentMethod failed', ['pm' => $paymentMethodId, 'error' => $e->getMessage()]);

            return false;
        }

        if ($family->default_payment_method_id === $paymentMethodId) {
            $family->forceFill(['default_payment_method_id' => null])->save();
        }

        return true;
    }

    /* ──────────── payment intents ──────────── */

    /**
     * Authorize (but do not capture) the booking's subtotal against the
     * family's default payment method. Called from BookingService::accept
     * when Stripe is configured; the authorization lives for ~7 days which
     * comfortably covers any MVP booking window.
     *
     * Returns null when unconfigured OR when the family has no default
     * method — caller should treat null as "stay on stub channel" and the
     * frontend will have blocked booking creation earlier if real Stripe
     * is expected but the method is missing.
     */
    public function authorizeForBooking(Booking $booking): ?PaymentIntent
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $family = $booking->familyProfile;
        if (! $family->stripe_customer_id || ! $family->default_payment_method_id) {
            return null;
        }

        try {
            $intent = $this->client()->paymentIntents->create([
                'amount' => $booking->subtotal_cents,
                'currency' => 'cad',
                'customer' => $family->stripe_customer_id,
                'payment_method' => $family->default_payment_method_id,
                'off_session' => true,
                'confirm' => true,
                'capture_method' => 'manual',
                // Phase 9.2 will swap this for transfer_data + application_fee_amount
                // once the caregiver has a Connect Express account.
                'metadata' => [
                    'booking_id' => (string) $booking->id,
                    'gig_id' => (string) $booking->gig_id,
                    'caregiver_user_id' => (string) $booking->caregiver_user_id,
                ],
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe authorizeForBooking failed', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        return $intent;
    }

    /**
     * Capture a booking's PI on check-out. `amountCents` supports partial
     * capture for short visits — Stripe accepts any value up to the
     * original authorization amount. Returns the updated PaymentIntent or
     * null if the operation wasn't applicable (no PI stored, or unconfigured).
     */
    public function captureForBooking(Booking $booking, ?int $amountCents = null): ?PaymentIntent
    {
        if (! $this->isConfigured() || ! $booking->stripe_payment_intent_id) {
            return null;
        }

        try {
            return $this->client()->paymentIntents->capture($booking->stripe_payment_intent_id, [
                'amount_to_capture' => $amountCents ?? $booking->subtotal_cents,
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe captureForBooking failed', [
                'booking_id' => $booking->id,
                'pi' => $booking->stripe_payment_intent_id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Release the authorization without charging — used for cancellations
     * and no-shows where the family shouldn't pay anything.
     */
    public function cancelAuthorization(Booking $booking): bool
    {
        if (! $this->isConfigured() || ! $booking->stripe_payment_intent_id) {
            return false;
        }

        try {
            $this->client()->paymentIntents->cancel($booking->stripe_payment_intent_id, [
                'cancellation_reason' => 'requested_by_customer',
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe cancelAuthorization failed', [
                'booking_id' => $booking->id,
                'pi' => $booking->stripe_payment_intent_id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        return true;
    }

    /* ──────────── connect accounts (9.2) ──────────── */

    /**
     * Lazily creates a Connect Express account for the caregiver and
     * persists the `acct_...` id. Returns null when unconfigured so the
     * caller can surface the "Stripe pending" placeholder.
     */
    public function ensureConnectAccount(CaregiverProfile $profile): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        if ($profile->stripe_connect_account_id) {
            return $profile->stripe_connect_account_id;
        }

        $user = $profile->user;

        try {
            $account = $this->client()->accounts->create([
                'type' => 'express',
                'country' => 'CA', // MVP is Durham-only; expansion will need per-caregiver country.
                'email' => $user->email,
                'capabilities' => [
                    'card_payments' => ['requested' => true],
                    'transfers' => ['requested' => true],
                ],
                'business_type' => 'individual',
                'metadata' => [
                    'caregiver_profile_id' => (string) $profile->id,
                    'user_id' => (string) $profile->user_id,
                ],
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe ensureConnectAccount failed', [
                'caregiver_profile_id' => $profile->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        $profile->forceFill(['stripe_connect_account_id' => $account->id])->save();

        return $account->id;
    }

    /**
     * Generates a one-shot hosted onboarding URL. Short-lived — caregivers
     * who bounce have to re-request via the refresh endpoint.
     */
    public function createConnectOnboardingLink(CaregiverProfile $profile, string $returnUrl, string $refreshUrl): ?AccountLink
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $accountId = $this->ensureConnectAccount($profile);
        if ($accountId === null) {
            return null;
        }

        try {
            return $this->client()->accountLinks->create([
                'account' => $accountId,
                'return_url' => $returnUrl,
                'refresh_url' => $refreshUrl,
                'type' => 'account_onboarding',
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe createConnectOnboardingLink failed', [
                'caregiver_profile_id' => $profile->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Pulls the latest account state from Stripe and mirrors the
     * `payouts_enabled` + `details_submitted` flags onto the local row.
     * Called from the onboarding-return webhook *or* the explicit Refresh
     * endpoint the frontend hits when a caregiver comes back from Stripe.
     */
    public function refreshConnectAccountStatus(CaregiverProfile $profile): ?Account
    {
        if (! $this->isConfigured() || ! $profile->stripe_connect_account_id) {
            return null;
        }

        try {
            $account = $this->client()->accounts->retrieve($profile->stripe_connect_account_id);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe refreshConnectAccountStatus failed', [
                'caregiver_profile_id' => $profile->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        $profile->forceFill([
            'payouts_enabled' => (bool) ($account->payouts_enabled ?? false),
            'connect_onboarded_at' => ($account->details_submitted ?? false)
                ? ($profile->connect_onboarded_at ?? now())
                : null,
        ])->save();

        return $account;
    }

    /**
     * Transfers the caregiver's payout portion from the platform balance
     * to their Connect account. Called by the ReleasePayouts scheduler
     * after the 24-hour hold. Returns the Transfer on success or null if
     * we weren't in a state to issue one (unconfigured, no account, no
     * captured charge, already transferred).
     */
    public function transferToCaregiver(Booking $booking): ?Transfer
    {
        if (! $this->isConfigured() || ! $booking->stripe_payment_intent_id) {
            return null;
        }

        $caregiverProfile = $booking->caregiver->caregiverProfile;
        if (! $caregiverProfile || ! $caregiverProfile->stripe_connect_account_id || ! $caregiverProfile->payouts_enabled) {
            return null;
        }

        try {
            return $this->client()->transfers->create([
                'amount' => $booking->caregiver_payout_cents,
                'currency' => 'cad',
                'destination' => $caregiverProfile->stripe_connect_account_id,
                // `source_transaction` ties the transfer to the original
                // charge so Stripe handles platform-balance accounting
                // correctly. Stripe accepts either the charge id or the
                // payment intent (which resolves internally).
                'source_transaction' => $booking->stripe_payment_intent_id,
                'metadata' => [
                    'booking_id' => (string) $booking->id,
                    'caregiver_user_id' => (string) $booking->caregiver_user_id,
                ],
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe transferToCaregiver failed', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Refund a captured booking. `amountCents` null = full refund. Used
     * by the admin dispute-resolution flow in Phase 14.
     */
    public function refundForBooking(Booking $booking, ?int $amountCents = null): bool
    {
        if (! $this->isConfigured() || ! $booking->stripe_payment_intent_id) {
            return false;
        }

        try {
            $this->client()->refunds->create([
                'payment_intent' => $booking->stripe_payment_intent_id,
                'amount' => $amountCents, // null = full
                'reason' => 'requested_by_customer',
            ]);
        } catch (ApiErrorException $e) {
            Log::warning('Stripe refundForBooking failed', [
                'booking_id' => $booking->id,
                'pi' => $booking->stripe_payment_intent_id,
                'amount_cents' => $amountCents,
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        return true;
    }
}
