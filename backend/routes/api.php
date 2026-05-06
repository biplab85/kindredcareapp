<?php

use App\Http\Controllers\Admin\AdminAccountController;
use App\Http\Controllers\Admin\AlertsController;
use App\Http\Controllers\Admin\AnalyticsController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\DemandDensityController;
use App\Http\Controllers\Admin\IncidentController;
use App\Http\Controllers\Admin\PanicAlertController;
use App\Http\Controllers\Admin\RevenueController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PhoneVerificationController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\CaregiverAvailabilityController;
use App\Http\Controllers\CaregiverConnectController;
use App\Http\Controllers\CaregiverController;
use App\Http\Controllers\ConsentController;
use App\Http\Controllers\EarningsController;
use App\Http\Controllers\EarningsStatementController;
use App\Http\Controllers\EmergencyController;
use App\Http\Controllers\FamilyProfileController;
use App\Http\Controllers\GigController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\MyAvailabilityOverridesController;
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
    Route::post('/register', [RegisterController::class, 'store'])->middleware('throttle:auth-loose');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:auth-strict');
    Route::post('/forgot-password', [ForgotPasswordController::class, 'store'])->middleware('throttle:auth-strict');
    Route::post('/reset-password', [ResetPasswordController::class, 'store'])->middleware('throttle:auth-strict');
});

