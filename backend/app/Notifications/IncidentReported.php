<?php

namespace App\Notifications;

use App\Models\IncidentReport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admin queue on incident submission. Critical-severity incidents
 * warrant pager-style urgency; the mail-level notification is the floor.
 */
class IncidentReported extends Notification
{
    use Queueable;

    public function __construct(public readonly IncidentReport $incident) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $i = $this->incident;
        $severity = strtoupper($i->severity);
        $type = str_replace('_', ' ', $i->type);

        return (new MailMessage)
            ->subject("[{$severity}] Incident reported: {$type}")
            ->greeting("New {$severity} incident")
            ->line("Type: {$type}")
            ->line('Booking #'.str_pad((string) $i->booking_id, 5, '0', STR_PAD_LEFT))
            ->line("Reporter: {$i->reporter->name}")
            ->line("Description: {$i->description}")
            ->action('Open incident queue', url('/admin/safety'));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'incident_reported',
            'incident_id' => $this->incident->id,
            'booking_id' => $this->incident->booking_id,
            'type' => $this->incident->type,
            'severity' => $this->incident->severity,
        ];
    }
}
