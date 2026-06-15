<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Booking;
use App\Models\Review;
use App\Models\User;
use App\Models\VerificationRecord;
use App\Services\AccountAnonymizer;
use App\Services\AdminAuditLogger;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin user management. Search, browse, suspend, reactivate, and
 * (eventually) delete accounts.
 *
 * Suspension is the platform's kill-switch: the MatchingEngine already
 * filters on `users.status != 'suspended'`, so flipping the status is
 * enough to pull a bad caregiver out of the pool immediately.
 */
class UserController extends Controller
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_DELETED = 'deleted';

    public function __construct(private readonly AdminAuditLogger $auditLogger) {}

    /**
     * Admin-side user search. Supports free-text search across name, email,
     * phone, and numeric id; role + status filters; and keyset pagination.
     * Caps at 50 rows per page — admins who need more should refine the
     * search rather than scroll.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'role' => ['sometimes', 'nullable', Rule::in(['family', 'caregiver', 'admin'])],
            'status' => [
                'sometimes',
                'nullable',
                Rule::in([self::STATUS_ACTIVE, self::STATUS_SUSPENDED, self::STATUS_DELETED]),
            ],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:50'],
        ]);

        $query = User::query()->withCount([
            'verificationRecords as cleared_checks' => fn ($q) => $q->where(
                'status',
                VerificationRecord::STATUS_CLEARED,
            ),
        ]);

        if (! empty($data['q'])) {
            $q = trim($data['q']);
            $query->where(function ($sub) use ($q) {
                if (ctype_digit($q)) {
                    // Numeric queries: id match OR phone LIKE. Skipping email
                    // here keeps the noise down — emails routinely contain
                    // digits in the local-part.
                    $sub->where('id', (int) $q)
                        ->orWhere('phone', 'like', "%{$q}%");
                } else {
                    $sub->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%")
                        ->orWhere('phone', 'like', "%{$q}%");
                }
            });
        }

        if (! empty($data['role'])) {
            $query->where('role', $data['role']);
        }

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        $users = $query->orderByDesc('id')->paginate($data['per_page'] ?? 25);

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $user) => $this->card($user))->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Full user detail — verification history, booking summary, rating
     * rollup. Avoids N+1 by eager-loading the pieces upfront.
     */
    public function show(User $user): JsonResponse
    {
        $user->load([
            'verificationRecords',
            'caregiverProfile',
            'familyProfile',
        ]);
        $user->loadCount([
            'verificationRecords as cleared_checks' => fn ($q) => $q->where(
                'status',
                VerificationRecord::STATUS_CLEARED,
            ),
        ]);

        // Booking tallies — caregiver-side AND family-side, so the admin
        // sees the full footprint for whichever hat the user wears.
        $caregiverBookings = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $familyBookings = collect();
        if ($user->familyProfile !== null) {
            $familyBookings = Booking::query()
                ->where('family_profile_id', $user->familyProfile->id)
                ->selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status');
        }

        $reviewStats = Review::query()
            ->where('ratee_user_id', $user->id)
            ->whereNotNull('visible_at')
            ->selectRaw('COUNT(*) as count, AVG(stars) as avg_stars')
            ->first();

        $reviewCount = $reviewStats !== null ? (int) ($reviewStats->getAttribute('count') ?? 0) : 0;
        $reviewAvgRaw = $reviewStats?->getAttribute('avg_stars');

        return response()->json([
            'data' => [
                ...$this->card($user),
                'date_of_birth' => $this->isoDate($user->date_of_birth),
                'gender' => $user->gender,
                'created_at' => $this->isoTimestamp($user->created_at),
                'updated_at' => $this->isoTimestamp($user->updated_at),
                'verification_records' => $user->verificationRecords
                    ->sortBy('check_type')
                    ->values()
                    ->map(fn (VerificationRecord $r) => [
                        'id' => $r->id,
                        'check_type' => $r->check_type,
                        'status' => $r->status,
                        'provider' => $r->provider,
                        'updated_at' => $this->isoTimestamp($r->updated_at),
                    ]),
                'bookings' => [
                    'as_caregiver' => [
                        'total' => (int) $caregiverBookings->sum(),
                        'by_status' => $caregiverBookings,
                    ],
                    'as_family' => [
                        'total' => (int) $familyBookings->sum(),
                        'by_status' => $familyBookings,
                    ],
                ],
                'ratings' => [
                    'count' => $reviewCount,
                    'average_stars' => $reviewAvgRaw !== null
                        ? round((float) $reviewAvgRaw, 2)
                        : null,
                ],
            ],
        ]);
    }

    public function suspend(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        if ($user->id === $admin->id) {
            return response()->json([
                'message' => 'You cannot suspend your own account.',
            ], 422);
        }

        if ($user->status === self::STATUS_SUSPENDED) {
            return response()->json([
                'message' => 'User is already suspended.',
            ], 422);
        }

        $previousStatus = $user->status;
        $user->status = self::STATUS_SUSPENDED;
        $user->save();

        $this->auditLogger->record(
            admin: $admin,
            action: 'user.suspended',
            targetType: AdminAuditLog::TARGET_USER,
            targetId: $user->id,
            metadata: ['previous_status' => $previousStatus],
            reason: $data['reason'],
        );

        return response()->json([
            'data' => [
                ...$this->card($user->fresh()),
                'suspension_reason' => $data['reason'],
            ],
        ]);
    }

    public function reactivate(Request $request, User $user): JsonResponse
    {
        if ($user->status !== self::STATUS_SUSPENDED) {
            return response()->json([
                'message' => 'User is not currently suspended.',
            ], 422);
        }

        /** @var User $admin */
        $admin = $request->user();

        $user->status = self::STATUS_ACTIVE;
        $user->save();

        $this->auditLogger->record(
            admin: $admin,
            action: 'user.reactivated',
            targetType: AdminAuditLog::TARGET_USER,
            targetId: $user->id,
        );

        return response()->json([
            'data' => $this->card($user->fresh()),
        ]);
    }

    /**
     * Admin marks a user's email as verified without going through the
     * self-service flow. Used when the user phoned in / verified another
     * way, or when batch-onboarded users got an invalid welcome email and
     * the team confirmed identity directly.
     *
     * Stamps email_verified_at = now(). Audit-logged so the override is
     * inspectable later.
     */
    public function markEmailVerified(Request $request, User $user): JsonResponse
    {
        if ($user->email_verified_at !== null) {
            return response()->json([
                'message' => 'This user\'s email is already verified.',
            ], 422);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        $user->email_verified_at = now();
        $user->save();

        $this->auditLogger->record(
            admin: $admin,
            action: 'user.email_verified_by_admin',
            targetType: AdminAuditLog::TARGET_USER,
            targetId: $user->id,
            reason: $data['reason'],
        );

        return response()->json([
            'data' => $this->card($user->fresh()),
        ]);
    }

    /**
     * Admin-initiated deletion. Reuses the Phase 15 AccountAnonymizer so
     * the same anonymization rules apply whether the user clicked
     * "Delete my account" or an admin removed them for cause. Reason is
     * required (audit trail) and admins cannot delete themselves.
     */
    public function destroy(Request $request, User $user, AccountAnonymizer $anonymizer): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        if ($user->id === $admin->id) {
            return response()->json([
                'message' => 'You cannot delete your own account from the admin surface.',
            ], 422);
        }

        if ($user->status === self::STATUS_DELETED) {
            return response()->json([
                'message' => 'User is already deleted.',
            ], 422);
        }

        $previousStatus = $user->status;
        $userId = $user->id;

        $anonymizer->anonymize($user);

        $this->auditLogger->record(
            admin: $admin,
            action: 'user.deleted',
            targetType: AdminAuditLog::TARGET_USER,
            targetId: $userId,
            metadata: [
                'previous_status' => $previousStatus,
            ],
            reason: $data['reason'],
        );

        return response()->json([
            'message' => 'Account anonymized. Personal data has been removed; financial records retained for 7 years per CRA.',
            'user_id' => $userId,
        ]);
    }

    /**
     * Compact card used by both index + show. Keeps the admin list light
     * but surfaces the two counters most useful at a glance: open booking
     * count and the verification-cleared count.
     *
     * @return array<string, mixed>
     */
    private function card(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'email_verified_at' => $this->isoTimestamp($user->email_verified_at),
            'phone_verified_at' => $this->isoTimestamp($user->phone_verified_at),
            'cleared_checks' => (int) ($user->getAttribute('cleared_checks') ?? 0),
            'total_checks' => count(VerificationRecord::ALL_CHECK_TYPES),
        ];
    }

    private function isoTimestamp(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toIso8601String() : null;
    }

    private function isoDate(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toDateString() : null;
    }
}
