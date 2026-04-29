<?php

namespace App\Http\Requests\Gig;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Caregiver updates one of their own gig listings. Same shape as the
 * store request but every field is `sometimes` — partial PATCH-style
 * updates are supported (controller verifies ownership via the route
 * model). Service category and listing status can be changed; previous
 * bookings are unaffected because the booking row snapshots the rate
 * at creation time.
 */
class UpdateGigRequest extends FormRequest
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
            'service_category_id' => ['sometimes', 'integer', 'exists:service_categories,id'],
            'title' => ['sometimes', 'string', 'min:8', 'max:120'],
            'hourly_rate_dollars' => ['sometimes', 'numeric', 'min:18', 'max:50'],
            'description' => ['sometimes', 'string', 'min:20', 'max:500'],
            'tasks_included' => ['sometimes', 'nullable', 'array', 'max:10'],
            'tasks_included.*' => ['string', 'max:120'],
            'photo' => ['sometimes', 'nullable', 'image', 'max:5120'],
            'status' => ['sometimes', 'in:draft,published,paused'],
        ];
    }
}
