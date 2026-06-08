<?php

namespace App\Notifications;

use App\Models\Certification;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the caregiver when admin approves one of their uploaded
 * certifications. Family-facing card flips to leaf-green "Verified by
 * KindredCare" on the same notification firing — so the email reads as
 * "good news, this is live now."
 */
class CertificationVerified extends Notification
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
        $detail = trim(implode(' · ', array_filter([$c->issuer, $c->year])));

        return (new MailMessage)
            ->subject("Verified: {$c->name}")
            ->greeting('Good news — your certification is verified.')
            ->line("{$c->name}".($detail !== '' ? " ({$detail})" : ''))
            ->line('Families will now see this on your profile with the verified badge.')
            ->action('View your profile', config('app.frontend_url').'/profile');
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'certification_verified',
            'certification_id' => $this->certification->id,
            'name' => $this->certification->name,
        ];
    }
}
