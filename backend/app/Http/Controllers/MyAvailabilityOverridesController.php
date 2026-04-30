<?php

namespace App\Http\Controllers;

use App\Models\CaregiverAvailabilityOverride;
use App\Models\CaregiverProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-date "off" overrides for the signed-in caregiver. The weekly
 * template lives elsewhere (CaregiverProfile::availability); this
 * controller covers exceptions on top of it (Eid, vacation, sick days).
 *
 * Existence of a row = caregiver is off that day. Removing it = back
 * to the weekly default.
 */
class MyAvailabilityOverridesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->caregiverProfile;

        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], 403);
        }

        if (! $profile) {
            return response()->json(['overrides' => []]);
        }

        $rows = $profile->availabilityOverrides()
            ->orderBy('date')
            ->get(['id', 'date', 'note']);

        return response()->json([
            'overrides' => $rows->map(fn (CaregiverAvailabilityOverride $o) => [
                'id' => $o->id,
                'date' => $o->date->toDateString(),
                'note' => $o->note,
            ])->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->isCaregiver()) {
            return response()->json(['message' => 'Caregivers only.'], 403);
        }

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'note' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $profile = CaregiverProfile::firstOrCreate(['user_id' => $user->id]);

        $date = CarbonImmutable::parse($validated['date'])->toDateString();

        // Upsert by (caregiver_profile_id, date) — re-marking a date already
        // off is idempotent; the second POST just updates the note.
        $override = CaregiverAvailabilityOverride::updateOrCreate(
            [
                'caregiver_profile_id' => $profile->id,
                'date' => $date,
            ],
            ['note' => $validated['note'] ?? null],
        );

        return response()->json([
            'override' => [
                'id' => $override->id,
                'date' => $override->date->toDateString(),
                'note' => $override->note,
            ],
        ], 201);
    }

    public function destroy(Request $request, CaregiverAvailabilityOverride $override): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = $user->caregiverProfile;

        if (! $profile || $override->caregiver_profile_id !== $profile->id) {
            return response()->json(['message' => 'You can only remove your own overrides.'], 403);
        }

        $override->delete();

        return response()->json([], 204);
    }
}
