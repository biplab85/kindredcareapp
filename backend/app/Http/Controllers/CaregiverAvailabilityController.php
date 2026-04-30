<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only window of a caregiver's "live" booking slots so the family
 * booking form can hard-block conflicts before the user even hits Submit.
 *
 * Authoritative double-booking prevention lives in BookingService::createFromGig
 * (transaction + lockForUpdate); this endpoint is the friendly-UX cousin.
 */
class CaregiverAvailabilityController extends Controller
{
    /** Default look-ahead range when the client doesn't supply one. */
    private const DEFAULT_DAYS = 90;

    /** Hard cap on the look-ahead range to keep response payloads bounded. */
    private const MAX_DAYS = 180;

    public function bookedWindows(Request $request, User $user): JsonResponse
    {
        $now = CarbonImmutable::now()->startOfDay();

        $from = $this->parseDate($request->input('from')) ?? $now;
        $to = $this->parseDate($request->input('to')) ?? $from->addDays(self::DEFAULT_DAYS)->endOfDay();

        // Normalise: end-of-day on the upper bound so date-only inputs include the whole day.
        $to = $to->endOfDay();

        // Cap absurd ranges so a curious caller can't pull thousands of rows.
        if ($from->diffInDays($to, absolute: true) > self::MAX_DAYS) {
            $to = $from->addDays(self::MAX_DAYS)->endOfDay();
        }

        $windows = Booking::query()
            ->where('caregiver_user_id', $user->id)
            ->active()
            ->where('scheduled_start', '<', $to)
            ->where('scheduled_end', '>', $from)
            ->orderBy('scheduled_start')
            ->get(['scheduled_start', 'scheduled_end', 'status']);

        return response()->json([
            'windows' => $windows->map(fn (Booking $b) => [
                'scheduled_start' => $b->scheduled_start->toIso8601String(),
                'scheduled_end' => $b->scheduled_end->toIso8601String(),
                'status' => $b->status,
            ])->all(),
        ]);
    }

    private function parseDate(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
