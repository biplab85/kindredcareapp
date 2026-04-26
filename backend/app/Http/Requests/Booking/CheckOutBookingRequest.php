<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class CheckOutBookingRequest extends FormRequest
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
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'tasks_completed' => ['sometimes', 'array'],
            'tasks_completed.*' => ['string', 'max:80'],
            'caregiver_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
