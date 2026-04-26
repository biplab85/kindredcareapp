<?php

namespace App\Http\Controllers;

use App\Http\Requests\Emergency\SubmitIncidentRequest;
use App\Http\Requests\Emergency\TriggerPanicRequest;
use App\Http\Resources\IncidentReportResource;
use App\Http\Resources\PanicAlertResource;
use App\Models\Booking;
use App\Models\PanicAlert;
use App\Models\User;
use App\Services\SafetyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EmergencyController extends Controller
{
    public function __construct(private readonly SafetyService $service) {}

    /**
     * Caregiver-triggered panic. Scoped to a booking so admin sees the
     * full context (address, family, schedule).
     */
    public function panic(TriggerPanicRequest $request): PanicAlertResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        /** @var Booking $booking */
        $booking = Booking::findOrFail($request->integer('booking_id'));

        // If there's already an active alert for this booking, return it
        // with a 409 so the client knows help was already called in.
        $existing = $booking->panicAlerts()
            ->whereIn('status', PanicAlert::OPEN_STATUSES)
            ->latest('triggered_at')
            ->first();

        if ($existing !== null) {
            return (new PanicAlertResource($existing->load('caregiver')))
                ->response()
                ->setStatusCode(Response::HTTP_CONFLICT);
        }

        $alert = $this->service->triggerPanic(
            booking: $booking,
            caregiver: $user,
            lat: $request->has('latitude') ? (float) $request->input('latitude') : null,
            lng: $request->has('longitude') ? (float) $request->input('longitude') : null,
            silent: $request->boolean('silent'),
        );

        return (new PanicAlertResource($alert->load('caregiver')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Caregiver-only pre-visit safety acknowledgement. Called before the
     * Start Visit GPS capture so the visit timeline has an audit trail.
     */
    public function safetyAck(Request $request, Booking $booking): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $fresh = $this->service->acknowledgeSafety($booking, $user);

        return response()->json([
            'data' => [
                'booking_id' => $fresh->id,
                'safety_acknowledged_at' => $fresh->safety_acknowledged_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Incident report submission. Either party may file; admin triages.
     */
    public function submitIncident(SubmitIncidentRequest $request, Booking $booking): IncidentReportResource|JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        /** @var array<int, string> $evidence */
        $evidence = (array) $request->input('evidence_paths', []);

        $incident = $this->service->submitIncident(
            booking: $booking,
            reporter: $user,
            type: $request->string('type')->toString(),
            severity: $request->string('severity')->toString(),
            description: $request->string('description')->toString(),
            evidencePaths: $evidence,
        );

        return (new IncidentReportResource($incident->load('reporter')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
