<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBookingTasksRequest extends FormRequest
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
            'tasks_completed' => ['required', 'array'],
            'tasks_completed.*' => ['string', 'max:80'],
            'caregiver_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
