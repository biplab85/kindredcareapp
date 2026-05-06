<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Caregiver-facing reminder fired at T-24h and T-1h before a confirmed
 * booking's scheduled_start. The SendShiftReminders command dedupes using
 * the reminder_24h_sent_at / reminder_1h_sent_at columns on the booking.
 */
class ShiftReminder extends Notification
{
    use Queueable;

    public const WINDOW_24H = '24h';

    public const WINDOW_1H = '1h';

    public function __construct(
        public readonly Booking $booking,
        public readonly string $window,
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
        $time = $b->scheduled_start->format('l F j, g:i A');
        $lead = $this->window === self::WINDOW_24H ? 'tomorrow' : 'in an hour';

        return (new MailMessage)
            ->subject("Reminder: visit {$lead}")
            ->greeting("Your next visit is {$lead}.")
            ->line("When: {$time}")
            ->line("Where: {$b->address_full}")
            ->line('You can start the visit from the booking page when you arrive.')
            ->action('View booking', config('app.frontend_url')."/bookings/{$b->id}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'shift_reminder',
            'window' => $this->window,
            'booking_id' => $this->booking->id,
            'scheduled_start' => $this->booking->scheduled_start->toIso8601String(),
        ];
    }
}
