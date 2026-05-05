<?php

namespace App\Http\Requests\Booking;

use App\Models\Booking;
use App\Models\Gig;
use App\Models\User;
use App\Services\StripePaymentService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Family books a chosen gig. Visit specifics ride along here — gig_id
 * supplies the caregiver + rate; the family supplies date/time, recipient,
 * and address.
 */
class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var User|null $user */
        $user = $this->user();

        return $user !== null && $user->isFamily();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'gig_id' => ['required', 'integer', 'exists:gigs,id'],
            'care_recipient_id' => ['required', 'integer', 'exists:care_recipients,id'],
            'scheduled_start' => ['required', 'date', 'after:now'],
            // 1h–8h gig windows — matches the chip set in the booking UI.
            'duration_minutes' => ['required', 'integer', 'min:60', 'max:480'],
            'address_full' => ['required', 'string', 'max:255'],
            'address_neighbourhood' => ['sometimes', 'nullable', 'string', 'max:100'],
            'notes_from_family' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var User|null $user */
            $user = $this->user();

            // Email verification is a hard precondition for booking. We
            // also gate the Submit button frontend-side, but families
            // can post directly to /api/bookings — this is the source
            // of truth.
            if ($user !== null && $user->email_verified_at === null) {
                $validator->errors()->add(
                    'email_verification',
                    'Verify your email before booking a visit. Check your inbox or resend the link from /verify-email.',
                );

                return;
            }

            // Card-on-file gate — only when Stripe is actually wired up.
            // In dev (no STRIPE_SECRET) the stub channel is the documented
            // fallback, so we let the booking through. Once real Stripe is
            // configured, requiring a card is a hard precondition for
            // booking; the alternative is a silent free-visit if the
            // authorize call later returns null.
            $stripe = app(StripePaymentService::class);
            $family = $user?->familyProfile;
            if (
                $stripe->isConfigured()
                && $family
                && (! $family->stripe_customer_id || ! $family->default_payment_method_id)
            ) {
                $validator->errors()->add(
                    'payment_method',
                    'Add a payment method before booking. Settings → Payment methods.',
                );

                return;
            }

            $start = $this->input('scheduled_start');
            $minutes = $this->integer('duration_minutes');

            if ($start && $minutes < 60) {
                $validator->errors()->add(
                    'duration_minutes',
                    'A booking must be at least 1 hour long.',
                );
            }

            if (! $start) {
                return;
            }

            try {
                $startDt = CarbonImmutable::parse((string) $start);
            } catch (\Throwable) {
                $validator->errors()->add('scheduled_start', 'Invalid start time.');

                return;
            }

            // Friendly pre-check for overlapping bookings on this caregiver.
            // No row-level lock here — this is just to surface a clean 422
            // before the request hits BookingService. The transaction-level
            // `lockForUpdate` in createFromGig is the source of truth for
            // races; this check is the user-facing path.
            $gigId = $this->integer('gig_id');
            if ($gigId <= 0 || $minutes <= 0) {
                return;
            }

            $gig = Gig::with('caregiverProfile')->find($gigId);
            $caregiverUserId = $gig?->caregiverProfile?->user_id;
            if ($caregiverUserId === null) {
                return;
            }

            $endDt = $startDt->addMinutes($minutes);

            $conflict = Booking::query()
                ->where('caregiver_user_id', $caregiverUserId)
                ->active()
                ->where('scheduled_start', '<', $endDt)
                ->where('scheduled_end', '>', $startDt)
                ->exists();

            if ($conflict) {
                $validator->errors()->add(
                    'scheduled_start',
                    'This caregiver is already booked at that time. Pick a different window.',
                );
            }
        });
    }
}
