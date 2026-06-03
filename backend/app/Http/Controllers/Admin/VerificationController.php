<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Services\AdminAuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class VerificationController extends Controller
{
    public function __construct(private readonly AdminAuditLogger $auditLogger) {}

    public function pending(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending_review');

        // AML is auto-cleared with CPIC (see ::approve below), so the queue
        // never needs to surface standalone AML rows — they'd just be noise
        // that resolves the moment CPIC is approved.
        $query = VerificationRecord::with('user')
            ->where('check_type', '!=', VerificationRecord::TYPE_AML)
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
                    // Time-limited signed URL — admin can paste it into
                    // <img src=...> or open it in a new tab; the signature
                    // is the authorization. 15 minutes is enough for a
                    // single review session without leaving long-lived
                    // links sitting in browser history.
                    $documentUrls[$key] = URL::temporarySignedRoute(
                        'admin.verification.document',
                        now()->addMinutes(15),
                        [
                            'verification' => $verification->id,
                            'document' => $key,
                        ],
                    );
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
        $data = $request->validate([
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        $previousStatus = $verification->status;
        $verification->update([
            'status' => VerificationRecord::STATUS_CLEARED,
            'admin_notes' => $data['admin_notes'] ?? null,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'verification.approved',
            targetType: AdminAuditLog::TARGET_VERIFICATION_RECORD,
            targetId: $verification->id,
            metadata: [
                'check_type' => $verification->check_type,
                'caregiver_user_id' => $verification->user_id,
                'previous_status' => $previousStatus,
            ],
            reason: $data['admin_notes'] ?? null,
        );

        // CPIC and AML are a packaged background check in practice — the
        // admin runs them externally (Certn / similar) as one screening and
        // gets a single report covering both. Clearing CPIC therefore also
        // clears AML on the same caregiver in the same transaction, so we
        // don't strand an AML row at not_started forever.
        if ($verification->check_type === VerificationRecord::TYPE_CPIC) {
            $aml = VerificationRecord::where('user_id', $verification->user_id)
                ->where('check_type', VerificationRecord::TYPE_AML)
                ->first();

            if ($aml && $aml->status !== VerificationRecord::STATUS_CLEARED) {
                $amlPreviousStatus = $aml->status;
                $aml->update([
                    'status' => VerificationRecord::STATUS_CLEARED,
                    'admin_notes' => 'Auto-cleared with CPIC.',
                    'reviewed_by' => $admin->id,
                    'reviewed_at' => now(),
                    'rejection_reason' => null,
                ]);

                $this->auditLogger->record(
                    admin: $admin,
                    action: 'verification.approved',
                    targetType: AdminAuditLog::TARGET_VERIFICATION_RECORD,
                    targetId: $aml->id,
                    metadata: [
                        'check_type' => $aml->check_type,
                        'caregiver_user_id' => $aml->user_id,
                        'previous_status' => $amlPreviousStatus,
                        'auto_cleared_with' => 'cpic',
                        'triggered_by_verification_id' => $verification->id,
                    ],
                    reason: 'Auto-cleared with CPIC.',
                );
            }
        }

        return response()->json([
            'message' => 'Verification approved.',
            'verification' => $verification->fresh(),
        ]);
    }

    public function reject(Request $request, VerificationRecord $verification): JsonResponse
    {
        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
            'admin_notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        $previousStatus = $verification->status;
        $verification->update([
            'status' => VerificationRecord::STATUS_REJECTED,
            'rejection_reason' => $data['rejection_reason'],
            'admin_notes' => $data['admin_notes'] ?? null,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'verification.rejected',
            targetType: AdminAuditLog::TARGET_VERIFICATION_RECORD,
            targetId: $verification->id,
            metadata: [
                'check_type' => $verification->check_type,
                'caregiver_user_id' => $verification->user_id,
                'previous_status' => $previousStatus,
            ],
            reason: $data['rejection_reason'],
        );

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

        // Override the global CORP header so the admin frontend (different
        // origin in dev: :3000 vs :8000) can render the doc inline via
        // <img>. The signed-URL middleware is the authorization gate;
        // dropping CORP doesn't change who can fetch, just whether a
        // browser embedded on a different origin will accept the bytes.
        $response = Storage::disk('private')->response($paths[$document]);
        $response->headers->set('Cross-Origin-Resource-Policy', 'cross-origin');

        return $response;
    }
}
