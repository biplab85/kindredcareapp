<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the family when the caregiver declines (or the offer expired
 * and there's a next-ranked candidate to try automatically).
 */
class BookingDeclined extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Booking $closedBooking,
        public readonly string $outcome, // 'declined' | 'expired'
        public readonly Booking $nextBooking,
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
        $prev = $this->closedBooking->caregiver->name;
        $verb = $this->outcome === 'expired' ? 'missed the window' : 'declined';

        return (new MailMessage)
            ->subject('Trying the next match for your gig')
            ->greeting("{$prev} {$verb}.")
            ->line("We've sent the booking to the next-ranked caregiver.")
            ->line('They have some time to respond. We\'ll notify you as soon as we hear back.')
            ->action('View booking', config('app.frontend_url')."/bookings/{$this->nextBooking->id}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'booking_declined_cascading',
            'closed_booking_id' => $this->closedBooking->id,
            'next_booking_id' => $this->nextBooking->id,
            'outcome' => $this->outcome,
        ];
    }
}
