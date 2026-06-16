<?php

namespace App\Notifications;

use App\Models\ArrivalReport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admin when a family files an arrival report. Medium severity
 * — admin should triage within minutes but it's not a real-time
 * page like PanicTriggered. Email subject and copy are deliberately
 * neutral so admin can decide whether to escalate or close as a false
 * report after contacting both parties.
 */
class ArrivalReportFiled extends Notification
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
        $reasonLabel = $report->reason_code === ArrivalReport::REASON_NOT_YET_ARRIVED
            ? 'Caregiver has not arrived'
            : 'Caregiver checked in but family disputes presence';

        $msg = (new MailMessage)
            ->subject('Arrival report — booking #'.str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT))
            ->greeting('Arrival report filed')
            ->line($reasonLabel.' on booking #'.str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT).'.')
            ->line('Scheduled to start at '.$booking->scheduled_start
                ->copy()
                ->setTimezone(config('app.display_timezone'))
                ->format('l F j, g:i A').'.');

        if ($report->description) {
            $msg->line('Family note: '.$report->description);
        }

        if ($report->reason_code === ArrivalReport::REASON_NOT_AT_SITE_DESPITE_CHECKIN) {
            $distance = $booking->check_in_distance_m;
            if ($distance !== null) {
                $msg->line('Check-in GPS distance from gig address: '.$distance.'m.');
            }
        }

        return $msg
            ->line('Triage: contact both parties and resolve via admin tooling.')
            ->action(
                'Open booking',
                rtrim((string) config('app.frontend_url'), '/').'/admin/bookings/'.$booking->id,
            );
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'arrival_report_filed',
            'arrival_report_id' => $this->report->id,
            'booking_id' => $this->report->booking_id,
            'reason_code' => $this->report->reason_code,
            'reporter_user_id' => $this->report->reporter_user_id,
        ];
    }
}
