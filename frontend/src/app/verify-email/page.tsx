"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
import api from "@/lib/api";

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false);

  const resend = async () => {
    setIsResending(true);
    try {
      await api.post("/api/auth/email/resend");
      toast.success("Verification email sent!");
    } catch {
      toast.error("Unable to send. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="We sent a verification link to your email address."
    >
      <div className="flex flex-col items-center py-6">
        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-10 text-primary" />
        </div>

        <p className="mb-2 text-center text-sm text-muted-foreground">
          Click the link in the email to verify your account. If you don&apos;t see it, check your
          spam folder.
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={resend}
          variant="outline"
          className="h-12 w-full text-base"
          disabled={isResending}
        >
          {isResending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Resend Verification Email
        </Button>

        <Link href="/dashboard" className="block">
          <Button variant="ghost" className="h-12 w-full text-base text-muted-foreground">
            Continue to dashboard
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
