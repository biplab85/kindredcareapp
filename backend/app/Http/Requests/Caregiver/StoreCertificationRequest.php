<?php

namespace App\Http\Requests\Caregiver;

use Illuminate\Foundation\Http\FormRequest;

class StoreCertificationRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'issuer' => ['sometimes', 'nullable', 'string', 'max:200'],
            'year' => ['sometimes', 'nullable', 'integer', 'min:1990', 'max:2030'],
            // Required as of the no-self-reported-creates change — every
            // new cert lands at pending_review with a document admin can
            // actually verify. PDF or image, 10MB cap. PDFs are the common
            // shipping format for first-aid cards / PSW diplomas.
            'document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'document.required' => 'Attach a PDF or photo of your certification — every cert on KindredCare is admin-verified.',
        ];
    }
}
