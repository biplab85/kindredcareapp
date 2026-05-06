<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\VerificationRecord;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admins when a caregiver uploads identity documents (or
 * re-uploads after a rejection). Lands in the admin's notification
 * bell + email so the verifications queue isn't dependent on anyone
 * happening to refresh /admin/verifications.
 */
class VerificationDocumentsSubmitted extends Notification
{
    use Queueable;

    public function __construct(
        public readonly User $caregiver,
        public readonly VerificationRecord $record,
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
        $isResubmit = ($this->record->retry_count ?? 0) > 1;
        $verb = $isResubmit ? 're-uploaded' : 'uploaded';

        return (new MailMessage)
            ->subject("New verification submission — {$this->caregiver->name}")
            ->greeting('A caregiver is waiting on review.')
            ->line("{$this->caregiver->name} just {$verb} their identity documents.")
            ->line("Email: {$this->caregiver->email}")
            ->action('Review in admin', url("/admin/verifications/{$this->record->id}"));
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'verification_submitted',
            'verification_id' => $this->record->id,
            'caregiver_user_id' => $this->caregiver->id,
            'caregiver_name' => $this->caregiver->name,
            'caregiver_email' => $this->caregiver->email,
            'check_type' => $this->record->check_type,
            'retry_count' => $this->record->retry_count ?? 1,
            'submitted_at' => now()->toIso8601String(),
        ];
    }
}
