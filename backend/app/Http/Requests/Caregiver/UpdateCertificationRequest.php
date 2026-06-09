<?php

namespace App\Http\Requests\Caregiver;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCertificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isCaregiver() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:100'],
            'issuer' => ['sometimes', 'nullable', 'string', 'max:200'],
            'year' => ['sometimes', 'nullable', 'integer', 'min:1990', 'max:2030'],
        ];
    }
}
