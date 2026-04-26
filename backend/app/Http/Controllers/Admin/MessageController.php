<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use App\Services\AdminAuditLogger;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin moderation surface for booking messages. Lets staff hide a message
 * (replaces it with a placeholder for the recipient — sender still sees
 * their original) or restore one that was hidden in error.
 *
 * Both transitions are append-only on the audit log so accountability
 * traces back through `message.hidden` and `message.unhidden`.
 *
 * A dedicated "flagged-messages queue" is a future enhancement once the
 * volume justifies it; for now admins reach moderation through the booking
 * detail page where the thread is colocated with the rest of the evidence.
 */
class MessageController extends Controller
{
    public const TARGET_MESSAGE = 'message';

    public function __construct(private readonly AdminAuditLogger $auditLogger) {}

    public function hide(Request $request, Message $message): JsonResponse
    {
        if ($message->isHidden()) {
            return response()->json([
                'message' => 'Message is already hidden.',
            ], 422);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:255'],
        ]);

        /** @var User $admin */
        $admin = $request->user();

        $message->update([
            'hidden_at' => now(),
            'hidden_by' => $admin->id,
            'hidden_reason' => $data['reason'],
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'message.hidden',
            targetType: self::TARGET_MESSAGE,
            targetId: $message->id,
            metadata: [
                'booking_id' => $message->booking_id,
                'sender_user_id' => $message->sender_user_id,
                'redaction_count' => is_array($message->redactions) ? count($message->redactions) : 0,
            ],
            reason: $data['reason'],
        );

        return response()->json([
            'data' => $this->present($message->fresh()),
        ]);
    }

    public function unhide(Request $request, Message $message): JsonResponse
    {
        if (! $message->isHidden()) {
            return response()->json([
                'message' => 'Message is not hidden.',
            ], 422);
        }

        /** @var User $admin */
        $admin = $request->user();

        $message->update([
            'hidden_at' => null,
            'hidden_by' => null,
            'hidden_reason' => null,
        ]);

        $this->auditLogger->record(
            admin: $admin,
            action: 'message.unhidden',
            targetType: self::TARGET_MESSAGE,
            targetId: $message->id,
            metadata: [
                'booking_id' => $message->booking_id,
                'sender_user_id' => $message->sender_user_id,
            ],
        );

        return response()->json([
            'data' => $this->present($message->fresh()),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Message $message): array
    {
        return [
            'id' => $message->id,
            'booking_id' => $message->booking_id,
            'is_hidden' => $message->isHidden(),
            'hidden_reason' => $message->hidden_reason,
            'hidden_at' => $message->hidden_at instanceof CarbonInterface
                ? $message->hidden_at->toIso8601String()
                : null,
        ];
    }
}
