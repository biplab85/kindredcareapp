<?php

namespace App\Notifications;

use App\Models\ArrivalReport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the family (and admin in-app) when the caregiver responds to
 * an arrival report. The family hears "they saw it, here's their ETA"
 * — admin gets the audit-trail row.
 */
class CaregiverArrivalAcknowledged extends Notification
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
        $report = $this->report;
        $booking = $report->booking;
        $caregiver = $booking->caregiver->name;

        $msg = (new MailMessage)
            ->subject("{$caregiver} saw your arrival report")
            ->greeting("{$caregiver} responded");

        if ($report->eta_at) {
            $etaTime = $report->eta_at
                ->copy()
                ->setTimezone(config('app.display_timezone'))
                ->format('g:i A');
            $msg->line("They're on their way and estimate arrival at {$etaTime}.");
        } else {
            $msg->line('They saw the report and are heading to check in now.');
        }

        return $msg
            ->line('If the situation changes, admin is still tracking this — feel free to reach out via the chat.')
            ->action('Open booking', rtrim((string) config('app.frontend_url'), '/').'/bookings/'.$booking->id);
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'caregiver_arrival_acknowledged',
            'arrival_report_id' => $this->report->id,
            'booking_id' => $this->report->booking_id,
            'eta_at' => $this->report->eta_at?->toIso8601String(),
        ];
    }
}
