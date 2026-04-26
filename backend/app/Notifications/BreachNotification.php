<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Phase 15.D — PIPEDA mandatory breach notification template.
 *
 * Fired by safety staff via tinker / artisan command after the breach
 * incident-response runbook (BREACH_RUNBOOK.md) has been initiated.
 * Each affected user receives one notification + a parallel email
 * report goes to the Office of the Privacy Commissioner of Canada
 * within 72 hours of breach confirmation.
 *
 * The template is deliberately conservative — concrete details are
 * passed at dispatch time so the language can be customized to the
 * incident without forking the class.
 */
class BreachNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $incidentId,
        public readonly string $whatHappened,
        public readonly string $dataAffected,
        public readonly string $stepsTaken,
        public readonly string $stepsForUser,
        public readonly ?string $contactEmail = 'privacy@kindredcare.ca',
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        // Mail-only — the in-app channel uses the regular notification
        // surface and admins want a hard email record for audit purposes.
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Important: KindredCare data security notice')
            ->greeting('A note about your KindredCare account.')
            ->line('We are writing to inform you of a data security incident that may have affected your information on KindredCare.')
            ->line('**What happened:**')
            ->line($this->whatHappened)
            ->line('**Data potentially affected:**')
            ->line($this->dataAffected)
            ->line('**What we have done:**')
            ->line($this->stepsTaken)
            ->line('**What you should do:**')
            ->line($this->stepsForUser)
            ->line('We have notified the Office of the Privacy Commissioner of Canada as required under PIPEDA.')
            ->line("If you have questions, please reach out to {$this->contactEmail}.")
            ->line('Reference: incident '.$this->incidentId)
            ->salutation('— The KindredCare team');
    }
}
