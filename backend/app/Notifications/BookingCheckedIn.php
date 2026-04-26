<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the family on caregiver check-in. The "arrival" message referenced
 * in platform-workflow.md §5.2 ("your caregiver has arrived").
 */
class BookingCheckedIn extends Notification
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
        $time = $b->check_in_at?->format('g:i A') ?? 'just now';

        return (new MailMessage)
            ->subject("{$caregiverName} has arrived")
            ->greeting("{$caregiverName} started the visit at {$time}.")
            ->line('You can follow the visit on the booking page and reach them through the thread.')
            ->action('View booking', url("/bookings/{$b->id}"));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'booking_checked_in',
            'booking_id' => $this->booking->id,
            'gig_id' => $this->booking->gig_id,
            'caregiver_user_id' => $this->booking->caregiver_user_id,
            'check_in_at' => $this->booking->check_in_at?->toIso8601String(),
        ];
    }
}
