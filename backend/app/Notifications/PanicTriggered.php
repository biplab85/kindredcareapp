<?php

namespace App\Notifications;

use App\Models\PanicAlert;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to every admin (safety team) when a caregiver triggers the panic
 * button. risks.md §10.2 SLA: response within 5 minutes.
 */
class PanicTriggered extends Notification
{
    use Queueable;

    public function __construct(public readonly PanicAlert $alert) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $a = $this->alert;
        $caregiver = $a->caregiver->name ?? 'Caregiver';

        $msg = (new MailMessage)
            ->subject("🚨 PANIC: {$caregiver} needs help NOW")
            ->greeting("Panic alert from {$caregiver}")
            ->line('Booking #'.str_pad((string) $a->booking_id, 5, '0', STR_PAD_LEFT))
            ->line('Triggered at '.$a->triggered_at->format('Y-m-d H:i:s'));

        if ($a->gps_lat !== null && $a->gps_lng !== null) {
            $msg->line("GPS: {$a->gps_lat}, {$a->gps_lng}");
        } else {
            $msg->line('GPS: unavailable (permission denied or signal lost)');
        }

        if ($a->silent) {
            $msg->line('This was a **silent** alert — the other party does not see it.');
        }

        return $msg->action('Open safety queue', url('/admin/safety'));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'panic_triggered',
            'panic_alert_id' => $this->alert->id,
            'booking_id' => $this->alert->booking_id,
            'caregiver_user_id' => $this->alert->caregiver_user_id,
            'silent' => $this->alert->silent,
            'gps_lat' => $this->alert->gps_lat,
            'gps_lng' => $this->alert->gps_lng,
            'triggered_at' => $this->alert->triggered_at->toIso8601String(),
        ];
    }
}
