<?php

namespace App\Http\Requests\Gig;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreGigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isFamily() === true;
    }

    /**
     * @return array<string, array<int, string|ValidationRule>>
     */
    public function rules(): array
    {
        return [
            'service_category_id' => ['required', 'integer', 'exists:service_categories,id'],
            'care_recipient_id' => ['sometimes', 'nullable', 'integer', 'exists:care_recipients,id'],

            'description' => ['required', 'string', 'min:20', 'max:500'],

            'location_address' => ['required', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],

            'scheduled_start' => ['required', 'date', 'after:now'],
            'scheduled_end' => ['required', 'date', 'after:scheduled_start'],

            'is_recurring' => ['sometimes', 'boolean'],
            'recurrence_pattern' => ['required_if:is_recurring,true', 'nullable', 'array'],
            'recurrence_pattern.days' => ['required_if:is_recurring,true', 'array', 'min:1'],
            'recurrence_pattern.days.*' => ['in:mon,tue,wed,thu,fri,sat,sun'],
            'recurrence_pattern.end_date' => ['sometimes', 'nullable', 'date', 'after:scheduled_start'],

            'preferences' => ['sometimes', 'nullable', 'array'],
            'preferences.gender' => ['sometimes', 'nullable', 'in:male,female,any'],
            'preferences.language' => ['sometimes', 'nullable', 'string', 'max:50'],
            'preferences.rate_max' => ['sometimes', 'nullable', 'numeric', 'min:18', 'max:50'],

            'posting_mode' => ['sometimes', 'nullable', 'in:matched,open'],

            'photo' => ['sometimes', 'nullable', 'image', 'max:5120'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $start = $this->input('scheduled_start');
            $end = $this->input('scheduled_end');

            if ($start && $end) {
                $startDt = CarbonImmutable::parse($start);
                $endDt = CarbonImmutable::parse($end);

                if ($startDt->diffInMinutes($endDt, absolute: true) < 60) {
                    $validator->errors()->add(
                        'scheduled_end',
                        'A gig must be at least 1 hour long.',
                    );
                }
            }
        });
    }
}
