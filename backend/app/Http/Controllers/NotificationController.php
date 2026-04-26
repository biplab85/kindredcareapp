<?php

namespace App\Http\Controllers;

use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * In-app notification surface backed by Laravel's database channel.
 * Each notification class (`BookingOffered`, `MessageReceived`, etc.)
 * lands a row in `notifications` with a `data` blob; this controller
 * surfaces the user's stack and lets them mark items read.
 *
 * Mark-read is idempotent and capped to the user's own rows so a
 * compromised token can't traverse the whole table.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $rows = $user->notifications()
            ->limit(50)
            ->get();

        $unread = $user->unreadNotifications()->count();

        return response()->json([
            'data' => $rows->map(fn (DatabaseNotification $n) => $this->present($n))->values(),
            'meta' => [
                'unread' => $unread,
                'total' => $rows->count(),
            ],
        ]);
    }

    public function markRead(Request $request, string $notificationId): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $notification = $user->notifications()->where('id', $notificationId)->first();

        if ($notification === null) {
            return response()->json(['message' => 'Notification not found.'], 404);
        }

        if ($notification->read_at === null) {
            $notification->markAsRead();
        }

        return response()->json([
            'data' => $this->present($notification->fresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->unreadNotifications->markAsRead();

        return response()->json([
            'meta' => ['unread' => 0],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(DatabaseNotification $n): array
    {
        // The `type` column is the fully-qualified class name; we expose
        // a snake_case shortform so `App\Notifications\BookingOffered`
        // becomes `booking_offered` for the frontend's switch statements.
        $basename = class_basename($n->type);
        $shortType = strtolower(
            (string) preg_replace('/(?<!^)([A-Z])/', '_$1', $basename),
        );

        return [
            'id' => $n->id,
            'type' => $shortType,
            'data' => $n->data,
            'read_at' => $n->read_at instanceof CarbonInterface ? $n->read_at->toIso8601String() : null,
            'created_at' => $n->created_at instanceof CarbonInterface ? $n->created_at->toIso8601String() : null,
        ];
    }
}
