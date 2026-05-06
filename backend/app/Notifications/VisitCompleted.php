<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to both parties when the visit ends. The family sees a post-visit
 * prompt to rate and review; the caregiver sees the payout summary. We use
 * a single class with a forFamily flag because the content only differs in
 * the CTA line — cheaper than two near-identical notifications.
 */
class VisitCompleted extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Booking $booking,
        public readonly bool $forFamily,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $b = $this->booking;
        $minutes = $b->check_in_at && $b->check_out_at
            ? (int) $b->check_in_at->diffInMinutes($b->check_out_at, absolute: true)
            : $b->duration_minutes;
        $duration = $this->humanDuration($minutes);

        $msg = (new MailMessage)
            ->subject('Visit completed')
            ->greeting('The visit has wrapped up.')
            ->line("Duration: {$duration}");

        if ($this->forFamily) {
            // Show the actual captured amount, not the original subtotal —
            // partial captures (short visits) charge less than booked.
            // PaymentIntent IDs are absent on stub bookings; gate the
            // receipt line on real Stripe so we don't promise a charge
            // that didn't happen.
            if ($b->payment_status === Booking::PAYMENT_CAPTURED) {
                $charged = number_format($b->subtotal_cents / 100, 2);
                $msg->line("We charged \${$charged} to your card on file.");
            }

            return $msg
                ->line('We\'d love your rating and any notes while it\'s fresh.')
                ->action('Rate this visit', config('app.frontend_url')."/bookings/{$b->id}");
        }

        $payout = number_format($b->caregiver_payout_cents / 100, 2);

        return $msg
            ->line("Your payout for this visit: \${$payout}.")
            ->action('View booking', config('app.frontend_url')."/bookings/{$b->id}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'visit_completed',
            'booking_id' => $this->booking->id,
            'for_family' => $this->forFamily,
            'check_out_at' => $this->booking->check_out_at?->toIso8601String(),
        ];
    }

    private function humanDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return "{$minutes} min";
        }
        $hours = intdiv($minutes, 60);
        $rem = $minutes % 60;

        return $rem === 0 ? "{$hours} hr" : "{$hours} hr {$rem} min";
    }
}
