<?php

namespace App\Http\Requests\Caregiver;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCaregiverProfileRequest extends FormRequest
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
            'date_of_birth' => ['sometimes', 'date', 'before:today'],
            'gender' => ['sometimes', 'in:male,female,non_binary,prefer_not_to_say'],
            'bio' => ['sometimes', 'string', 'min:50', 'max:500'],
            'hourly_rate' => ['sometimes', 'numeric', 'min:18', 'max:50'],
            'travel_radius_km' => ['sometimes', 'numeric', 'min:1', 'max:50'],
            'years_of_experience' => ['sometimes', 'integer', 'min:0', 'max:50'],

            'services_offered' => ['sometimes', 'array', 'min:1'],
            'services_offered.*.id' => ['required_with:services_offered', 'exists:service_categories,id'],
            'services_offered.*.years_experience' => ['sometimes', 'integer', 'min:0', 'max:50'],

            'languages' => ['sometimes', 'array', 'min:1'],
            'languages.*' => ['string', 'max:50'],
            'interests' => ['sometimes', 'array'],
            'interests.*' => ['string', 'max:50'],
            'personality_tags' => ['sometimes', 'array'],
            'personality_tags.*' => ['string', 'max:50'],

            // Certifications moved to /api/me/certifications in PR 1 of the
            // cert-verification flow. Any incoming `certifications` payload
            // is silently dropped because the validator no longer lists it.

            'references' => ['sometimes', 'array', 'max:5'],
            'references.*.name' => ['required_with:references', 'string', 'max:100'],
            'references.*.email' => ['sometimes', 'nullable', 'email'],
            'references.*.phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'references.*.relationship' => ['sometimes', 'nullable', 'string', 'max:100'],

            'emergency_contact_name' => ['sometimes', 'string', 'max:100'],
            'emergency_contact_phone' => ['sometimes', 'string', 'max:20'],
            'emergency_contact_relationship' => ['sometimes', 'string', 'max:50'],

            'postal_code' => ['sometimes', 'string', 'regex:/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/'],
            'address' => ['sometimes', 'string', 'max:255'],
            'latitude' => ['sometimes', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'numeric', 'between:-180,180'],
            'availability' => ['sometimes', 'array'],
            'profile_photo' => ['sometimes', 'image', 'max:5120'],
        ];
    }
}
