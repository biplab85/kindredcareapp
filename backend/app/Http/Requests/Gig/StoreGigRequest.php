<?php

namespace App\Http\Requests\Gig;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Caregiver creates a productized service listing. Hourly rate is in
 * cents to match the platform's cents-everywhere money convention. The
 * MVP cuts package tiers, schedule, and preferences — those concerns
 * move to the booking row that's created when a family books this gig.
 */
class StoreGigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isCaregiver() === true;
    }

    /**
     * @return array<string, array<int, string|ValidationRule>>
     */
    public function rules(): array
    {
        return [
            'service_category_id' => ['required', 'integer', 'exists:service_categories,id'],
            'title' => ['required', 'string', 'min:8', 'max:120'],
            // Stored as integer cents — clients pass dollars, we convert in the controller.
            'hourly_rate_dollars' => ['required', 'numeric', 'min:18', 'max:50'],
            'description' => ['required', 'string', 'min:20', 'max:500'],
            'tasks_included' => ['sometimes', 'nullable', 'array', 'max:10'],
            'tasks_included.*' => ['string', 'max:120'],
            'photo' => ['sometimes', 'nullable', 'image', 'max:5120'],
            'status' => ['sometimes', 'in:draft,published,paused'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            // Email verification is a hard precondition for publishing
            // gigs — families need to know the inbox on the listing
            // is real before they reach out. Frontend gates Submit too,
            // but this is the source of truth.
            if ($this->user() !== null && $this->user()->email_verified_at === null) {
                $validator->errors()->add(
                    'email_verification',
                    'Verify your email before publishing a gig. Check your inbox or resend the link from /verify-email.',
                );
            }
        });
    }
}
