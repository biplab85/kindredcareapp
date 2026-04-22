<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\VerificationRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VerificationController extends Controller
{
    public function pending(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending_review');

        $query = VerificationRecord::with('user')
            ->orderBy('updated_at', 'desc');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $records = $query->paginate(20);

        return response()->json($records);
    }

    public function show(VerificationRecord $verification): JsonResponse
    {
        $verification->load(['user.caregiverProfile.services', 'reviewer']);

        $documentUrls = [];
        /** @var array<string, string>|null $paths */
        $paths = $verification->document_paths;
        if (is_array($paths)) {
            foreach ($paths as $key => $path) {
                if (Storage::disk('private')->exists($path)) {
                    $documentUrls[$key] = route('admin.verification.document', [
                        'verification' => $verification->id,
                        'document' => $key,
                    ]);
                }
            }
        }

        return response()->json([
            'verification' => $verification,
            'document_urls' => $documentUrls,
        ]);
    }

    public function approve(Request $request, VerificationRecord $verification): JsonResponse
    {
        $request->validate([
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        $verification->update([
            'status' => VerificationRecord::STATUS_CLEARED,
            'admin_notes' => $request->admin_notes,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        return response()->json([
            'message' => 'Verification approved.',
            'verification' => $verification->fresh(),
        ]);
    }

    public function reject(Request $request, VerificationRecord $verification): JsonResponse
    {
        $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        $verification->update([
            'status' => VerificationRecord::STATUS_REJECTED,
            'rejection_reason' => $request->rejection_reason,
            'admin_notes' => $request->admin_notes,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Verification rejected.',
            'verification' => $verification->fresh(),
        ]);
    }

    public function document(VerificationRecord $verification, string $document): mixed
    {
        /** @var array<string, string>|null $paths */
        $paths = $verification->document_paths;

        if (! is_array($paths) || ! isset($paths[$document])) {
            abort(404, 'Document not found.');
        }

        if (! Storage::disk('private')->exists($paths[$document])) {
            abort(404, 'File not found.');
        }

        return Storage::disk('private')->response($paths[$document]);
    }
}
