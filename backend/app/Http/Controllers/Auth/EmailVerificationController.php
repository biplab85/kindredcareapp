<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * SPA-friendly email verification. Reached by GET on a signed URL the
 * frontend proxies after the user clicks the link in their inbox. The
 * `signed` middleware on the route validates the URL hasn't been
 * tampered with; this handler just confirms the hash matches the user's
 * email and flips `email_verified_at`.
 */
class EmailVerificationController extends Controller
{
    public function verify(Request $request, string $id, string $hash): JsonResponse
    {
        $user = User::query()->find($id);

        if ($user === null) {
            throw new HttpException(404, 'User not found.');
        }

        // Hash check guards against an attacker who somehow got a signed
        // URL for one user and tried to use it on another.
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            throw new HttpException(403, 'Invalid verification hash.');
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email already verified.',
                'already_verified' => true,
            ]);
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return response()->json([
            'message' => 'Email verified.',
            'already_verified' => false,
        ]);
    }
}
