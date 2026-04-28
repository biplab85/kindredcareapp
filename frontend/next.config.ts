import type { NextConfig } from "next";
import path from "node:path";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Phase 15.A — security headers shipped at the Next.js layer.
 *
 * CSP keeps script execution to first-party + vetted third-party domains
 * (Stripe for payments, Veriff for ID verification, Mapbox for maps).
 * `connect-src` whitelists the API origin so cross-origin XHR doesn't
 * bypass policy.
 *
 * `unsafe-inline` is allowed on `style-src` because Tailwind injects
 * inline styles for hashed class definitions; a stricter nonce-based
 * approach is a follow-up once we can swap to CSS-in-JS.
 */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://*.veriff.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      // The API origin (localhost:8000 in dev, the deployed origin in prod)
      // serves user-uploaded photos via /storage/* — has to be allowed
      // explicitly because 'self' only covers the SPA's own origin.
      `img-src 'self' data: blob: https: ${apiUrl}`,
      `connect-src 'self' ${apiUrl} https://api.stripe.com https://*.veriff.com https://*.mapbox.com wss://*.veriff.com`,
      "frame-src https://js.stripe.com https://*.veriff.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // `upgrade-insecure-requests` would rewrite http://localhost:8000
      // to https in dev and break local image loads. Only emit in prod
      // where everything is genuinely HTTPS.
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      // We collect GPS via the browser geolocation API on caregiver visits.
      "geolocation=(self)",
      "camera=()",
      "microphone=()",
      "usb=()",
      "payment=(self)",
      "midi=()",
      "magnetometer=()",
      "gyroscope=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Repo root has a package-lock.json (husky + lint-staged) that confuses
  // Turbopack's workspace inference, breaking `next dev`. Pin the root to
  // this app's folder explicitly.
  turbopack: {
    root: path.resolve(__dirname),
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
