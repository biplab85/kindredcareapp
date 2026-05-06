<?php

namespace App\Notifications;

use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the *recipient* of a booking message — i.e. the participant
 * who didn't send it. The data blob carries enough context for the
 * notification center to render a clickable summary without a second
 * roundtrip to the booking detail.
 */
class MessageReceived extends Notification
{
    use Queueable;

    public function __construct(public readonly Message $message) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $sender = $this->message->sender;
        $bookingId = $this->message->booking_id;

        return (new MailMessage)
            ->subject("New message on your booking from {$sender->name}")
            ->greeting('You have a new message on KindredCare.')
            ->line("From: {$sender->name}")
            ->line($this->preview())
            ->action('Open conversation', config('app.frontend_url')."/bookings/{$bookingId}")
            ->line('Replies stay in the booking — please keep contact on platform.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'message_id' => $this->message->id,
            'booking_id' => $this->message->booking_id,
            'sender_name' => $this->message->sender->name,
            'sender_role' => $this->message->sender->role,
            'preview' => $this->preview(),
            'redaction_count' => is_array($this->message->redactions)
                ? count($this->message->redactions)
                : 0,
        ];
    }

    private function preview(): string
    {
        // 120 chars is enough for the notification dropdown. Body is
        // already redacted, so the preview is safe to surface.
        return mb_strimwidth($this->message->body, 0, 120, '…');
    }
}
