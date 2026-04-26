<?php

namespace App\Http\Requests\Booking;

use App\Models\BookingDispute;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OpenDisputeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isFamily() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'reason_code' => ['required', 'string', Rule::in(BookingDispute::REASON_CODES)],
            'description' => ['required', 'string', 'min:20', 'max:2000'],
            'evidence_paths' => ['sometimes', 'array', 'max:10'],
            'evidence_paths.*' => ['string', 'max:255'],
        ];
    }
}
