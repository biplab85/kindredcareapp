<?php

namespace App\Http\Controllers;

use App\Models\CaregiverProfile;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Notifications\VerificationDocumentsSubmitted;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

class VerificationController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        VerificationRecord::createDefaultsForUser($user->id);

        $records = $user->verificationRecords()->get();

        return response()->json([
            'records' => $records,
            'is_fully_verified' => $user->isFullyVerified(),
        ]);
    }

    public function uploadId(Request $request): JsonResponse
    {
        $request->validate([
            'id_front' => ['required', 'image', 'max:10240'],
            'id_back' => ['sometimes', 'image', 'max:10240'],
        ]);

        /** @var User $user */
        $user = $request->user();

        $dir = "verifications/{$user->id}";

        $paths = [];
        $paths['id_front'] = $request->file('id_front')->store($dir, 'private');

        if ($request->hasFile('id_back')) {
            $paths['id_back'] = $request->file('id_back')->store($dir, 'private');
        }

        $record = VerificationRecord::updateOrCreate(
            ['user_id' => $user->id, 'check_type' => VerificationRecord::TYPE_IDENTITY],
            [
                'status' => VerificationRecord::STATUS_PENDING_REVIEW,
                'document_paths' => $paths,
                'retry_count' => \DB::raw('retry_count + 1'),
            ],
        );

        // Drop the submission into the admin notification bell + inbox so
        // the queue isn't dependent on someone refreshing /admin/verifications.
        $admins = User::where('role', 'admin')->where('status', 'active')->get();
        if ($admins->isNotEmpty()) {
            Notification::send($admins, new VerificationDocumentsSubmitted($user, $record->fresh()));
        }

        return response()->json([
            'message' => 'ID documents uploaded. Pending admin review.',
            'record' => $record->fresh(),
        ]);
    }

    public function uploadSelfie(Request $request): JsonResponse
    {
        $request->validate([
            'selfie' => ['required', 'image', 'max:10240'],
        ]);

        /** @var User $user */
        $user = $request->user();

        $file = $request->file('selfie');
        $path = $file->store("verifications/{$user->id}", 'private');

        $record = VerificationRecord::where('user_id', $user->id)
            ->where('check_type', VerificationRecord::TYPE_IDENTITY)
            ->first();

        if ($record) {
            $docs = $record->document_paths ?? [];
            $docs['selfie'] = $path;
            $record->update(['document_paths' => $docs]);
        }

        // Mirror the selfie to the public disk and use it as the caregiver
        // profile photo. Only seed photo_path if it's empty — an explicit
        // /me/photo upload always wins, so a caregiver who chose a different
        // headshot isn't surprised by it changing on a verification reupload.
        // The verification copy stays on the private disk untouched; the
        // public mirror is an additional file used purely for display.
        if ($user->isCaregiver()) {
            $profile = CaregiverProfile::firstOrCreate(['user_id' => $user->id]);
            if (! $profile->photo_path) {
                $contents = Storage::disk('private')->get($path);
                if ($contents !== null) {
                    $publicPath = 'avatars/'.$user->id.'-'.uniqid('selfie-', true).'.'.$file->getClientOriginalExtension();
                    Storage::disk('public')->put($publicPath, $contents);
                    // Auto-approve — mirrors ProfileController::uploadPhoto.
                    // The verification selfie has already cleared review when
                    // identity verification clears, so there's no value in a
                    // second moderation hop just for the public mirror.
                    $profile->update([
                        'photo_path' => $publicPath,
                        'photo_status' => 'approved',
                    ]);
                }
            }
        }

        return response()->json([
            'message' => 'Selfie uploaded.',
            'record' => $record?->fresh(),
        ]);
    }

    public function startIdVerification(): JsonResponse
    {
        return response()->json([
            'message' => 'Automated ID verification is not yet configured. Please upload documents for manual review.',
        ], 501);
    }

    public function startCpicCheck(): JsonResponse
    {
        return response()->json([
            'message' => 'Automated CPIC checks are not yet configured. Admin will review manually.',
        ], 501);
    }
}
