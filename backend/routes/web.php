<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Email verification was moved to the API surface so the frontend SPA
// can render the success/error UI. See routes/api.php — `verification.verify`.
