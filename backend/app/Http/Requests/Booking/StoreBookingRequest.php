<?php

namespace App\Http\Requests\Booking;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

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
            'caregiver_user_id' => ['required', 'integer', 'exists:users,id'],
            // The ranked queue from the Phase 6 matches view, primary caregiver
            // first. Used to drive the auto-fallback on decline/expire.
            'ranked_caregiver_ids' => ['required', 'array', 'min:1', 'max:10'],
            'ranked_caregiver_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'ranked_caregiver_ids.required' => 'The matches list is required so we can cascade if the caregiver declines.',
        ];
    }

    public function prepareForValidation(): void
    {
        // Belt and braces: if the caller forgot to include the primary caregiver
        // in the queue, prepend them so cascade logic has a coherent starting point.
        $ranked = $this->input('ranked_caregiver_ids');
        $primary = $this->input('caregiver_user_id');

        if (is_array($ranked) && is_int($primary) && ! in_array($primary, $ranked, true)) {
            $this->merge([
                'ranked_caregiver_ids' => array_values(array_unique(array_merge([$primary], $ranked))),
            ]);
        }
    }
}
