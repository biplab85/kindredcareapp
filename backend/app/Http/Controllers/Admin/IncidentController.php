<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\IncidentReportResource;
use App\Models\AdminAuditLog;
use App\Models\IncidentReport;
use App\Models\User;
use App\Services\AdminAuditLogger;
use App\Services\SafetyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class IncidentController extends Controller
{
    public function __construct(
        private readonly SafetyService $service,
        private readonly AdminAuditLogger $auditLogger,
    ) {}

    /**
     * Admin incident queue. Critical-severity open incidents surface
     * first; then high; then medium/low. Resolved/dismissed drop to
     * the bottom.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filter = $request->string('status')->toString();

        $query = IncidentReport::query()->with('reporter');

        if ($filter === 'open') {
            $query->open();
        } elseif ($filter === 'resolved') {
            $query->whereIn('status', [IncidentReport::STATUS_RESOLVED, IncidentReport::STATUS_DISMISSED]);
        }

        // CASE expression keeps the ordering portable across MySQL and SQLite
        // (FIELD() doesn't exist on SQLite, which the test suite runs against).
        $incidents = $query
            ->orderByRaw("CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 WHEN 'resolved' THEN 2 WHEN 'dismissed' THEN 3 ELSE 4 END")
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return IncidentReportResource::collection($incidents);
    }

    public function show(IncidentReport $incident): IncidentReportResource
    {
        return new IncidentReportResource($incident->load('reporter'));
    }

    /**
     * Update incident state — assignment + status transitions.
     */
    public function update(Request $request, IncidentReport $incident): IncidentReportResource|JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $data = $request->validate([
            'action' => ['required', 'string', Rule::in(['assign', 'resolve', 'dismiss'])],
            'assignee_user_id' => ['required_if:action,assign', 'integer', 'exists:users,id'],
            'note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        $fresh = match ($data['action']) {
            'assign' => $this->service->assignIncident(
                $incident,
                $admin,
                User::findOrFail($data['assignee_user_id']),
            ),
            'resolve' => $this->service->resolveIncident(
                $incident,
                $admin,
                IncidentReport::STATUS_RESOLVED,
                $data['note'] ?? null,
            ),
            'dismiss' => $this->service->resolveIncident(
                $incident,
                $admin,
                IncidentReport::STATUS_DISMISSED,
                $data['note'] ?? null,
            ),
            default => null,
        };

        // Validation already constrains action to one of these three; the
        // default keeps PHPStan happy without a phantom branch.
        $auditAction = match ($data['action']) {
            'assign' => 'incident.assigned',
            'resolve' => 'incident.resolved',
            'dismiss' => 'incident.dismissed',
            default => 'incident.'.$data['action'],
        };

        $this->auditLogger->record(
            admin: $admin,
            action: $auditAction,
            targetType: AdminAuditLog::TARGET_INCIDENT_REPORT,
            targetId: $incident->id,
            metadata: [
                'severity' => $incident->severity,
                'type' => $incident->type,
                'assignee_user_id' => $data['assignee_user_id'] ?? null,
            ],
            reason: $data['note'] ?? null,
        );

        return new IncidentReportResource($fresh->load('reporter'));
    }
}
