<?php

namespace App\Notifications;

use App\Models\ArrivalReport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the caregiver when a family files an arrival report. Soft
 * nudge — "the family is asking where you are" — without accusing.
 * Gives them the booking link so they can check in, message the
 * family, or update an ETA.
 */
class CaregiverArrivalPing extends Notification
{
    use Queueable;

    public function __construct(public readonly ArrivalReport $report) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->report->booking;
        $time = $booking->scheduled_start
            ->copy()
            ->setTimezone(config('app.display_timezone'))
            ->format('g:i A');

        $line = $this->report->reason_code === ArrivalReport::REASON_NOT_YET_ARRIVED
            ? "The family is asking about your arrival for the {$time} visit. If you're on your way, send them a quick message — otherwise check in once you're at the door."
            : "The family says you don't seem to be at the address for the {$time} visit. If this is a mistake, message them — otherwise admin will reach out shortly.";

        return (new MailMessage)
            ->subject('Family is asking about your arrival')
            ->greeting('Quick check on the visit')
            ->line($line)
            ->action(
                'Open booking',
                rtrim((string) config('app.frontend_url'), '/').'/bookings/'.$booking->id,
            )
            ->line('If you need help, the safety team is one tap away.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'caregiver_arrival_ping',
            'arrival_report_id' => $this->report->id,
            'booking_id' => $this->report->booking_id,
            'reason_code' => $this->report->reason_code,
        ];
    }
}
