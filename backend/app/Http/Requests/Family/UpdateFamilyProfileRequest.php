<?php

namespace App\Http\Requests\Family;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFamilyProfileRequest extends FormRequest
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
            'relationship' => ['sometimes', 'in:self,parent,spouse,family,friend'],
            'postal_code' => ['sometimes', 'string', 'regex:/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/'],

            'care_recipient.name' => ['sometimes', 'string', 'min:2', 'max:100'],
            'care_recipient.age' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:120'],
            'care_recipient.postal_code' => ['sometimes', 'string', 'regex:/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/'],
            'care_recipient.language' => ['sometimes', 'string', 'max:50'],
            'care_recipient.interests' => ['sometimes', 'array'],
            'care_recipient.interests.*' => ['string', 'max:50'],
            'care_recipient.accessibility_notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
