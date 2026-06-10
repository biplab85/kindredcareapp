<?php

namespace App\Http\Controllers;

use App\Http\Requests\Family\UpdateFamilyProfileRequest;
use App\Models\CareRecipient;
use App\Models\FamilyProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FamilyProfileController extends Controller
{
    public function update(UpdateFamilyProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->isFamily()) {
            return response()->json(['message' => 'Only family accounts can update this profile.'], 403);
        }

        $profile = FamilyProfile::firstOrCreate(['user_id' => $user->id]);

        $profile->update($request->safe()->only(['relationship', 'postal_code']));

        if ($request->filled('city')) {
            $profile->update(['city' => $request->city]);
        }

        if ($request->has('care_recipient')) {
            $recipientData = $request->care_recipient;

            if ($profile->careRecipients()->count() === 0) {
                $profile->careRecipients()->create($recipientData);
            } else {
                $profile->careRecipients()->first()?->update($recipientData);
            }
        }

        $allFieldsFilled = $profile->relationship && $profile->postal_code;
        if ($allFieldsFilled && ! $profile->onboarding_complete) {
            $profile->update(['onboarding_complete' => true]);
        }

        return response()->json([
            'profile' => $profile->load('careRecipients'),
        ]);
    }

    public function addRecipient(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = FamilyProfile::firstOrCreate(['user_id' => $user->id]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'street_address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'in:AB,BC,MB,NB,NL,NS,NT,NU,ON,PE,QC,SK,YT'],
            'age' => ['nullable', 'integer', 'min:0', 'max:120'],
            'postal_code' => ['nullable', 'string', 'regex:/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/'],
            'language' => ['nullable', 'string', 'max:50'],
            'interests' => ['nullable', 'array'],
            'accessibility_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $recipient = $profile->careRecipients()->create($validated);

        return response()->json([
            'recipient' => $recipient,
        ], 201);
    }

    public function updateRecipient(Request $request, CareRecipient $recipient): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->familyProfile;

        if (! $profile || $recipient->family_profile_id !== $profile->id) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:100'],
            'street_address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'province' => ['sometimes', 'nullable', 'string', 'in:AB,BC,MB,NB,NL,NS,NT,NU,ON,PE,QC,SK,YT'],
            'age' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:120'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'regex:/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/'],
            'language' => ['sometimes', 'nullable', 'string', 'max:50'],
            'interests' => ['sometimes', 'nullable', 'array'],
            'accessibility_notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $recipient->update($validated);

        return response()->json([
            'recipient' => $recipient->fresh(),
        ]);
    }

    public function deleteRecipient(Request $request, CareRecipient $recipient): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->familyProfile;

        if (! $profile || $recipient->family_profile_id !== $profile->id) {
            return response()->json(['message' => 'Not authorized.'], 403);
        }

        $recipient->delete();

        return response()->json([
            'message' => 'Care recipient removed.',
        ]);
    }

    public function recipients(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = FamilyProfile::firstOrCreate(['user_id' => $user->id]);

        return response()->json([
            'recipients' => $profile->careRecipients,
        ]);
    }
}
