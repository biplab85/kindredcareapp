"use client";

import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth";

/**
 * Sticky verification reminder. Renders when the current user's email
 * is unverified. Used on the dashboard and any other surface where the
 * user might bump into a hard email-verify gate (booking form, gig
 * create form). Pointing them at /verify-email is the canonical
 * resend-the-link path.
 */
export function EmailVerifyBanner({ context }: { context?: "booking" | "gig" }) {
  const user = useAuthStore((s) => s.user);

  if (!user || user.email_verified_at) return null;

  const message =
    context === "booking"
      ? "Verify your email before you can book a visit."
      : context === "gig"
        ? "Verify your email before you can publish gigs."
        : "Verify your email to unlock bookings and gig publishing.";

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-4 ring-1 ring-accent/20">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-accent"
          strokeWidth={2.25}
          aria-hidden
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-accent">{message}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            We sent a verification link to <span className="font-medium">{user.email}</span>. Open
            it and click the button — takes 30 seconds.
          </p>
          <Link href="/verify-email" className="mt-3 inline-block">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-accent/40 text-accent hover:bg-accent/5"
            >
              <Mail className="size-3.5" strokeWidth={2.25} />
              Resend verification email
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