// Email verification — signed URL, no auth needed (signature is the proof).
// Frontend `/verify-email` page proxies a GET back to this route after
// extracting the params from the email link.
Route::get('/auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware(['signed', 'throttle:auth-loose'])
    ->name('verification.verify');

// ─── AUTH (authenticated) ───
// Default per-user throttle of 60/min applies to every authenticated route.
// Endpoints that need tighter limits (auth resends, OTPs) override below.
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {

    Route::post('/auth/logout', [LoginController::class, 'destroy']);

    // ─── EMAIL VERIFICATION ───
    Route::post('/auth/email/resend', function (Request $request) {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }
        $request->user()->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification link sent.']);
    })->middleware('throttle:auth-loose');

    // ─── PHONE VERIFICATION ───
    Route::post('/auth/phone/send', [PhoneVerificationController::class, 'send'])->middleware('throttle:auth-strict');
    Route::post('/auth/phone/verify', [PhoneVerificationController::class, 'store'])->middleware('throttle:auth-strict');

    // ─── PROFILE ───
    Route::get('/me', [ProfileController::class, 'show']);
    Route::patch('/me', [ProfileController::class, 'update']);
    Route::delete('/me', [ProfileController::class, 'destroy']);
    Route::get('/me/data-export', [ProfileController::class, 'export']);

    // ─── PIPEDA CONSENT ───
    Route::get('/me/consents', [ConsentController::class, 'index']);
    Route::post('/me/consents', [ConsentController::class, 'store'])
        ->middleware('throttle:auth-loose');
    Route::post('/me/logout-all', [ProfileController::class, 'logoutAll']);
    Route::patch('/me/caregiver-profile', [ProfileController::class, 'updateCaregiverProfile']);
    Route::post('/me/photo', [ProfileController::class, 'uploadPhoto']);
    // Caregiver-side per-date "off" overrides on top of the weekly template.
    Route::get('/me/availability-overrides', [MyAvailabilityOverridesController::class, 'index']);
    Route::post('/me/availability-overrides', [MyAvailabilityOverridesController::class, 'store']);
    Route::delete(
        '/me/availability-overrides/{override}',
        [MyAvailabilityOverridesController::class, 'destroy'],
    );

    // ─── FAMILY PROFILE ───
    Route::patch('/me/family-profile', [FamilyProfileController::class, 'update']);
    Route::get('/me/care-recipients', [FamilyProfileController::class, 'recipients']);
    Route::post('/me/care-recipients', [FamilyProfileController::class, 'addRecipient']);
    Route::patch('/me/care-recipients/{recipient}', [FamilyProfileController::class, 'updateRecipient']);
    Route::delete('/me/care-recipients/{recipient}', [FamilyProfileController::class, 'deleteRecipient']);

    // ─── CAREGIVERS (browsing) ───
    Route::get('/caregivers', [CaregiverController::class, 'index']);
    Route::get(
        '/caregivers/{user}/booked-windows',
        [CaregiverAvailabilityController::class, 'bookedWindows'],
    );
    Route::get('/caregivers/{caregiver}', [CaregiverController::class, 'show']);

    // ─── VERIFICATION (caregiver) ───
    Route::prefix('verification')->group(function () {
        Route::get('/status', [VerificationController::class, 'status']);
        Route::post('/upload-id', [VerificationController::class, 'uploadId']);
        Route::post('/upload-selfie', [VerificationController::class, 'uploadSelfie']);
        Route::post('/id-document', [VerificationController::class, 'startIdVerification']);
        Route::post('/cpic', [VerificationController::class, 'startCpicCheck']);
    });

    // ─── GIGS (caregiver-published service listings) ───
    // Static paths must come before apiResource so {gig} doesn't swallow them.
    Route::get('/me/gigs', [GigController::class, 'myGigs']);
    Route::apiResource('gigs', GigController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy']);

    // ─── BOOKINGS ───
    Route::apiResource('bookings', BookingController::class)->only(['index', 'store', 'show']);
    Route::patch('/bookings/{booking}/accept', [BookingController::class, 'accept']);
    Route::patch('/bookings/{booking}/decline', [BookingController::class, 'decline']);
    Route::patch('/bookings/{booking}/cancel', [BookingController::class, 'cancel']);
    Route::patch('/bookings/{booking}/check-in', [BookingController::class, 'checkIn']);
    Route::patch('/bookings/{booking}/check-out', [BookingController::class, 'checkOut']);
    Route::patch('/bookings/{booking}/tasks', [BookingController::class, 'updateTasks']);
    Route::post('/bookings/{booking}/dispute', [BookingController::class, 'openDispute']);

    // ─── PAYMENTS ───
    Route::post('/payments/setup-intent', [PaymentController::class, 'setupIntent']);
    Route::get('/me/payment-methods', [PaymentController::class, 'listPaymentMethods']);
    Route::delete('/me/payment-methods/{paymentMethodId}', [PaymentController::class, 'destroyPaymentMethod']);
    Route::patch('/me/payment-methods/default', [PaymentController::class, 'setDefaultPaymentMethod']);
    Route::get('/me/earnings', [EarningsController::class, 'show']);
    Route::get('/me/earnings/statement/{year}', [EarningsStatementController::class, 'show'])
        ->whereNumber('year');
    Route::get('/me/stripe-connect/status', [CaregiverConnectController::class, 'status']);
    Route::post('/me/stripe-connect/onboarding', [CaregiverConnectController::class, 'onboarding']);
    Route::post('/me/stripe-connect/refresh', [CaregiverConnectController::class, 'refresh']);

    // ─── MESSAGES ───
    Route::get('/bookings/{booking}/messages', [MessageController::class, 'index']);
    Route::post('/bookings/{booking}/messages', [MessageController::class, 'store']);

    // ─── REVIEWS ───
    Route::post('/bookings/{booking}/review', [ReviewController::class, 'store']);
    Route::get('/me/reviews/pending', [ReviewController::class, 'pending']);
    Route::get('/users/{user}/reviews', [ReviewController::class, 'forUser']);
    Route::post('/reviews/{review}/flag', [ReviewController::class, 'flag']);

    // ─── EMERGENCY ───
    Route::post('/emergency/panic', [EmergencyController::class, 'panic']);
    Route::post('/bookings/{booking}/safety-ack', [EmergencyController::class, 'safetyAck']);
    Route::post('/bookings/{booking}/incidents', [EmergencyController::class, 'submitIncident']);

    // ─── NOTIFICATIONS ───
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
});

