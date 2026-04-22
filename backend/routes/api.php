<?php

use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\IncidentController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PhoneVerificationController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\CaregiverController;
use App\Http\Controllers\EmergencyController;
use App\Http\Controllers\FamilyProfileController;
use App\Http\Controllers\GigController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\ServiceCategoryController;
use App\Http\Controllers\VerificationController;
use App\Http\Controllers\Webhooks\CertnWebhookController;
use App\Http\Controllers\Webhooks\StripeWebhookController;
use App\Http\Controllers\Webhooks\VeriffWebhookController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| KindredCare API Routes
|--------------------------------------------------------------------------
|
| All routes are prefixed with /api automatically.
| Auth routes use Sanctum for SPA cookie auth + API token auth.
|
*/

// Health check (public)
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'version' => '0.1.0',
    ]);
});

// ─── AUTH (public) ───
Route::prefix('auth')->group(function () {
    Route::post('/register', [RegisterController::class, 'store']);
    Route::post('/login', [LoginController::class, 'store']);
    Route::post('/forgot-password', [ForgotPasswordController::class, 'store']);
    Route::post('/reset-password', [ResetPasswordController::class, 'store']);
});

// ─── AUTH (authenticated) ───
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [LoginController::class, 'destroy']);

    // ─── EMAIL VERIFICATION ───
    Route::post('/auth/email/resend', function (Request $request) {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }
        $request->user()->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification link sent.']);
    })->middleware('throttle:6,1');

    // ─── PHONE VERIFICATION ───
    Route::post('/auth/phone/send', [PhoneVerificationController::class, 'send'])->middleware('throttle:3,1');
    Route::post('/auth/phone/verify', [PhoneVerificationController::class, 'store']);

    // ─── PROFILE ───
    Route::get('/me', [ProfileController::class, 'show']);
    Route::patch('/me', [ProfileController::class, 'update']);
    Route::delete('/me', [ProfileController::class, 'destroy']);
    Route::get('/me/data-export', [ProfileController::class, 'export']);
    Route::post('/me/logout-all', [ProfileController::class, 'logoutAll']);
    Route::patch('/me/caregiver-profile', [ProfileController::class, 'updateCaregiverProfile']);
    Route::post('/me/photo', [ProfileController::class, 'uploadPhoto']);

    // ─── FAMILY PROFILE ───
    Route::patch('/me/family-profile', [FamilyProfileController::class, 'update']);
    Route::get('/me/care-recipients', [FamilyProfileController::class, 'recipients']);
    Route::post('/me/care-recipients', [FamilyProfileController::class, 'addRecipient']);
    Route::patch('/me/care-recipients/{recipient}', [FamilyProfileController::class, 'updateRecipient']);
    Route::delete('/me/care-recipients/{recipient}', [FamilyProfileController::class, 'deleteRecipient']);

    // ─── CAREGIVERS (browsing) ───
    Route::get('/caregivers', [CaregiverController::class, 'index']);
    Route::get('/caregivers/{caregiver}', [CaregiverController::class, 'show']);

    // ─── VERIFICATION (caregiver) ───
    Route::prefix('verification')->group(function () {
        Route::get('/status', [VerificationController::class, 'status']);
        Route::post('/upload-id', [VerificationController::class, 'uploadId']);
        Route::post('/upload-selfie', [VerificationController::class, 'uploadSelfie']);
        Route::post('/id-document', [VerificationController::class, 'startIdVerification']);
        Route::post('/cpic', [VerificationController::class, 'startCpicCheck']);
    });

    // ─── GIGS ───
    // Static paths must come before apiResource so {gig} doesn't swallow them.
    Route::get('/gigs/feed', [GigController::class, 'feed']);
    Route::apiResource('gigs', GigController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::patch('/gigs/{gig}/cancel', [GigController::class, 'cancel']);
    Route::post('/gigs/{gig}/matches', [GigController::class, 'matches']);

    // ─── BOOKINGS ───
    Route::apiResource('bookings', BookingController::class)->only(['index', 'store', 'show']);
    Route::patch('/bookings/{booking}/accept', [BookingController::class, 'accept']);
    Route::patch('/bookings/{booking}/decline', [BookingController::class, 'decline']);
    Route::patch('/bookings/{booking}/cancel', [BookingController::class, 'cancel']);
    Route::patch('/bookings/{booking}/check-in', [BookingController::class, 'checkIn']);
    Route::patch('/bookings/{booking}/check-out', [BookingController::class, 'checkOut']);

    // ─── PAYMENTS ───
    Route::post('/payments/setup-intent', [PaymentController::class, 'setupIntent']);
    Route::post('/bookings/{booking}/refund', [PaymentController::class, 'refund']);
    Route::get('/payouts', [PaymentController::class, 'payouts']);

    // ─── MESSAGES ───
    Route::get('/bookings/{booking}/messages', [MessageController::class, 'index']);
    Route::post('/bookings/{booking}/messages', [MessageController::class, 'store']);

    // ─── REVIEWS ───
    Route::post('/bookings/{booking}/review', [ReviewController::class, 'store']);

    // ─── EMERGENCY ───
    Route::post('/emergency/panic', [EmergencyController::class, 'panic']);

    // ─── NOTIFICATIONS ───
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
});

// ─── VERIFICATION WEBHOOKS (no auth — signature verified in controller) ───
Route::prefix('webhooks')->group(function () {
    Route::post('/veriff', [VeriffWebhookController::class, 'handle']);
    Route::post('/certn', [CertnWebhookController::class, 'handle']);
    Route::post('/stripe', [StripeWebhookController::class, 'handle']);
});

// ─── ADMIN ───
Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::patch('/users/{user}/suspend', [UserController::class, 'suspend']);
    Route::patch('/users/{user}/reactivate', [UserController::class, 'reactivate']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    Route::get('/verifications', [App\Http\Controllers\Admin\VerificationController::class, 'pending']);
    Route::get('/verifications/{verification}', [App\Http\Controllers\Admin\VerificationController::class, 'show']);
    Route::post('/verifications/{verification}/approve', [App\Http\Controllers\Admin\VerificationController::class, 'approve']);
    Route::post('/verifications/{verification}/reject', [App\Http\Controllers\Admin\VerificationController::class, 'reject']);
    Route::get('/verifications/{verification}/document/{document}', [App\Http\Controllers\Admin\VerificationController::class, 'document'])->name('admin.verification.document');

    Route::get('/bookings', [App\Http\Controllers\Admin\BookingController::class, 'index']);
    Route::get('/bookings/{booking}', [App\Http\Controllers\Admin\BookingController::class, 'show']);
    Route::post('/bookings/{booking}/refund', [App\Http\Controllers\Admin\BookingController::class, 'refund']);

    Route::get('/incidents', [IncidentController::class, 'index']);
    Route::patch('/incidents/{incident}', [IncidentController::class, 'update']);

    Route::get('/analytics', [AnalyticsController::class, 'index']);
});

// ─── SERVICE CATEGORIES (public) ───
Route::get('/service-categories', [ServiceCategoryController::class, 'index']);
