<?php

namespace App\Notifications;

use App\Models\Certification;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the caregiver when admin rejects an uploaded certification.
 * The rejection_reason is the load-bearing field — the caregiver needs
 * to know what to fix before they re-upload a fresh document.
 */
class CertificationRejected extends Notification
{
    use Queueable;

    public function __construct(public readonly Certification $certification) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $c = $this->certification;
        $reason = $c->rejection_reason ?? 'No reason on file.';

        return (new MailMessage)
            ->subject("Action needed on your {$c->name} certification")
            ->greeting('Your certification needs another look.')
            ->line("{$c->name}: rejected.")
            ->line("Reason: {$reason}")
            ->line('You can re-upload a fresh document from your profile editor — the row stays on your profile in the meantime.')
            ->action('Re-upload', config('app.frontend_url').'/profile/edit');
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'certification_rejected',
            'certification_id' => $this->certification->id,
            'name' => $this->certification->name,
            'rejection_reason' => $this->certification->rejection_reason,
        ];
    }
}
