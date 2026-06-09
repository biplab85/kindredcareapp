<?php

namespace App\Http\Controllers;

use App\Models\Certification;
use App\Models\User;
use App\Models\VerificationRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaregiverController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'caregiver')
            ->whereHas('caregiverProfile', fn ($q) => $q->where('onboarding_complete', true))
            ->with(['caregiverProfile.services']);

        if ($request->query('verified_only', 'true') === 'true') {
            $query->whereDoesntHave('verificationRecords', function ($q) {
                $q->whereIn('check_type', VerificationRecord::ALL_CHECK_TYPES)
                    ->where('status', '!=', VerificationRecord::STATUS_CLEARED);
            })->whereHas('verificationRecords', function ($q) {
                $q->where('status', VerificationRecord::STATUS_CLEARED);
            });
        }

        if ($request->filled('service')) {
            $query->whereHas('caregiverProfile.services', fn ($q) => $q->where('slug', $request->service));
        }

        if ($request->filled('language')) {
            $query->whereHas('caregiverProfile', fn ($q) => $q->whereJsonContains('languages', $request->language));
        }

        if ($request->filled('rate_max')) {
            $query->whereHas('caregiverProfile', fn ($q) => $q->where('hourly_rate', '<=', $request->rate_max));
        }

        $caregivers = $query->paginate(20);

        return response()->json($caregivers);
    }

    public function show(int $caregiver): JsonResponse
    {
        $user = User::where('role', 'caregiver')
            ->where('id', $caregiver)
            ->with([
                'caregiverProfile.services',
                // Family-facing view: only show verified certs. Self-reported
                // (legacy backfill) and rejected/pending entries are private
                // to the caregiver — surfacing them would muddy the trust
                // signal families rely on the leaf-green badge for.
                'caregiverProfile.certifications' => fn ($q) => $q->where(
                    'status',
                    Certification::STATUS_VERIFIED,
                ),
                'verificationRecords',
            ])
            ->firstOrFail();

        return response()->json([
            'caregiver' => $user,
            'is_verified' => $user->isFullyVerified(),
        ]);
    }
}
