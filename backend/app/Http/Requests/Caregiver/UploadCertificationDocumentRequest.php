<?php

namespace App\Http\Requests\Caregiver;

use Illuminate\Foundation\Http\FormRequest;

class UploadCertificationDocumentRequest extends FormRequest
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
            'document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }
}
