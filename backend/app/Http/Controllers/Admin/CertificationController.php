<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Certification;
use App\Models\User;
use App\Services\AdminAuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;

/**
 * Admin review queue for caregiver-uploaded certifications. The queue
 * defaults to `pending_review` because that's the only status that
 * actually requires admin action — `self_reported` rows have no
 * document to look at, and verified/rejected rows are already decided.
 *
 * Document preview goes through a short-lived signed URL on
 * `admin.certification.document`, same pattern as the identity-doc
 * preview from PR #49.
 */
class CertificationController extends Controller
{
    public function __construct(private readonly AdminAuditLogger $auditLogger) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in([
                ...Certification::ALL_STATUSES,
                'all',
            ])],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:100'],
        ]);

        $status = $data['status'] ?? Certification::STATUS_PENDING_REVIEW;

        $query = Certification::query()
            ->with(['caregiverProfile.user:id,name,email', 'reviewer:id,name'])
            ->orderByDesc('updated_at');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $records = $query->paginate($data['per_page'] ?? 20);

        return response()->json($records);
    }

    public function show(Certification $certification): JsonResponse
    {
        $certification->load(['caregiverProfile.user:id,name,email,phone', 'reviewer:id,name']);

        // Time-limited signed URL — admin pastes it into <img src=...> or
        // opens a new tab; the signature is the only authz. 15 minutes is
        // a single review session without leaving long-lived links in
        // browser history.
        $documentUrl = null;
        if ($certification->document_path
            && Storage::disk('private')->exists($certification->document_path)
        ) {
            $documentUrl = URL::temporarySignedRoute(
                'admin.certification.document',
                now()->addMinutes(15),
                ['certification' => $certification->id],
            );
        }

        return response()->json([
            'certification' => $certification,
            'document_url' => $documentUrl,
        ]);
    }

    public function verify(Request $request, Certification $certification): JsonResponse
    {
        $data = $request->validate([
            'expires_at' => ['sometimes', 'nullable', 'date'],
        ]);

        if (! in_array($certification->status, [
            Certification::STATUS_PENDING_REVIEW,
            Certification::STATUS_REJECTED,
            Certification::STATUS_SELF_REPORTED,
        ], true)) {
            return response()->json([
                'message' => 'This certification is already in a terminal state.',
            ], 422);
        }

        /** @var User $admin */
        $admin = $request->user();

        $previousStatus = $certification->status;
        $certification->update([
            'status' => Certification::STATUS_VERIFIED,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
            'expires_at' => $data['expires_at'] ?? $certification->expires_at,
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'certification.verified',
            targetType: AdminAuditLog::TARGET_CERTIFICATION,
            targetId: $certification->id,
            metadata: [
                'caregiver_user_id' => $certification->caregiverProfile->user_id,
                'name' => $certification->name,
                'previous_status' => $previousStatus,
            ],
        );

        return response()->json([
            'message' => 'Certification verified.',
            'certification' => $certification->fresh(),
        ]);
    }

    public function reject(Request $request, Certification $certification): JsonResponse
    {
        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        if (! in_array($certification->status, [
            Certification::STATUS_PENDING_REVIEW,
            Certification::STATUS_VERIFIED,
        ], true)) {
            return response()->json([
                'message' => 'Only pending or verified certifications can be rejected.',
            ], 422);
        }

        /** @var User $admin */
        $admin = $request->user();

        $previousStatus = $certification->status;
        $certification->update([
            'status' => Certification::STATUS_REJECTED,
            'rejection_reason' => $data['rejection_reason'],
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'certification.rejected',
            targetType: AdminAuditLog::TARGET_CERTIFICATION,
            targetId: $certification->id,
            metadata: [
                'caregiver_user_id' => $certification->caregiverProfile->user_id,
                'name' => $certification->name,
                'previous_status' => $previousStatus,
            ],
            reason: $data['rejection_reason'],
        );

        return response()->json([
            'message' => 'Certification rejected.',
            'certification' => $certification->fresh(),
        ]);
    }

    /**
     * Serve the uploaded document. Authorization is the signed URL
     * itself; sits outside the admin auth group so it can be pasted
     * into an <img src=...> or opened in a new tab.
     */
    public function document(Certification $certification): mixed
    {
        if (! $certification->document_path
            || ! Storage::disk('private')->exists($certification->document_path)
        ) {
            abort(404, 'File not found.');
        }

        $response = Storage::disk('private')->response($certification->document_path);
        // Same CORP override as the identity-doc preview — admin SPA on
        // :3000 needs to render bytes served from :8000.
        $response->headers->set('Cross-Origin-Resource-Policy', 'cross-origin');

        return $response;
    }
}
