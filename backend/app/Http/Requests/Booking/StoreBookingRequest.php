<?php

namespace App\Http\Requests\Booking;

use App\Models\User;
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
            'address_neighbourhood' => ['required', 'string', 'max:100'],
            'notes_from_family' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $start = $this->input('scheduled_start');
            $minutes = $this->integer('duration_minutes');

            if ($start && $minutes < 60) {
                $validator->errors()->add(
                    'duration_minutes',
                    'A booking must be at least 1 hour long.',
                );
            }

            if ($start) {
                // Sanity check on the date itself — `after:now` covers the same
                // ground but with a clearer error if the parser fails.
                try {
                    CarbonImmutable::parse((string) $start);
                } catch (\Throwable $e) {
                    $validator->errors()->add('scheduled_start', 'Invalid start time.');
                }
            }
        });
    }
}
