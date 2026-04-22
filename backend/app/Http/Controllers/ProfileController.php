<?php

namespace App\Http\Controllers;

use App\Http\Requests\Caregiver\UpdateCaregiverProfileRequest;
use App\Models\CaregiverProfile;
use App\Models\User;
use App\Services\ProfileCompletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = ['user' => $user];

        if ($user->isCaregiver()) {
            $user->load(['caregiverProfile.services', 'verificationRecords']);
            $completionService = new ProfileCompletionService;
            $data['profile_completion'] = $completionService->calculate($user);
            $data['is_fully_verified'] = $user->isFullyVerified();
            $data['verification_summary'] = $user->verificationRecords
                ->map(fn ($r) => ['check_type' => $r->check_type, 'status' => $r->status])
                ->values();
        }

        if ($user->isFamily()) {
            $user->load('familyProfile.careRecipients');
        }

        return response()->json($data);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->update($request->only(['name']));

        return response()->json([
            'user' => $user->fresh(),
        ]);
    }

    public function updateCaregiverProfile(UpdateCaregiverProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Only caregivers can update this profile.'], 403);
        }

        $profile = CaregiverProfile::firstOrCreate(['user_id' => $user->id]);

        $profile->update($request->safe()->except(['services_offered', 'profile_photo']));

        if ($request->has('services_offered')) {
            $syncData = [];
            foreach ($request->services_offered as $service) {
                if (is_array($service)) {
                    $syncData[$service['id']] = ['years_experience' => $service['years_experience'] ?? 0];
                } else {
                    $syncData[$service] = ['years_experience' => 0];
                }
            }
            $profile->services()->sync($syncData);
        }

        if ($request->filled('date_of_birth') || $request->filled('gender')) {
            $user->update($request->only(['date_of_birth', 'gender']));
        }

        $completionService = new ProfileCompletionService;
        $completion = $completionService->calculate($user->fresh());

        if ($completion['is_matchable'] && ! $profile->onboarding_complete) {
            $profile->update(['onboarding_complete' => true]);
        }

        return response()->json([
            'profile' => $profile->load('services'),
            'profile_completion' => $completion,
        ]);
    }

    public function uploadPhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:5120'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $profile = CaregiverProfile::firstOrCreate(['user_id' => $user->id]);

        if ($profile->photo_path) {
            Storage::disk('public')->delete($profile->photo_path);
        }

        $path = $request->file('photo')->store('avatars', 'public');

        $profile->update([
            'photo_path' => $path,
            'photo_status' => 'pending_review',
        ]);

        return response()->json([
            'message' => 'Photo uploaded. Pending review.',
            'photo_url' => Storage::disk('public')->url($path),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => 'Account deleted.',
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->isCaregiver()) {
            $user->load('caregiverProfile.services');
        }

        if ($user->isFamily()) {
            $user->load('familyProfile.careRecipients');
        }

        return response()->json([
            'user' => $user->makeVisible(['email', 'phone', 'created_at']),
        ]);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->tokens()->delete();

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'All sessions revoked. New token issued.',
            'token' => $token,
        ]);
    }
}
