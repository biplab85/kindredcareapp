<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\VerifyPhoneRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PhoneVerificationController extends Controller
{
    public function send(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->phone) {
            return response()->json(['message' => 'No phone number on file.'], 422);
        }

        if ($user->phone_verified_at) {
            return response()->json(['message' => 'Phone already verified.']);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put("phone_otp:{$user->id}", hash('sha256', $code), now()->addMinutes(5));

        // In production: send via Twilio. In dev: log it.
        Log::info("Phone OTP for user {$user->id}: {$code}");

        return response()->json([
            'message' => 'Verification code sent.',
        ]);
    }

    public function store(VerifyPhoneRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $cachedHash = Cache::get("phone_otp:{$user->id}");

        if (! $cachedHash || ! hash_equals($cachedHash, hash('sha256', $request->code))) {
            return response()->json([
                'message' => 'Invalid or expired verification code.',
            ], 422);
        }

        $user->update(['phone_verified_at' => now()]);

        Cache::forget("phone_otp:{$user->id}");

        return response()->json([
            'message' => 'Phone verified successfully.',
        ]);
    }
}
