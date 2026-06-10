"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import axios from "axios";
import { useAuthStore } from "@/lib/auth";

/**
 * Token handoff landing page for the caregiver visit magic link.
 *
 * Backend's /visit/{booking}/auth issues a short-lived Sanctum token,
 * then redirects here with the token + a `redirect` query param. We
 * pull the user record using that token, persist it to the auth
 * store (which writes to localStorage and updates Zustand state), and
 * bounce to the destination. From that point on the caregiver is
 * indistinguishable from a normal logged-in session.
 *
 * We deliberately bypass the configured axios instance (which would
 * apply an interceptor reading whatever stale token is in localStorage)
 * and use plain axios with an explicit Authorization header — that
 * keeps this page safe even if the caregiver was previously signed in
 * as a different account on the same browser.
 */
function MagicAuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("token");
    const redirect = searchParams.get("redirect") || "/dashboard";

    if (!token) {
      router.replace("/login?error=missing_token");
      return;
    }

    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    (async () => {
      try {
        const res = await axios.get(`${baseURL}/api/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        setAuth(res.data.user, token);
        router.replace(redirect);
      } catch {
        router.replace("/login?error=invalid_token");
      }
    })();
  }, [searchParams, router, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          Signing you in
        </p>
      </div>
    </div>
  );
}

export default function MagicAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <MagicAuthInner />
    </Suspense>
  );
}
