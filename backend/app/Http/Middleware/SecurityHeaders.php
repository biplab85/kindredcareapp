<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sets the security-header set on every Laravel response. Frontend Next.js
 * sets its own headers; this middleware covers the API surface so cookies,
 * JSON responses, and direct API consumption (admin tooling, mobile clients
 * later) all carry the same defenses.
 *
 * Header rationale:
 *   - HSTS              : forces HTTPS for one year, including subdomains
 *   - X-Frame-Options   : DENY blocks clickjacking; we never embed our API
 *   - X-Content-Type    : prevents MIME sniffing on JSON responses
 *   - Referrer-Policy   : same-origin so we don't leak booking IDs to ads
 *   - Permissions       : disable browser APIs the API surface never needs
 *   - Cross-Origin-RP   : same-origin so other sites can't read our JSON
 *   - Server, X-Powered : strip vendor identifiers from response leakage
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // HSTS — only meaningful over HTTPS, but harmless on HTTP since
        // browsers ignore it. preload + includeSubDomains opts us into
        // the browser-side HSTS preload list.
        $response->headers->set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload',
        );

        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Disable browser APIs the API surface never uses. Frontend pages
        // override this with a more permissive policy via Next.js headers().
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), usb=(), payment=(), midi=(), magnetometer=(), gyroscope=()',
        );

        // Cross-origin protections — JSON is same-origin only.
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        // Don't leak Laravel/PHP server identity to attackers.
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}
