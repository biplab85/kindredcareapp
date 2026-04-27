"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

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
      <Shell>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
          <Loader2 className="size-6 animate-spin" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          <span className="font-normal italic text-primary">Just a sec,</span> verifying.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Confirming your email address. This usually takes under a second.
        </p>
      </Shell>
    );
  }

  if (state.kind === "success") {
    return (
      <Shell>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          <span className="font-normal italic text-success">
            {state.alreadyVerified ? "Already verified." : "You're in."}
          </span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {state.alreadyVerified
            ? "This email has been confirmed before. You can log in now."
            : "Your email is confirmed. Welcome to KindredCare."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/dashboard">
            <Button className="w-full" size="default">
              Go to dashboard
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full" size="default">
              Back to login
            </Button>
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "expired-or-invalid") {
    return (
      <Shell>
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent/15 text-accent">
          <AlertCircle className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          <span className="font-normal italic text-accent">Link expired</span>{" "}
          <span className="text-foreground">or invalid.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Verification links expire after 60 minutes for security. Log in and ask for a fresh one
          from your account settings.
        </p>
        <div className="mt-6">
          <Link href="/login">
            <Button className="w-full" size="default">
              Back to login
            </Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-accent/15 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        <span className="font-normal italic text-muted-foreground">Something went sideways.</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We couldn&apos;t reach the server to verify your email. Try the link again, or refresh in a
        moment.
      </p>
      <div className="mt-6">
        <Link href="/login">
          <Button variant="outline" className="w-full" size="default">
            Back to login
          </Button>
        </Link>
      </div>
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shell — minimal centered card matching login/signup aesthetic
 * ───────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-16">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" />
          Verification
          <span className="text-foreground/30">— § 03</span>
        </div>
        <article className="rounded-3xl border border-border/60 bg-card p-8 text-center sm:p-10">
          {children}
        </article>
      </div>
    </main>
  );
}

function FallbackShell() {
  return (
    <Shell>
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
        <Loader2 className="size-6 animate-spin" strokeWidth={1.75} />
      </div>
    </Shell>
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
