<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserConsent;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * PIPEDA consent management. Users see their current consent state across
 * all kinds, and can grant or revoke each one independently. Every change
 * lands an append-only row in `user_consents` so we can prove what was
 * agreed to and when.
 *
 * Marketing-channel revocations are honored immediately; ToS / privacy
 * revocations effectively disable the account (UI flow forces re-consent
 * before further use).
 */
class ConsentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $latest = $this->latestPerKind($user);

        $payload = [];
        foreach (UserConsent::ALL_KINDS as $kind) {
            $row = $latest[$kind] ?? null;
            $payload[$kind] = [
                'kind' => $kind,
                'granted' => $row !== null && (bool) $row->granted,
                'policy_version' => $row?->policy_version,
                'updated_at' => $row?->created_at instanceof CarbonInterface
                    ? $row->created_at->toIso8601String()
                    : null,
            ];
        }

        return response()->json(['data' => array_values($payload)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(UserConsent::ALL_KINDS)],
            'granted' => ['required', 'boolean'],
            'policy_version' => ['sometimes', 'nullable', 'string', 'max:16'],
        ]);

        /** @var User $user */
        $user = $request->user();

        $row = UserConsent::create([
            'user_id' => $user->id,
            'kind' => $data['kind'],
            'granted' => $data['granted'],
            'policy_version' => $data['policy_version'] ?? null,
            'ip_address' => $request->ip(),
            'user_agent' => mb_strimwidth((string) $request->userAgent(), 0, 255, ''),
        ]);

        return response()->json([
            'data' => [
                'kind' => $row->kind,
                'granted' => (bool) $row->granted,
                'policy_version' => $row->policy_version,
                'updated_at' => $row->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * @return array<string, UserConsent>
     */
    private function latestPerKind(User $user): array
    {
        // Build a single-pass map of kind → latest row. Since the table
        // is append-only, ordering by id desc is equivalent to ordering
        // by created_at desc and avoids any timestamp-tie ambiguity.
        $rows = UserConsent::query()
            ->where('user_id', $user->id)
            ->whereIn('kind', UserConsent::ALL_KINDS)
            ->orderByDesc('id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            if (! array_key_exists($row->kind, $map)) {
                $map[$row->kind] = $row;
            }
        }

        return $map;
    }
}
