"use client";

import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { FamilyOnboardingForm } from "@/app/family-onboarding/_components/family-onboarding-form";
import { OnboardingForm } from "@/app/onboarding/_components/onboarding-form";
import { useAuthStore } from "@/lib/auth";

/**
 * /profile mounts the same onboarding form the user filled at signup time
 * inside the dashboard shell (sidebar + topbar). The URL stays at /profile;
 * the form code lives in the existing onboarding routes so we don't fork
 * the validation/save logic between two surfaces.
 *
 * The form itself already detects `onboarding_complete === true` and swaps
 * the heading copy to "Edit your profile" — see PR #74.
 */
export default function ProfilePage() {
  return (
    <AuthGuard roles={["caregiver", "family"]}>
      <ProfileView />
    </AuthGuard>
  );
}

function ProfileView() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <DashboardShell pageTitle="Profile">
      {role === "caregiver" ? (
        <OnboardingForm />
      ) : role === "family" ? (
        <FamilyOnboardingForm />
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}
    </DashboardShell>
  );
}
