<?php

namespace App\Http\Controllers;

use App\Http\Requests\Caregiver\StoreCertificationRequest;
use App\Http\Requests\Caregiver\UpdateCertificationRequest;
use App\Http\Requests\Caregiver\UploadCertificationDocumentRequest;
use App\Http\Resources\CertificationResource;
use App\Models\CaregiverProfile;
use App\Models\Certification;
use App\Models\User;
use App\Notifications\CertificationDocumentSubmitted;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Caregiver-side CRUD for /api/me/certifications. A cert without a document
 * is `self_reported`; the moment the caregiver attaches a PDF/image the row
 * flips to `pending_review` and the admin queue picks it up.
 *
 * The private-disk document path is never echoed back to the client —
 * preview only happens through the admin's signed-URL route in PR 4.
 */
class CertificationController extends Controller
{
    /**
     * List the authed caregiver's certifications.
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $profile = $this->profileForActor($request);
        if (! $profile instanceof CaregiverProfile) {
            return $profile;
        }

        return CertificationResource::collection($profile->certifications);
    }

    public function store(StoreCertificationRequest $request): CertificationResource|JsonResponse
    {
        $profile = $this->profileForActor($request);
        if (! $profile instanceof CaregiverProfile) {
            return $profile;
        }

        // Document is required as of the no-self-reported-creates change
        // (StoreCertificationRequest enforces this) — every new cert
        // starts at pending_review with bytes admin can verify. The
        // STATUS_SELF_REPORTED tier is kept for backfilled legacy rows
        // but no longer creatable through this endpoint.
        $cert = new Certification([
            'caregiver_profile_id' => $profile->id,
            'name' => $request->string('name')->toString(),
            'issuer' => $request->input('issuer'),
            'year' => $request->input('year'),
            'status' => Certification::STATUS_PENDING_REVIEW,
        ]);
        $cert->save();
        $path = $this->storeDocument($request, $profile, $cert);
        $cert->update(['document_path' => $path]);
        $this->notifyAdminsOfSubmission($cert->fresh(), $request->user(), isResubmit: false);

        return new CertificationResource($cert->fresh());
    }

    public function update(
        UpdateCertificationRequest $request,
        Certification $certification,
    ): CertificationResource|JsonResponse {
        $authz = $this->assertOwns($request, $certification);
        if ($authz instanceof JsonResponse) {
            return $authz;
        }

        $certification->update($request->validated());

        return new CertificationResource($certification->fresh());
    }

    public function uploadDocument(
        UploadCertificationDocumentRequest $request,
        Certification $certification,
    ): CertificationResource|JsonResponse {
        $authz = $this->assertOwns($request, $certification);
        if ($authz instanceof JsonResponse) {
            return $authz;
        }

        // Replace the existing document if there was one — keeps the
        // private disk tidy and prevents orphaned uploads.
        if ($certification->document_path) {
            Storage::disk('private')->delete($certification->document_path);
        }

        $wasReviewed = $certification->reviewed_at !== null;
        $path = $this->storeDocument($request, $certification->caregiverProfile, $certification);
        $certification->update([
            'document_path' => $path,
            'status' => Certification::STATUS_PENDING_REVIEW,
            // Reset previous review state — a fresh upload deserves a
            // fresh look.
            'reviewed_by' => null,
            'reviewed_at' => null,
            'rejection_reason' => null,
        ]);

        $this->notifyAdminsOfSubmission(
            $certification->fresh(),
            $request->user(),
            isResubmit: $wasReviewed,
        );

        return new CertificationResource($certification->fresh());
    }

    public function destroy(Request $request, Certification $certification): JsonResponse
    {
        $authz = $this->assertOwns($request, $certification);
        if ($authz instanceof JsonResponse) {
            return $authz;
        }

        if ($certification->document_path) {
            Storage::disk('private')->delete($certification->document_path);
        }

        $certification->delete();

        return response()->json(['message' => 'Certification removed.']);
    }

    /* ──────────── helpers ──────────── */

    private function profileForActor(Request $request): CaregiverProfile|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], Response::HTTP_FORBIDDEN);
        }

        $profile = $user->caregiverProfile;
        if (! $profile) {
            return response()->json(
                ['message' => 'Complete your caregiver profile first.'],
                Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        return $profile;
    }

    private function assertOwns(Request $request, Certification $certification): ?JsonResponse
    {
        $profile = $this->profileForActor($request);
        if (! $profile instanceof CaregiverProfile) {
            return $profile;
        }
        if ($certification->caregiver_profile_id !== $profile->id) {
            return response()->json(['message' => 'Not authorized.'], Response::HTTP_FORBIDDEN);
        }

        return null;
    }

    private function storeDocument(
        Request $request,
        CaregiverProfile $profile,
        Certification $cert,
    ): string {
        $file = $request->file('document');

        return $file->store("verifications/{$profile->user_id}/certs/{$cert->id}", 'private');
    }

    /**
     * Drop a cert-document submission into every active admin's
     * notification bell + inbox so the review queue isn't dependent on
     * someone refreshing /admin/certifications.
     */
    private function notifyAdminsOfSubmission(
        Certification $certification,
        User $caregiver,
        bool $isResubmit,
    ): void {
        $admins = User::where('role', 'admin')->where('status', 'active')->get();
        if ($admins->isEmpty()) {
            return;
        }
        Notification::send(
            $admins,
            new CertificationDocumentSubmitted($certification, $caregiver, $isResubmit),
        );
    }
}
