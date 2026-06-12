"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Heart, Briefcase, Loader2, Mail, Phone, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import { GuestGuard } from "@/components/auth/guest-guard";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.email("Please enter a valid email"),
    phone: z.string().min(1, "Phone number is required"),
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

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  return (
    <GuestGuard>
      <SignupView />
    </GuestGuard>
  );
}

function SignupView() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [role, setRole] = useState<"family" | "caregiver">("family");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setIsSubmitting(true);
    try {
      await register({ ...data, role });
      toast.success("Account created!");
      router.push("/verify-email");
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
      };
      const msg = error.response?.data?.message || "Registration failed.";
      const fieldErrors = error.response?.data?.errors;
      if (fieldErrors) {
        Object.values(fieldErrors)
          .flat()
          .forEach((e) => toast.error(e));
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join KindredCare — it takes less than 5 minutes."
    >
      {/* Role toggle — sliding highlight */}
      <div className="relative mb-6 flex rounded-xl bg-muted p-1">
        {/* sliding pill */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-card shadow-sm ring-1 ring-black/[0.04] transition-transform duration-300 ease-out",
            role === "caregiver" && "translate-x-full",
          )}
        />
        <button
          type="button"
          onClick={() => setRole("family")}
          className={cn(
            "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200",
            role === "family" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className="size-4" />I need care
        </button>
        <button
          type="button"
          onClick={() => setRole("caregiver")}
          className={cn(
            "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200",
            role === "caregiver" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Briefcase className="size-4" />I want to care
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name</Label>
          <IconInput
            id="name"
            icon={User}
            className="h-12"
            placeholder="Your full name"
            {...field("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <IconInput
            id="phone"
            type="tel"
            icon={Phone}
            className="h-12"
            placeholder="+1 (416) 555-1234"
            {...field("phone")}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            className="h-12"
            placeholder="Min 8 characters"
            {...field("password")}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password_confirmation">Confirm Password</Label>
          <PasswordInput
            id="password_confirmation"
            className="h-12"
            placeholder="Confirm your password"
            {...field("password_confirmation")}
            aria-invalid={!!errors.password_confirmation}
          />
          {errors.password_confirmation && (
            <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>
          )}
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
            <UserPlus className="mr-2 size-4 transition-transform duration-200 ease-out group-hover/submit:-translate-y-0.5 group-hover/submit:translate-x-0.5" />
          )}
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