// ─── VERIFICATION WEBHOOKS (no auth — signature verified in controller) ───
Route::prefix('webhooks')->middleware('throttle:webhooks')->group(function () {
    Route::post('/veriff', [VeriffWebhookController::class, 'handle']);
    Route::post('/certn', [CertnWebhookController::class, 'handle']);
    Route::post('/stripe', [StripeWebhookController::class, 'handle']);
});

// ─── ADMIN VERIFICATION DOCUMENT VIEWER (signed URLs) ───
// Lives outside the auth:sanctum group so an admin can open the doc in a
// new tab or paste it into <img src=...> without needing the bearer
// token. Time-limited signature (15 min) provides authorization;
// admin/verifications/{id} is the only place those signed URLs are
// generated, and that route is admin-gated.
Route::get(
    '/admin/verifications/{verification}/document/{document}',
    [App\Http\Controllers\Admin\VerificationController::class, 'document'],
)->middleware(['signed', 'throttle:api'])->name('admin.verification.document');

// ─── ADMIN ───
Route::prefix('admin')->middleware(['auth:sanctum', 'admin', 'throttle:api'])->group(function () {
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{user}', [UserController::class, 'show']);
    Route::patch('/users/{user}/suspend', [UserController::class, 'suspend']);
    Route::patch('/users/{user}/reactivate', [UserController::class, 'reactivate']);
    Route::delete('/users/{user}', [UserController::class, 'destroy']);

    Route::get('/verifications', [App\Http\Controllers\Admin\VerificationController::class, 'pending']);
    Route::get('/verifications/{verification}', [App\Http\Controllers\Admin\VerificationController::class, 'show']);
    Route::post('/verifications/{verification}/approve', [App\Http\Controllers\Admin\VerificationController::class, 'approve']);
    Route::post('/verifications/{verification}/reject', [App\Http\Controllers\Admin\VerificationController::class, 'reject']);

    Route::get('/bookings', [App\Http\Controllers\Admin\BookingController::class, 'index']);
    Route::get('/bookings/{booking}', [App\Http\Controllers\Admin\BookingController::class, 'show']);
    Route::post('/bookings/{booking}/refund', [App\Http\Controllers\Admin\BookingController::class, 'refund']);

    Route::get('/incidents', [IncidentController::class, 'index']);
    Route::get('/incidents/{incident}', [IncidentController::class, 'show']);
    Route::patch('/incidents/{incident}', [IncidentController::class, 'update']);

    Route::get('/panic-alerts', [PanicAlertController::class, 'index']);
    Route::get('/panic-alerts/{panicAlert}', [PanicAlertController::class, 'show']);
    Route::patch('/panic-alerts/{panicAlert}/acknowledge', [PanicAlertController::class, 'acknowledge']);
    Route::patch('/panic-alerts/{panicAlert}/resolve', [PanicAlertController::class, 'resolve']);

    Route::get('/analytics', [AnalyticsController::class, 'index']);
    Route::get('/revenue', [RevenueController::class, 'index']);

    Route::get('/audit-log', [AuditLogController::class, 'index']);

    Route::get('/alerts', [AlertsController::class, 'index']);

    Route::patch('/messages/{message}/hide', [App\Http\Controllers\Admin\MessageController::class, 'hide']);
    Route::patch('/messages/{message}/unhide', [App\Http\Controllers\Admin\MessageController::class, 'unhide']);

    // Phase 14 cleanup — demand density (Mapbox heatmap follow-up) and
    // admin-account CRUD with TOTP deferred to Phase 15 hardening.
    Route::get('/demand-density', [DemandDensityController::class, 'index']);

    Route::get('/admins', [AdminAccountController::class, 'index']);
    Route::post('/admins', [AdminAccountController::class, 'store']);
    Route::patch('/admins/{admin}', [AdminAccountController::class, 'update']);
    Route::delete('/admins/{admin}', [AdminAccountController::class, 'destroy']);
});

// ─── SERVICE CATEGORIES (public) ───
Route::get('/service-categories', [ServiceCategoryController::class, 'index']);
