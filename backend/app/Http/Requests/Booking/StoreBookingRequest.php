<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
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
            'gig_id' => ['required', 'exists:gigs,id'],
            'caregiver_id' => ['required', 'exists:users,id'],
        ];
    }
}
