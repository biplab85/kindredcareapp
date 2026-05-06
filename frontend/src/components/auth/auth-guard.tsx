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

  // Compute the redirect target during render but issue navigation in
  // an effect. React 19 + Next 16 disallow router.replace() in render
  // bodies — it triggers "Cannot update a component while rendering a
  // different component."
  const wrongRole = user && roles && !roles.includes(user.role);
  const intendedRoute = user ? postLoginRoute(user) : null;
  const needsOnboardingRedirect =
    user &&
    intendedRoute !== "/dashboard" &&
    intendedRoute !== null &&
    !ONBOARDING_ALLOWED_PATHS.includes(pathname ?? "");

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

  useEffect(() => {
    if (wrongRole) {
      router.replace("/dashboard");
      return;
    }
    if (needsOnboardingRedirect && intendedRoute) {
      router.replace(intendedRoute);
    }
  }, [wrongRole, needsOnboardingRedirect, intendedRoute, router]);

  // Show the spinner while we're either still loading the user or
  // about to bounce somewhere — avoids one frame of children rendering
  // before the redirect lands.
  if (!token || isLoading || !user || wrongRole || needsOnboardingRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
