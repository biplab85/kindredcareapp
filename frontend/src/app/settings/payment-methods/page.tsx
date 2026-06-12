"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  Lock,
  type LucideIcon,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  brandLabel,
  createSetupIntent,
  detachPaymentMethod,
  formatExpiry,
  hasStripePublishableKey,
  listPaymentMethods,
  type PaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/payments";
import { cn } from "@/lib/utils";

/**
 * Memo the Stripe.js promise once per page-load. Calling loadStripe more
 * than once is safe but wasteful — the SDK warns about repeated calls.
 */
let stripeJsPromise: Promise<Stripe | null> | null = null;
function getStripeJs(): Promise<Stripe | null> {
  if (!stripeJsPromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripeJsPromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripeJsPromise;
}

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function PaymentMethodsPage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Payment methods">
        <PaymentMethodsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

function PaymentMethodsView() {
  const [state, setState] = useState<LoadState>("loading");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [backendConfigured, setBackendConfigured] = useState(false);
  const [adding, setAdding] = useState(false);

  const frontendConfigured = hasStripePublishableKey();
  const setupPending = !frontendConfigured || !backendConfigured;

  const reload = useCallback(async () => {
    try {
      const res = await listPaymentMethods();
      setMethods(res.data);
      setBackendConfigured(res.meta.stripe_configured);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listPaymentMethods();
        if (!alive) return;
        setMethods(res.data);
        setBackendConfigured(res.meta.stripe_configured);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href="/settings"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to settings
      </Link>

      <Header />

      <div className="mt-6 space-y-6">
        {state === "loading" && <LoadingCard />}
        {state === "error" && <ErrorCard onRetry={reload} />}
        {state === "ready" && setupPending && <StripeSetupPendingCard />}
        {state === "ready" && !setupPending && (
          <ConfiguredView
            methods={methods}
            onChanged={reload}
            adding={adding}
            setAdding={setAdding}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header — kicker + italic display + subtitle
 * ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header>
      <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        Payment methods
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        One card on file is all we need. You won&rsquo;t be charged until a visit ends — until then,
        we hold an authorization that releases automatically if anything changes. Your card details
        stay with Stripe; we only ever see the last four digits.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared card shell — mirrors the Payouts page so the "warming up"
 * state feels consistent across settings.
 * ───────────────────────────────────────────────────────────── */

const TONES = {
  primary: {
    tile: "bg-primary/10 text-primary ring-primary/20",
    band: "from-primary/[0.06]",
    pill: "bg-primary/10 text-primary ring-primary/20",
  },
} as const;

function StateCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  status,
  children,
}: {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  status: string;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-br to-transparent px-6 py-4 sm:px-8",
          t.band,
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", t.tile)}>
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
            t.pill,
          )}
        >
          {status}
        </span>
      </div>
      <div className="px-6 py-6 sm:px-8">{children}</div>
    </section>
  );
}

function FeatureRow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className="pt-0.5 text-sm leading-relaxed text-foreground/90">{children}</span>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * State A — Stripe setup pending
 *   Frontend missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY OR backend
 *   reporting stripe_configured=false. We explain clearly, promise
 *   nothing will break, and preview what the page will become.
 * ───────────────────────────────────────────────────────────── */

function StripeSetupPendingCard() {
  return (
    <StateCard
      tone="primary"
      icon={CreditCard}
      title="Card payments are warming up"
      subtitle="Stripe isn't live in this environment yet"
      status="Coming soon"
    >
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Bookings still work during this window — the platform runs a stub payment channel, so nothing
        is blocked. The moment Stripe is live, this page becomes your card wallet and we&rsquo;ll
        charge the card you save here.
      </p>

      <p className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        What goes here, once it&rsquo;s ready
      </p>
      <ul className="mt-3 space-y-2.5">
        <FeatureRow icon={Wallet}>
          Attach a card, Apple Pay, or Google Pay — whatever your phone already knows.
        </FeatureRow>
        <FeatureRow icon={ShieldCheck}>
          The rate you see at booking is the rate you pay. No drip-pricing, no surprise add-ons.
        </FeatureRow>
        <FeatureRow icon={Lock}>
          We authorize on the caregiver&rsquo;s accept and capture only when the visit ends — short
          visits pro-rate automatically.
        </FeatureRow>
      </ul>
    </StateCard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * State B — Stripe configured: add CTA + saved cards list
 * ───────────────────────────────────────────────────────────── */

function ConfiguredView({
  methods,
  onChanged,
  adding,
  setAdding,
}: {
  methods: PaymentMethod[];
  onChanged: () => Promise<void>;
  adding: boolean;
  setAdding: (v: boolean) => void;
}) {
  // Default first — visually pulled forward with the primary ring.
  const sorted = [...methods].sort((a, b) =>
    a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1,
  );

  return (
    <>
      {adding ? (
        <AddCardForm
          onCancel={() => setAdding(false)}
          onAdded={onChanged}
          hasExistingDefault={methods.some((m) => m.is_default)}
        />
      ) : (
        <AddCardCta emptyState={methods.length === 0} onOpen={() => setAdding(true)} />
      )}

      {sorted.length > 0 && (
        <section aria-label="Saved cards">
          <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            On file
            <span className="text-foreground/30">— § 15</span>
          </div>

          <ul className="space-y-4">
            {sorted.map((pm) => (
              <li key={pm.id}>
                <SavedCardRow pm={pm} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Add-a-card CTA
 * ───────────────────────────────────────────────────────────── */

function AddCardCta({ emptyState, onOpen }: { emptyState: boolean; onOpen: () => void }) {
  if (emptyState) {
    return (
      <section
        aria-label="No cards yet"
        className="rounded-3xl border-2 border-dashed border-border/60 bg-card/50 p-8 text-center sm:p-12"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <CreditCard className="size-6" strokeWidth={1.75} />
        </span>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">
          <span className="italic text-primary">No cards</span> saved yet.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Add one to make booking feel instant — we&rsquo;ll remember it for every visit you line
          up.
        </p>
        <Button onClick={onOpen} size="lg" className="mt-6">
          <Plus className="size-4" strokeWidth={2.25} />
          Add a card
        </Button>
      </section>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Need to update your card?</span> Add a new one
        — it becomes the default automatically when it&rsquo;s the only one.
      </p>
      <Button onClick={onOpen}>
        <Plus className="size-4" strokeWidth={2.25} />
        Add a card
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Add-card form
 *
 * Two-step async dance:
 *   1. POST /api/payments/setup-intent → backend returns client_secret
 *   2. <Elements> + <PaymentElement> + stripe.confirmSetup() →
 *      Stripe tokenizes the card client-side (PCI scope stays with them)
 *
 * On success we (a) call setDefaultPaymentMethod for the freshly minted
 * payment_method when the family had no default before, and (b) reload
 * the list via onAdded(). Stripe's redirect-based 3DS flow is in scope:
 * `redirect: 'if_required'` means the page only navigates away when the
 * issuer demands a challenge.
 * ───────────────────────────────────────────────────────────── */

function AddCardForm({
  onCancel,
  onAdded,
  hasExistingDefault,
}: {
  onCancel: () => void;
  onAdded: () => Promise<void>;
  hasExistingDefault: boolean;
}) {
  const [phase, setPhase] = useState<"fetching" | "ready" | "error">("fetching");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const primeSetupIntent = useCallback(async () => {
    setPhase("fetching");
    setErrorMsg(null);
    try {
      const { client_secret } = await createSetupIntent();
      setClientSecret(client_secret);
      setPhase("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not start card setup right now.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { client_secret } = await createSetupIntent();
        if (!alive) return;
        setClientSecret(client_secret);
        setPhase("ready");
      } catch (err) {
        if (!alive) return;
        setErrorMsg(err instanceof Error ? err.message : "Could not start card setup right now.");
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section
      aria-label="Add a card"
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card p-6 sm:p-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-primary/40" />
          Add a card — § 16
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <h2 className="mt-5 text-2xl font-semibold tracking-tight">
        A quick <span className="italic text-primary">card detail</span>.
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Handled by Stripe. We never see your full number — only the last four digits show up on
        file.
      </p>

      <div className="my-7 border-t-2 border-dashed border-primary/25" />

      {phase === "fetching" && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Starting a secure session with Stripe…
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm text-accent">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {errorMsg ?? "Card setup is unavailable right now."}
          </p>
          <Button onClick={primeSetupIntent} variant="outline" size="sm" className="mt-4">
            Try again
          </Button>
        </div>
      )}

      {phase === "ready" && clientSecret && (
        <ElementsCardSetup
          clientSecret={clientSecret}
          hasExistingDefault={hasExistingDefault}
          onCancel={onCancel}
          onAdded={onAdded}
        />
      )}
    </section>
  );
}

function ElementsCardSetup({
  clientSecret,
  hasExistingDefault,
  onCancel,
  onAdded,
}: {
  clientSecret: string;
  hasExistingDefault: boolean;
  onCancel: () => void;
  onAdded: () => Promise<void>;
}) {
  const stripePromise = useMemo(() => getStripeJs(), []);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "oklch(0.56 0.13 240)",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            borderRadius: "12px",
          },
        },
      }}
    >
      <CardSetupBody
        hasExistingDefault={hasExistingDefault}
        onCancel={onCancel}
        onAdded={onAdded}
      />
    </Elements>
  );
}

function CardSetupBody({
  hasExistingDefault,
  onCancel,
  onAdded,
}: {
  hasExistingDefault: boolean;
  onCancel: () => void;
  onAdded: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    // confirmSetup tokenizes the card and confirms the SetupIntent. On 3DS
    // challenges Stripe redirects to the return_url; we ask for redirect
    // only-if-required so the happy path stays on-page.
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/payment-methods`,
      },
      redirect: "if_required",
    });

    if (error) {
      setSubmitError(error.message ?? "We couldn't save that card. Try again.");
      setSubmitting(false);
      return;
    }

    if (!setupIntent || setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
      setSubmitError("The setup didn't complete. Try again.");
      setSubmitting(false);
      return;
    }

    // First card on file → make it the default automatically. The user
    // can change defaults later, but a no-default state breaks booking.
    const newPmId = setupIntent.payment_method as string;
    if (!hasExistingDefault) {
      try {
        await setDefaultPaymentMethod(newPmId);
      } catch {
        // Non-fatal — the card is saved; default just didn't flip.
      }
    }

    try {
      await onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: "tabs" }} />

      {submitError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {submitError}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Your card is charged by KindredCare — 7.5% platform fee, the rest goes to the caregiver
          after the visit ends.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onCancel} variant="outline" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!stripe || !elements || submitting}>
            {submitting ? "Saving…" : "Save card"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Saved card row
 *   Ticket-stub aesthetic: perforated left edge, big mono brand and
 *   last4, dashed rule, inline expiry + actions. Default card gets a
 *   primary ring and a subtle tinted wash.
 * ───────────────────────────────────────────────────────────── */

function SavedCardRow({ pm, onChanged }: { pm: PaymentMethod; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<"default" | "remove" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function makeDefault() {
    setBusy("default");
    setLocalError(null);
    try {
      await setDefaultPaymentMethod(pm.id);
      await onChanged();
    } catch {
      setLocalError("Couldn’t set as default. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setLocalError(null);
    try {
      await detachPaymentMethod(pm.id);
      await onChanged();
    } catch {
      setLocalError("Couldn’t remove this card. Try again.");
      setBusy(null);
    }
    // On success the component unmounts, no need to reset busy.
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card transition-colors",
        pm.is_default
          ? "border-primary/40 bg-primary/[0.02] ring-1 ring-primary/15"
          : "border-border/60 hover:border-border",
      )}
    >
      {/* Perforated left edge — a thin vertical column of dots */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="grid gap-5 p-5 pl-9 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-6 sm:pl-11">
        {/* Identity */}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              {brandLabel(pm.brand)}
            </p>
            {pm.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-primary uppercase">
                <Star className="size-2.5" strokeWidth={2.25} />
                Default
              </span>
            )}
          </div>

          <p className="mt-2 font-mono text-2xl tabular-nums text-foreground">
            <span aria-hidden>•••• </span>
            <span className="sr-only">Card ending in </span>
            {pm.last4 ?? "••••"}
          </p>

          <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            Expires {formatExpiry(pm.exp_month, pm.exp_year)}
          </p>
        </div>

        {/* Actions — dashed-rule separated on mobile, inline on desktop */}
        <div className="flex flex-col items-stretch gap-2 border-t border-dashed border-border/60 pt-4 sm:flex-row sm:items-center sm:border-0 sm:pt-0">
          {!pm.is_default && (
            <Button
              onClick={makeDefault}
              disabled={busy !== null}
              variant="outline"
              size="sm"
              className="font-mono text-[11px] tracking-[0.14em] uppercase"
            >
              {busy === "default" ? (
                <span className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              ) : (
                <Star className="size-3.5" strokeWidth={2} />
              )}
              Make default
            </Button>
          )}

          {confirmRemove ? (
            <div className="flex items-center gap-1">
              <Button
                onClick={remove}
                disabled={busy !== null}
                variant="destructive"
                size="sm"
                className="font-mono text-[11px] tracking-[0.14em] uppercase"
              >
                {busy === "remove" ? (
                  <span className="size-3 animate-spin rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground" />
                ) : (
                  <Trash2 className="size-3.5" strokeWidth={2} />
                )}
                Really?
              </Button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cancel removal"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <Button
              onClick={() => setConfirmRemove(true)}
              disabled={busy !== null}
              variant="outline"
              size="sm"
              className="font-mono text-[11px] tracking-[0.14em] text-destructive uppercase hover:text-destructive"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
              Remove
            </Button>
          )}
        </div>
      </div>

      {localError && (
        <div className="border-t border-accent/20 bg-accent/5 px-5 py-2 text-xs text-accent sm:px-6">
          <p className="flex items-center gap-2">
            <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} />
            {localError}
          </p>
        </div>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Loading skeleton — mirrors the ticket-stub row dimensions so the
 * transition from loading to ready doesn't jolt layout.
 * ───────────────────────────────────────────────────────────── */

function LoadingCard() {
  return (
    <div
      aria-busy="true"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-border px-6 py-4 sm:px-8">
        <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
      <div className="space-y-3 px-6 py-6 sm:px-8">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
        <div className="mt-2 h-14 w-full animate-pulse rounded-xl bg-muted/50" />
        <div className="h-14 w-full animate-pulse rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Error card — compact, with a retry CTA
 * ───────────────────────────────────────────────────────────── */

function ErrorCard({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <section
      aria-label="Error loading payment methods"
      className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Couldn&rsquo;t load your cards.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A hiccup on our end, most likely. Try again in a moment.
          </p>
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}
