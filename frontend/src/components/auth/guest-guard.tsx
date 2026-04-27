"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

/**
 * Mirror of AuthGuard for routes that should only be visible to *guests*
 * — login, signup, forgot/reset password. If the user is already
 * authenticated, bounce them straight to the dashboard so they don't see
 * a login form they can't actually use.
 *
 * Token alone is enough for the redirect — we don't need the full user
 * object to know they're signed in. If the token is stale, the dashboard
 * page's own AuthGuard will handle the eventual logout.
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, isLoading, fetchUser } = useAuthStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    // Hydrate the user object once so we don't churn between guest and
    // authed states on hard reload — but the redirect itself doesn't
    // wait for it.
    if (!user && !isLoading && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchUser();
    }

    router.replace("/dashboard");
  }, [token, user, isLoading, fetchUser, router]);

  // Brief loader while we decide whether to redirect — avoids the flash
  // of login form for users who are already authed.
  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
