import { AuthGuard } from "@/components/auth/auth-guard";
import { OnboardingForm } from "./_components/onboarding-form";

export default function OnboardingPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <OnboardingForm />
    </AuthGuard>
  );
}
