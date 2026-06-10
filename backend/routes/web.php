<?php

use App\Http\Controllers\VisitAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Email verification was moved to the API surface so the frontend SPA
// can render the success/error UI. See routes/api.php — `verification.verify`.

// Caregiver visit magic-link. Signed URL from the shift-reminder email
// bootstraps a Sanctum session as the booking's caregiver, then bounces
// to the SPA's booking page. Runtime window + status guards live in the
// controller; the `signed` middleware here is the tamper check.
Route::get('/visit/{booking}/auth', [VisitAuthController::class, 'authenticate'])
    ->middleware('signed')
    ->name('visit.auth');
