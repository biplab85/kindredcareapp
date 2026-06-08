<?php

namespace App\Notifications;

use App\Models\Certification;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admins when a caregiver uploads a document for a certification
 * — either fresh (cert created with a doc) or a re-upload after rejection.
 * Same pattern as VerificationDocumentsSubmitted: admin gets the row
 * surfaced in their inbox + notification bell so the queue isn't dependent
 * on someone happening to refresh /admin/certifications.
 */
class CertificationDocumentSubmitted extends Notification
{
    use Queueable;

    public function __construct(
        public readonly Certification $certification,
        public readonly User $caregiver,
        public readonly bool $isResubmit,
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
        $verb = $this->isResubmit ? 're-uploaded' : 'uploaded';
        $detail = trim(implode(' · ', array_filter([
            $this->certification->issuer,
            $this->certification->year,
        ])));

        return (new MailMessage)
            ->subject("New cert submission — {$this->certification->name}")
            ->greeting('A caregiver is waiting on cert review.')
            ->line("{$this->caregiver->name} just {$verb} a document for:")
            ->line("{$this->certification->name}".($detail !== '' ? " ({$detail})" : ''))
            ->action(
                'Review in admin',
                config('app.frontend_url').'/admin/certifications',
            );
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'certification_submitted',
            'certification_id' => $this->certification->id,
            'caregiver_user_id' => $this->caregiver->id,
            'caregiver_name' => $this->caregiver->name,
            'cert_name' => $this->certification->name,
            'is_resubmit' => $this->isResubmit,
        ];
    }
}
