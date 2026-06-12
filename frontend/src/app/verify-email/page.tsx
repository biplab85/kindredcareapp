"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  type LucideIcon,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* Status badge rendered above the heading — matches the premium auth form. */
function StatusBadge({
  icon: Icon,
  tone,
  spin = false,
}: {
  icon: LucideIcon;
  tone: "primary" | "success" | "accent";
  spin?: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    primary: "bg-primary/12 text-primary ring-primary/20",
    success: "bg-success/12 text-success ring-success/20",
    accent: "bg-accent/12 text-accent ring-accent/20",
  };
  return (
    <div
      className={cn("flex size-12 items-center justify-center rounded-xl ring-1", tones[tone])}
    >
      <Icon className={cn("size-6", spin && "animate-spin")} strokeWidth={2} />
    </div>
  );
}

/* Premium link-button — lift + colored glow + shine sweep + icon nudge. */
function PremiumLink({
  href,
  label,
  icon: Icon,
  iconSide = "start",
  variant = "primary",
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  iconSide?: "start" | "end";
  variant?: "primary" | "outline";
}) {
  const iconCls = cn(
    "size-4 transition-transform duration-200 ease-out",
    iconSide === "start" ? "mr-2 group-hover/pl:-translate-x-0.5" : "ml-1 group-hover/pl:translate-x-0.5",
  );
  const iconEl = Icon ? <Icon className={iconCls} /> : null;

  return (
    <Link href={href} className="block">
      <Button
        variant={variant === "outline" ? "outline" : "default"}
        className={cn(
          "group/pl relative h-12 w-full overflow-hidden text-base font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5",
          variant === "outline"
            ? "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            : "shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/35",
        )}
      >
        {variant === "primary" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/pl:translate-x-full"
          />
        )}
        {iconSide === "start" && iconEl}
        {label}
        {iconSide === "end" && iconEl}
      </Button>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Email verification page — dual-purpose:
 *
 * 1. If the URL carries `id`, `hash`, `expires`, `signature` query
 *    params (the user clicked the link from their inbox), forward
 *    a GET to the backend's signed verify route. Render success or
 *    expired/invalid state.
 *
 * 2. With no params, render the post-signup "check your inbox"
 *    prompt with a resend button. This is the page users land on
 *    right after registering.
 *
 * Suspense wrapper satisfies Next 15's `useSearchParams` rule.
 * ───────────────────────────────────────────────────────────── */

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<FallbackShell />}>
      <VerifyEmailRouter />
    </Suspense>
  );
}

function VerifyEmailRouter() {
  const params = useSearchParams();
  const id = params.get("id");
  const hash = params.get("hash");
  const expires = params.get("expires");
  const signature = params.get("signature");

  const hasVerificationParams = Boolean(id && hash && expires && signature);

  if (hasVerificationParams) {
    return (
      <VerificationProcessor id={id!} hash={hash!} expires={expires!} signature={signature!} />
    );
  }

  return <PostSignupPrompt />;
}

/* ─────────────────────────────────────────────────────────────
 * Variant 1 — coming from the email link
 * ───────────────────────────────────────────────────────────── */

type VerifyState =
  | { kind: "loading" }
  | { kind: "success"; alreadyVerified: boolean }
  | { kind: "expired-or-invalid" }
  | { kind: "error" };

function VerificationProcessor({
  id,
  hash,
  expires,
  signature,
}: {
  id: string;
  hash: string;
  expires: string;
  signature: string;
}) {
  const [state, setState] = useState<VerifyState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await api.get<{ already_verified: boolean }>(
          `/api/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`,
          { params: { expires, signature } },
        );
        if (!alive) return;
        setState({
          kind: "success",
          alreadyVerified: Boolean(res.data?.already_verified),
        });
      } catch (err) {
        if (!alive) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403 || status === 404 || status === 422) {
          setState({ kind: "expired-or-invalid" });
        } else {
          setState({ kind: "error" });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, hash, expires, signature]);

  if (state.kind === "loading") {
    return (
      <AuthLayout
        icon={<StatusBadge icon={Loader2} tone="primary" spin />}
        title="Verifying your email"
        subtitle="Confirming your email address — this usually takes under a second."
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (state.kind === "success") {
    return (
      <AuthLayout
        icon={<StatusBadge icon={CheckCircle2} tone="success" />}
        title={state.alreadyVerified ? "Already verified" : "You're all set"}
        subtitle={
          state.alreadyVerified
            ? "This email has been confirmed before — you can log in now."
            : "Your email is confirmed. Welcome to KindredCare."
        }
      >
        <div className="flex flex-col gap-2.5">
          <PremiumLink href="/dashboard" label="Go to dashboard" icon={ArrowRight} iconSide="end" />
          <PremiumLink href="/login" label="Back to login" icon={ArrowLeft} variant="outline" />
        </div>
      </AuthLayout>
    );
  }

  if (state.kind === "expired-or-invalid") {
    return (
      <AuthLayout
        icon={<StatusBadge icon={AlertCircle} tone="accent" />}
        title="Link expired or invalid"
        subtitle="Verification links expire after 60 minutes for security. Log in and request a fresh one from your account settings."
      >
        <PremiumLink href="/login" label="Back to login" icon={ArrowLeft} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={<StatusBadge icon={AlertCircle} tone="accent" />}
      title="Something went sideways"
      subtitle="We couldn't reach the server to verify your email. Try the link again, or refresh in a moment."
    >
      <PremiumLink href="/login" label="Back to login" icon={ArrowLeft} />
    </AuthLayout>
  );
}

function FallbackShell() {
  return (
    <AuthLayout
      icon={<StatusBadge icon={Loader2} tone="primary" spin />}
      title="Verifying your email"
      subtitle="One moment while we confirm your link."
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
      </div>
    </AuthLayout>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Variant 2 — post-signup prompt to check inbox + resend control
 * ───────────────────────────────────────────────────────────── */

function PostSignupPrompt() {
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
      icon={<StatusBadge icon={Mail} tone="primary" />}
      title="Verify your email"
      subtitle="We sent a verification link to your email address."
    >
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        Click the link in the email to verify your account. If you don&apos;t see it, check your spam
        folder.
      </p>

      <div className="space-y-3">
        <Button
          onClick={resend}
          disabled={isResending}
          className="group/resend relative h-12 w-full overflow-hidden text-base font-semibold shadow-sm shadow-primary/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/35"
        >
          {/* shine sweep on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover/resend:translate-x-full"
          />
          {isResending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4 transition-transform duration-200 ease-out group-hover/resend:-translate-y-0.5 group-hover/resend:translate-x-0.5" />
          )}
          Resend verification email
        </Button>
      </div>
    </AuthLayout>
  );
}
