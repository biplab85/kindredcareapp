<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin audit-log viewer. Read-only — rows are immutable once written.
 *
 * Filterable by acting admin, action slug, target type/id, and date range.
 * Paginated with a generous default since admins commonly scroll back.
 */
class AuditLogController extends Controller
{
    private const ALLOWED_TARGET_TYPES = [
        AdminAuditLog::TARGET_USER,
        AdminAuditLog::TARGET_VERIFICATION_RECORD,
        AdminAuditLog::TARGET_PANIC_ALERT,
        AdminAuditLog::TARGET_INCIDENT_REPORT,
        AdminAuditLog::TARGET_BOOKING,
    ];

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admin_user_id' => ['sometimes', 'nullable', 'integer'],
            'action' => ['sometimes', 'nullable', 'string', 'max:64'],
            'target_type' => ['sometimes', 'nullable', Rule::in(self::ALLOWED_TARGET_TYPES)],
            'target_id' => ['sometimes', 'nullable', 'integer'],
            'from' => ['sometimes', 'nullable', 'date'],
            'to' => ['sometimes', 'nullable', 'date'],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:100'],
        ]);

        $query = AdminAuditLog::query()->with('admin:id,name,email,role');

        if (! empty($data['admin_user_id'])) {
            $query->where('admin_user_id', $data['admin_user_id']);
        }
        if (! empty($data['action'])) {
            $query->where('action', $data['action']);
        }
        if (! empty($data['target_type'])) {
            $query->where('target_type', $data['target_type']);
        }
        if (! empty($data['target_id'])) {
            $query->where('target_id', $data['target_id']);
        }
        if (! empty($data['from'])) {
            $query->where('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            // Inclusive end-of-day so a single date in `to` covers the full day.
            $query->where('created_at', '<=', $data['to'].' 23:59:59');
        }

        $rows = $query
            ->orderByDesc('id')
            ->paginate($data['per_page'] ?? 50);

        return response()->json([
            'data' => $rows->getCollection()->map(fn (AdminAuditLog $row) => $this->present($row))->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(AdminAuditLog $row): array
    {
        /** @var User|null $admin */
        $admin = $row->admin;
        $createdAt = $row->getAttribute('created_at');

        return [
            'id' => $row->id,
            'action' => $row->action,
            'target_type' => $row->target_type,
            'target_id' => $row->target_id,
            'metadata' => $row->metadata,
            'reason' => $row->reason,
            'created_at' => $createdAt instanceof CarbonInterface
                ? $createdAt->toIso8601String()
                : null,
            'admin' => $admin !== null
                ? [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                    'role' => $admin->role,
                ]
                : null,
        ];
    }
}
