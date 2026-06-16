<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\BookingDispute;
use App\Services\StripePaymentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Runs every 5 minutes. Finds captured bookings whose 48-hour hold has
 * elapsed and no dispute is open, then creates a Stripe Transfer to the
 * caregiver's Connect account for their payout portion.
 *
 * Hold is matched to DISPUTE_WINDOW_HOURS so a late dispute can't fire
 * after Stripe has already moved money out of the platform balance —
 * the original mvp-requirements §4.9 said "24 hours" but that left a
 * 24-hour clawback exposure window.
 *
 * On the stub channel (Stripe not configured OR caregiver hasn't finished
 * Connect onboarding) the command just times the transfer locally so the
 * earnings dashboard shows "released" numbers — no money moves.
 */
class ReleasePayouts extends Command
{
    protected $signature = 'bookings:release-payouts';

    protected $description = 'Transfer captured booking payouts to caregivers after the 48-hour hold.';

    public function handle(StripePaymentService $stripe): int
    {
        $now = now();

        $candidates = Booking::query()
            ->whereIn('payment_status', [
                Booking::PAYMENT_CAPTURED,
                Booking::PAYMENT_CAPTURED_STUB,
            ])
            ->where('status', Booking::STATUS_COMPLETED)
            ->whereNotNull('payout_at')
            ->where('payout_at', '<', $now)
            ->whereNull('payout_transferred_at')
            ->get();

        if ($candidates->isEmpty()) {
            return self::SUCCESS;
        }

        $openDisputeBookingIds = BookingDispute::query()
            ->open()
            ->whereIn('booking_id', $candidates->pluck('id'))
            ->pluck('booking_id')
            ->all();

        $released = 0;

        foreach ($candidates as $booking) {
            if (in_array($booking->id, $openDisputeBookingIds, true)) {
                // Dispute in progress — skip until admin resolves it. A
                // future explicit freeze here isn't needed because
                // openDispute() has already nulled payout_at.
                continue;
            }

            try {
                $this->releaseOne($booking, $stripe);
                $released++;
            } catch (\Throwable $e) {
                report($e);
                $this->error("Failed to release payout for booking {$booking->id}: {$e->getMessage()}");
            }
        }

        if ($released > 0) {
            $this->info("Released {$released} payout(s).");
        }

        return self::SUCCESS;
    }

    private function releaseOne(Booking $booking, StripePaymentService $stripe): void
    {
        // Stub-mode bookings (Stripe not configured at runtime) carry no
        // real money — closing them out locally is the whole job. Real
        // bookings only close out when transferToCaregiver returns a
        // Transfer object; if it returned null (no Connect account yet,
        // payouts not enabled, Stripe API error), leave payout_transferred_at
        // null so the next cron tick retries. This is the lever that lets
        // a caregiver finish Connect onboarding *after* a visit completed
        // and still get paid automatically.
        $isStub = $booking->payment_status === Booking::PAYMENT_CAPTURED_STUB;

        DB::transaction(function () use ($booking, $stripe, $isStub) {
            $transfer = $stripe->transferToCaregiver($booking);

            if (! $isStub && $transfer === null) {
                return;
            }

            $booking->update([
                'payout_transferred_at' => now(),
                'stripe_transfer_id' => $transfer?->id,
            ]);
        });
    }
}
