<?php

namespace App\Http\Requests\Emergency;

use App\Models\IncidentReport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubmitIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(IncidentReport::TYPES)],
            'severity' => ['required', 'string', Rule::in(IncidentReport::SEVERITIES)],
            'description' => ['required', 'string', 'min:20', 'max:2000'],
            'evidence_paths' => ['sometimes', 'array', 'max:10'],
            'evidence_paths.*' => ['string', 'max:255'],
        ];
    }
}
