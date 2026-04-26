<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class LoginController extends Controller
{
    public function store(LoginRequest $request): JsonResponse
    {
        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        /** @var User $user */
        $user = Auth::user();

        // Phase 15.B — suspended/deleted accounts are blocked from logging
        // in. Without this guard, an admin suspension only stops new
        // bookings; the user could still authenticate and use existing
        // sessions. Returning 403 (not 401) so clients can distinguish
        // "wrong password" from "account locked".
        if ($user->status === 'suspended' || $user->status === 'deleted') {
            Auth::logout();

            return response()->json([
                'message' => 'This account is not active. Contact support if you believe this is an error.',
            ], 403);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function destroy(): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();
        $user->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }
}
