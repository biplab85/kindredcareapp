<?php

namespace App\Http\Requests\Emergency;

use Illuminate\Foundation\Http\FormRequest;

class TriggerPanicRequest extends FormRequest
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
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'silent' => ['sometimes', 'boolean'],
        ];
    }
}
