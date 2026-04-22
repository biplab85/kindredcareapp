<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;

class ForgotPasswordController extends Controller
{
    public function store(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::sendResetLink(
            $request->only('email')
        );

        return match ($status) {
            Password::RESET_LINK_SENT => response()->json([
                'message' => 'Password reset link sent.',
            ]),
            Password::RESET_THROTTLED => response()->json([
                'message' => 'Please wait before requesting another reset link.',
            ], 429),
            default => response()->json([
                'message' => 'Unable to send reset link.',
            ], 400),
        };
    }
}
