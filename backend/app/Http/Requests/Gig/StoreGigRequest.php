<?php

namespace App\Http\Requests\Gig;

use Illuminate\Foundation\Http\FormRequest;

class StoreGigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'service_category_id' => ['required', 'exists:service_categories,id'],
            'description' => ['required', 'string', 'min:20', 'max:500'],
            'location_address' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'scheduled_start' => ['required', 'date', 'after:now'],
            'scheduled_end' => ['required', 'date', 'after:scheduled_start'],
            'is_recurring' => ['sometimes', 'boolean'],
            'recurrence_pattern' => ['required_if:is_recurring,true', 'nullable', 'array'],
            'preferences' => ['sometimes', 'nullable', 'array'],
            'preferences.gender' => ['sometimes', 'nullable', 'in:male,female,any'],
            'preferences.language' => ['sometimes', 'nullable', 'string', 'max:50'],
            'preferences.rate_min' => ['sometimes', 'nullable', 'numeric', 'min:18'],
            'preferences.rate_max' => ['sometimes', 'nullable', 'numeric', 'max:50'],
            'photo' => ['sometimes', 'nullable', 'image', 'max:5120'],
        ];
    }
}
