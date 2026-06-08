import { AuthGuard } from "@/components/auth/auth-guard";
import { FamilyOnboardingForm } from "./_components/family-onboarding-form";

export default function FamilyOnboardingPage() {
  return (
    <AuthGuard roles={["family"]}>
      <FamilyOnboardingForm />
    </AuthGuard>
  );
}
