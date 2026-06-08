<?php

namespace App\Http\Controllers;

use App\Http\Requests\Caregiver\UpdateCaregiverProfileRequest;
use App\Models\Booking;
use App\Models\CaregiverProfile;
use App\Models\Message;
use App\Models\Review;
use App\Models\User;
use App\Models\UserConsent;
use App\Models\VerificationRecord;
use App\Services\AccountAnonymizer;
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
            $user->load(['caregiverProfile.services', 'caregiverProfile.certifications', 'verificationRecords']);
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

    /**
     * Phase 15.C — PIPEDA right-to-deletion. Anonymize personal fields
     * but retain financial records (bookings) for the CRA-mandated 7
     * years. Hard-delete is unsafe because Booking rows back tax
     * reporting; AccountAnonymizer scrubs personal data while keeping
     * the row alive.
     */
    public function destroy(Request $request, AccountAnonymizer $anonymizer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $anonymizer->anonymize($user);

        return response()->json([
            'message' => 'Account deletion processed. Personal data has been removed; financial records are retained for 7 years per CRA requirements.',
        ]);
    }

    /**
     * Phase 15.C — PIPEDA right-to-access. Returns the complete personal
     * data the platform holds for this user across every table.
     */
    public function export(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->isCaregiver()) {
            $user->load(['caregiverProfile.services', 'caregiverProfile.certifications']);
        }

        if ($user->isFamily()) {
            $user->load('familyProfile.careRecipients');
        }

        $verifications = VerificationRecord::query()
            ->where('user_id', $user->id)
            ->get();

        $caregiverBookings = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->get();

        $familyBookings = $user->familyProfile !== null
            ? Booking::query()
                ->where('family_profile_id', $user->familyProfile->id)
                ->get()
            : collect();

        $bookingIds = $caregiverBookings->pluck('id')
            ->merge($familyBookings->pluck('id'))
            ->unique()
            ->values();

        $messages = Message::query()
            ->where(function ($q) use ($user, $bookingIds) {
                $q->where('sender_user_id', $user->id)
                    ->orWhereIn('booking_id', $bookingIds);
            })
            ->get();

        $reviewsGiven = Review::query()->where('rater_user_id', $user->id)->get();
        $reviewsReceived = Review::query()->where('ratee_user_id', $user->id)->get();

        $consents = UserConsent::query()
            ->where('user_id', $user->id)
            ->orderBy('id')
            ->get();

        return response()->json([
            'user' => $user->makeVisible(['email', 'phone', 'created_at']),
            'verification_records' => $verifications,
            'bookings' => [
                'as_caregiver' => $caregiverBookings,
                'as_family' => $familyBookings,
            ],
            'messages' => $messages,
            'reviews' => [
                'given' => $reviewsGiven,
                'received' => $reviewsReceived,
            ],
            'consents' => $consents,
            'exported_at' => now()->toIso8601String(),
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
