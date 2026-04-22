"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import api from "@/lib/api";

const resetSchema = z
  .object({
    email: z.email("Please enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Must contain at least one letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

type ResetForm = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: emailParam },
  });

  const [linkInvalid, setLinkInvalid] = useState(false);

  const onSubmit = async (data: ResetForm) => {
    setIsSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { ...data, token });
      toast.success("Password has been reset!");
      router.push("/login");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        // Laravel's password broker returns 400 when the token no longer matches —
        // either it expired (60 min) or a newer "Send reset link" request replaced it.
        setLinkInvalid(true);
      } else {
        toast.error("Couldn't reset your password right now. Try again in a moment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkInvalid) {
    return (
      <AuthLayout
        title="This link is no longer valid"
        subtitle="Reset links expire after an hour — or get replaced by a newer one."
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          If you requested the link more than once, only the most recent email works. Request a
          fresh link to continue.
        </p>
        <div className="mt-6 space-y-2">
          <Link href="/forgot-password">
            <Button className="h-12 w-full text-base">Request a new link</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="h-12 w-full text-base">
              <ArrowLeft className="mr-2 size-4" />
              Back to login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="h-12"
            placeholder="you@example.com"
            {...field("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            className="h-12"
            placeholder="Min 8 characters"
            {...field("password")}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password_confirmation">Confirm New Password</Label>
          <Input
            id="password_confirmation"
            type="password"
            className="h-12"
            placeholder="Confirm your password"
            {...field("password_confirmation")}
            aria-invalid={!!errors.password_confirmation}
          />
          {errors.password_confirmation && (
            <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>
          )}
        </div>

        <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Reset Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
