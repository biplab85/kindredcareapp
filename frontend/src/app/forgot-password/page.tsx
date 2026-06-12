"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Loader2, Mail, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import { GuestGuard } from "@/components/auth/guest-guard";
import api from "@/lib/api";

const forgotSchema = z.object({
  email: z.email("Please enter a valid email"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  return (
    <GuestGuard>
      <ForgotPasswordView />
    </GuestGuard>
  );
}

function ForgotPasswordView() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setIsSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", data);
      setSent(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        // Laravel throttles resend to once per minute — explain so users
        // don't re-click and accidentally invalidate the first email's link.
        toast.error(
          "You just requested a link. Wait a minute, then check your email — the most recent message is the one that works.",
        );
      } else {
        toast.error("Unable to send reset link. Please check your email.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a password reset link to your email.">
        <div className="flex flex-col items-center py-4">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-8 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Click the link in the email to reset your password. If you don&apos;t see it, check your
            spam folder.
          </p>
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-center text-xs leading-relaxed text-muted-foreground">
            If you request another link, only the newest email will work — older links stop being
            valid as soon as a newer one is sent.
          </p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="mt-4 h-12 w-full text-base">
            <ArrowLeft className="mr-2 size-4" />
            Back to login
          </Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <IconInput
            id="email"
            type="email"
            icon={Mail}
            className="h-12"
            placeholder="you@example.com"
            {...field("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="group/submit relative h-12 w-full overflow-hidden text-base font-semibold shadow-sm shadow-primary/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/35"
        >
          {/* shine sweep on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/submit:translate-x-full"
          />
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4 transition-transform duration-200 ease-out group-hover/submit:-translate-y-0.5 group-hover/submit:translate-x-0.5" />
          )}
          Send Reset Link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
