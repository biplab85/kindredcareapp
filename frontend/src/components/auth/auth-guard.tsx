"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { postLoginRoute, useAuthStore } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: ("family" | "caregiver" | "admin")[];
}

/**
 * Paths that bypass the onboarding-incomplete redirect — the user has
 * to be allowed to *reach* their onboarding page (and adjacent flows
 * like email verification) without being bounced.
 */
const ONBOARDING_ALLOWED_PATHS = ["/family-onboarding", "/onboarding", "/verify-email"];

export function AuthGuard({ children, roles }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, isLoading, fetchUser } = useAuthStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!user && !isLoading && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchUser();
    }
  }, [token, user, isLoading, fetchUser, router]);

  if (!token || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    router.replace("/dashboard");
    return null;
  }

  // Defensive onboarding redirect: an incomplete family/caregiver user
  // landing on /dashboard (or any other guarded surface) gets bounced to
  // their onboarding flow. Skipped when they're already on the
  // onboarding page itself, otherwise we'd redirect-loop.
  const intendedRoute = postLoginRoute(user);
  if (intendedRoute !== "/dashboard" && !ONBOARDING_ALLOWED_PATHS.includes(pathname ?? "")) {
    router.replace(intendedRoute);
    return null;
  }

  return <>{children}</>;
}
