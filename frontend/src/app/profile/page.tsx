"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuthStore } from "@/lib/auth";

/**
 * /profile is the user-facing entry point for "edit who I am." Under the hood
 * it's the existing onboarding wizard — caregiver: /onboarding, family:
 * /family-onboarding — both of which already pre-fill from the current
 * profile when one exists. Single source of truth for the form, no duplicate
 * validation/save code to maintain.
 *
 * Routing decision lives client-side (not in middleware) so AuthGuard's
 * role check fires first and we don't bounce unauthenticated users into a
 * dead-end on the wrong wizard.
 */
export default function ProfilePage() {
  return (
    <AuthGuard roles={["caregiver", "family"]}>
      <ProfileRedirect />
    </AuthGuard>
  );
}

function ProfileRedirect() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (role === "caregiver") {
      router.replace("/onboarding?step=1");
      return;
    }
    if (role === "family") {
      router.replace("/family-onboarding?step=1");
    }
  }, [role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
