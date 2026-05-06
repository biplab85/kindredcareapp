<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the caregiver when a family books them for a gig.
 * The offer is pending until they accept, decline, or the window expires.
 */
class BookingOffered extends Notification
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
        $start = $b->scheduled_start->format('l F j, Y @ g:i A');
        $total = number_format($b->subtotal_cents / 100, 2);
        $payout = number_format($b->caregiver_payout_cents / 100, 2);
        $deadline = $b->response_deadline_at->diffForHumans();

        return (new MailMessage)
            ->subject('New booking offer on KindredCare')
            ->greeting('A family would like to book you.')
            ->line("When: {$start}")
            ->line("Where: {$b->address_full}")
            ->line('Duration: '.($b->duration_minutes / 60).' hours')
            ->line("Family pays: \${$total} (includes the 7.5% platform fee)")
            ->line("Your earnings: \${$payout}")
            ->line("Please respond before: {$deadline}.")
            ->action('Review the booking', config('app.frontend_url')."/bookings/{$b->id}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'booking_offered',
            'booking_id' => $this->booking->id,
            'gig_id' => $this->booking->gig_id,
            'scheduled_start' => $this->booking->scheduled_start->toIso8601String(),
            'response_deadline_at' => $this->booking->response_deadline_at->toIso8601String(),
            'caregiver_payout_cents' => $this->booking->caregiver_payout_cents,
        ];
    }
}
