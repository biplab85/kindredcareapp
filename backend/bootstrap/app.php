<?php

use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        // Defense-in-depth: security headers on every Laravel response.
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'admin' => AdminMiddleware::class,
        ]);
        // API-only backend — the SPA owns the login screen, so the auth
        // middleware must never try to resolve a `login` route. Returning
        // null here lets the exception handler emit a clean 401 JSON.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API-only backend: any auth failure on /api/* must surface as JSON
        // 401 instead of falling back to the framework's default redirect to
        // a `login` route (which doesn't exist here).
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => $e->getMessage()], 401);
            }
        });
    })->create();
