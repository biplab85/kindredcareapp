<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the non-cancelling party when a booking is cancelled.
 */
class BookingCancelled extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Booking $booking,
        public readonly string $cancelledBy, // 'family' | 'caregiver' | 'system'
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
        $who = match ($this->cancelledBy) {
            Booking::CANCELLED_BY_FAMILY => 'The family',
            Booking::CANCELLED_BY_CAREGIVER => 'The caregiver',
            default => 'KindredCare',
        };

        $reason = $this->booking->cancellation_reason
            ? " Reason given: {$this->booking->cancellation_reason}"
            : '';

        return (new MailMessage)
            ->subject('A booking was cancelled')
            ->greeting("{$who} cancelled a booking.")
            ->line('Originally scheduled for '.$this->booking->scheduled_start->format('l F j, g:i A').'.'.$reason)
            ->action('View booking', url("/bookings/{$this->booking->id}"));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'booking_cancelled',
            'booking_id' => $this->booking->id,
            'cancelled_by' => $this->cancelledBy,
        ];
    }
}
