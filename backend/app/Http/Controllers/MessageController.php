<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\FamilyProfile;
use App\Models\Message;
use App\Models\User;
use App\Notifications\MessageReceived;
use App\Services\MessageRedactor;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Booking-scoped messaging. Only the family that owns the booking and the
 * caregiver assigned to it can read or write the thread. Admins can read
 * via the admin booking detail surface (separate controller).
 *
 * Bodies are redacted via MessageRedactor before persisting — phone, email,
 * postal codes, and off-platform-contact mentions are scrubbed. The
 * redactions list is kept on the row so admins can see what was caught.
 */
class MessageController extends Controller
{
    public function __construct(private readonly MessageRedactor $redactor) {}

    public function index(Request $request, Booking $booking): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeParticipant($booking, $user);

        $messages = Message::query()
            ->where('booking_id', $booking->id)
            ->with('sender:id,name,role')
            ->orderBy('created_at')
            ->get();

        // Mark inbound messages read for this user as a side-effect of
        // opening the thread. Avoids a separate "mark as read" endpoint
        // for the MVP.
        Message::query()
            ->where('booking_id', $booking->id)
            ->where('sender_user_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'data' => $messages->map(fn (Message $m) => $this->present($m, $user))->values(),
        ]);
    }

    public function store(Request $request, Booking $booking): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->authorizeParticipant($booking, $user);

        $data = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:2000'],
        ]);

        $redaction = $this->redactor->redact(trim($data['body']));

        $message = Message::create([
            'booking_id' => $booking->id,
            'sender_user_id' => $user->id,
            'body' => $redaction['body'],
            'redactions' => $redaction['redactions'] === [] ? null : $redaction['redactions'],
        ]);

        $message->load('sender:id,name,role');

        $recipient = $this->recipientFor($booking, $user);
        if ($recipient !== null) {
            $recipient->notify(new MessageReceived($message));
        }

        return response()->json([
            'data' => $this->present($message, $user),
        ], 201);
    }

    /**
     * The participant on the booking who didn't send this message.
     */
    private function recipientFor(Booking $booking, User $sender): ?User
    {
        if ($sender->id === $booking->caregiver_user_id) {
            $familyProfile = FamilyProfile::query()->find($booking->family_profile_id);

            return $familyProfile?->user;
        }

        return User::query()->find($booking->caregiver_user_id);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Message $message, User $viewer): array
    {
        $sender = $message->sender;
        $isMine = $message->sender_user_id === $viewer->id;
        $isHidden = $message->isHidden();

        return [
            'id' => $message->id,
            'sender' => [
                'id' => $sender->id,
                'name' => $sender->name,
                'role' => $sender->role,
            ],
            'body' => $isHidden && ! $isMine
                ? '[Message removed by moderation.]'
                : $message->body,
            // Sender always sees the redactions on their own message; the
            // recipient only sees how many landed (no detail) so attempts
            // to A/B-test redaction patterns aren't easy.
            'redactions' => $isMine
                ? $message->redactions
                : null,
            'redaction_count' => is_array($message->redactions) ? count($message->redactions) : 0,
            'is_hidden' => $isHidden,
            'is_mine' => $isMine,
            'read_at' => $this->iso($message->read_at),
            'created_at' => $this->iso($message->created_at),
        ];
    }

    private function authorizeParticipant(Booking $booking, User $user): void
    {
        if ($user->role === 'admin') {
            return;
        }

        if ($booking->caregiver_user_id === $user->id) {
            return;
        }

        $profile = $user->familyProfile;
        if ($profile !== null && $profile->id === $booking->family_profile_id) {
            return;
        }

        throw new HttpException(403, 'You are not a participant on this booking.');
    }

    private function iso(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toIso8601String() : null;
    }
}
