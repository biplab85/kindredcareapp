<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the family when the caregiver accepts their offer.
 * At this point the booking is confirmed and the full address is shared.
 */
class BookingConfirmed extends Notification
{
    use Queueable;

    public function __construct(public readonly Booking $booking) {}

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
        $caregiverName = $b->caregiver->name;
        $start = $b->scheduled_start->format('l F j, Y @ g:i A');
        $total = number_format($b->subtotal_cents / 100, 2);

        $msg = (new MailMessage)
            ->subject("{$caregiverName} accepted your booking")
            ->greeting("{$caregiverName} is confirmed.")
            ->line("When: {$start}")
            ->line("They'll arrive at {$b->address_full}.");

        // Only mention the hold when Stripe actually placed one. The stub
        // channel kept the legacy state machine working before we wired
        // real Stripe; surfacing it as a hold to the family would be a lie.
        if ($b->payment_status === Booking::PAYMENT_AUTHORIZED) {
            $msg->line("We've placed a \${$total} hold on your card on file. You won't be charged until the visit ends.");
        }

        return $msg
            ->line('You can message them through the booking page to share any last details.')
            ->action('View booking', url("/bookings/{$b->id}"));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'booking_confirmed',
            'booking_id' => $this->booking->id,
            'gig_id' => $this->booking->gig_id,
            'caregiver_user_id' => $this->booking->caregiver_user_id,
            'scheduled_start' => $this->booking->scheduled_start->toIso8601String(),
        ];
    }
}
