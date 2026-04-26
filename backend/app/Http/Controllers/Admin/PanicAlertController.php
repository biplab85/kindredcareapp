<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PanicAlertResource;
use App\Models\AdminAuditLog;
use App\Models\PanicAlert;
use App\Models\User;
use App\Services\AdminAuditLogger;
use App\Services\SafetyService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PanicAlertController extends Controller
{
    public function __construct(
        private readonly SafetyService $service,
        private readonly AdminAuditLogger $auditLogger,
    ) {}

    /**
     * Admin safety queue. Active alerts first, then acknowledged, then
     * resolved (most recent first within each group).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filter = $request->string('status')->toString();

        $query = PanicAlert::query()->with('caregiver');

        if ($filter === 'open') {
            $query->open();
        } elseif ($filter === 'resolved') {
            $query->where('status', PanicAlert::STATUS_RESOLVED);
        }

        // Active first, then acknowledged, then resolved — newest first within each.
        // CASE expression keeps the ordering portable across MySQL and SQLite
        // (FIELD() doesn't exist on SQLite, which the test suite runs against).
        $alerts = $query
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'acknowledged' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END")
            ->orderByDesc('triggered_at')
            ->limit(100)
            ->get();

        return PanicAlertResource::collection($alerts);
    }

    public function acknowledge(Request $request, PanicAlert $panicAlert): PanicAlertResource
    {
        /** @var User $user */
        $user = $request->user();

        $fresh = $this->service->acknowledgePanic($panicAlert, $user);

        $this->auditLogger->record(
            admin: $user,
            action: 'panic.acknowledged',
            targetType: AdminAuditLog::TARGET_PANIC_ALERT,
            targetId: $panicAlert->id,
            metadata: ['booking_id' => $panicAlert->booking_id],
        );

        return new PanicAlertResource($fresh->load('caregiver'));
    }

    public function resolve(Request $request, PanicAlert $panicAlert): PanicAlertResource
    {
        $request->validate(['note' => ['nullable', 'string', 'max:2000']]);

        /** @var User $user */
        $user = $request->user();

        $note = $request->input('note');
        $fresh = $this->service->resolvePanic($panicAlert, $user, $note);

        $this->auditLogger->record(
            admin: $user,
            action: 'panic.resolved',
            targetType: AdminAuditLog::TARGET_PANIC_ALERT,
            targetId: $panicAlert->id,
            metadata: ['booking_id' => $panicAlert->booking_id],
            reason: is_string($note) ? $note : null,
        );

        return new PanicAlertResource($fresh->load('caregiver'));
    }

    public function show(PanicAlert $panicAlert): PanicAlertResource
    {
        return new PanicAlertResource($panicAlert->load('caregiver'));
    }
}
