"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function EmailVerifiedPage() {
  return (
    <AuthLayout title="Email verified!" subtitle="Your email address has been confirmed.">
      <div className="flex flex-col items-center py-6">
        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-10 text-success" />
        </div>

        <p className="mb-2 text-center text-sm text-muted-foreground">
          Thank you for verifying your email. You&apos;re all set to use KindredCare.
        </p>
      </div>

      <Link href="/dashboard">
        <Button className="h-12 w-full text-base">
          Continue to Dashboard
          <ArrowRight className="ml-1 size-4" />
        </Button>
      </Link>
    </AuthLayout>
  );
}
