<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the family when the cascade is fully exhausted — every ranked
 * caregiver either declined or let the offer expire. The gig returns to
 * the open pool for re-matching.
 */
class BookingExpired extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Booking $closedBooking,
        public readonly string $outcome, // 'declined' | 'expired'
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
        return (new MailMessage)
            ->subject('No match found yet for your gig')
            ->greeting("We've run out of ranked caregivers.")
            ->line('Every candidate on the shortlist either declined or let their window pass.')
            ->line('Your gig is back in the open pool. Try broadening preferences or switching it to an open call so more caregivers can see it.')
            ->action('Review the gig', url("/gigs/{$this->closedBooking->gig_id}"));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'booking_cascade_exhausted',
            'closed_booking_id' => $this->closedBooking->id,
            'gig_id' => $this->closedBooking->gig_id,
            'outcome' => $this->outcome,
        ];
    }
}
