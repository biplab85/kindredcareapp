<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\User;
use App\Services\AdminAuditLogger;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Phase 14.5 — admin account CRUD. A separate controller from the
 * generic UserController because admin-account creation has tighter
 * rules:
 *   - Only admins can create admins (gated by route middleware)
 *   - Created accounts get a randomized password — admin sets one via
 *     password-reset flow. Reduces credential leakage during creation.
 *   - All transitions land on the audit log
 *
 * Mandatory TOTP enforcement is deferred to Phase 15 security hardening
 * — admin accounts can opt-in via the existing Fortify 2FA flow today,
 * but the platform doesn't refuse logins without it yet.
 */
class AdminAccountController extends Controller
{
    public function __construct(private readonly AdminAuditLogger $auditLogger) {}

    public function index(Request $request): JsonResponse
    {
        // Admin accounts are typically a handful — paginate generously.
        $admins = User::query()
            ->where('role', 'admin')
            ->orderBy('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $admins->map(fn (User $u) => $this->present($u))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:120', Rule::unique('users', 'email')],
        ]);

        /** @var User $actor */
        $actor = $request->user();

        // Random password — admin claims it via the standard reset flow.
        $tempPassword = Str::random(24);

        $admin = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($tempPassword),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->auditLogger->record(
            admin: $actor,
            action: 'admin.created',
            targetType: AdminAuditLog::TARGET_USER,
            targetId: $admin->id,
            metadata: [
                'created_email' => $admin->email,
            ],
        );

        return response()->json([
            'data' => $this->present($admin),
            'message' => 'Admin created. Have them claim their account via the password-reset flow.',
        ], 201);
    }

    public function update(Request $request, User $admin): JsonResponse
    {
        if ($admin->role !== 'admin') {
            return response()->json([
                'message' => 'Target user is not an admin.',
            ], 422);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:120', Rule::unique('users', 'email')->ignore($admin->id)],
        ]);

        if ($data === []) {
            return response()->json([
                'message' => 'No changes specified.',
            ], 422);
        }

        /** @var User $actor */
        $actor = $request->user();

        $changes = [];
        foreach ($data as $key => $value) {
            if ($admin->{$key} !== $value) {
                $changes[$key] = ['from' => $admin->{$key}, 'to' => $value];
                $admin->{$key} = $value;
            }
        }
        $admin->save();

        if ($changes !== []) {
            $this->auditLogger->record(
                admin: $actor,
                action: 'admin.updated',
                targetType: AdminAuditLog::TARGET_USER,
                targetId: $admin->id,
                metadata: ['changes' => $changes],
            );
        }

        return response()->json([
            'data' => $this->present($admin->fresh()),
        ]);
    }

    public function destroy(Request $request, User $admin): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        if ($admin->role !== 'admin') {
            return response()->json(['message' => 'Target user is not an admin.'], 422);
        }

        if ($admin->id === $actor->id) {
            return response()->json([
                'message' => 'You cannot deactivate your own admin account.',
            ], 422);
        }

        if ($admin->status === 'suspended') {
            return response()->json([
                'message' => 'Admin is already deactivated.',
            ], 422);
        }

        // Active admin tokens get revoked so deactivation takes effect
        // immediately — no waiting for sessions to time out.
        $admin->tokens()->delete();

        $admin->update(['status' => 'suspended']);

        $this->auditLogger->record(
            admin: $actor,
            action: 'admin.deactivated',
            targetType: AdminAuditLog::TARGET_USER,
            targetId: $admin->id,
        );

        return response()->json([
            'data' => $this->present($admin->fresh()),
            'message' => 'Admin deactivated. They cannot log in until reactivated.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'two_factor_enabled' => $user->getAttribute('two_factor_confirmed_at') !== null,
            'created_at' => $user->getAttribute('created_at') instanceof CarbonInterface
                ? $user->getAttribute('created_at')->toIso8601String()
                : null,
        ];
    }
}
