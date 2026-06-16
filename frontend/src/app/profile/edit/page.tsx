"use client";

import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { FamilyOnboardingForm } from "@/app/family-onboarding/_components/family-onboarding-form";
import { OnboardingForm } from "@/app/onboarding/_components/onboarding-form";
import { useAuthStore } from "@/lib/auth";

/**
 * /profile/edit mounts the tabbed editor (same form used at /onboarding for
 * first-run signup). The read-only view lives at /profile — keeping the
 * two surfaces separate means each can lean fully into its purpose without
 * the editor rendering a dual mode.
 */
export default function ProfileEditPage() {
  return (
    <AuthGuard roles={["caregiver", "family"]}>
      <ProfileEditView />
    </AuthGuard>
  );
}

function ProfileEditView() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <DashboardShell pageTitle="Edit profile">
      {role === "caregiver" ? (
        <OnboardingForm embedded />
      ) : role === "family" ? (
        <FamilyOnboardingForm embedded />
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}
    </DashboardShell>
  );
}
