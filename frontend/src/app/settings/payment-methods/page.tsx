"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
    <div className="relative">
      {/* Paper wash — same vocabulary as /bookings/[id] */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Link
          href="/settings"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to settings
        </Link>

        <Header />

        <div className="mt-10 space-y-6">
          {state === "loading" && <LoadingList />}
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header — kicker + italic display + subtitle
 * ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header>
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">How we&rsquo;ll charge you.</span>
      </h1>

      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        One card on file is all we need. You won&rsquo;t be charged until a visit ends — until then,
        we hold an authorization that releases automatically if anything changes.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * State A — Stripe setup pending
 *   Frontend missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY OR backend
 *   reporting stripe_configured=false. We explain clearly, promise
 *   nothing will break, and show what the page will become.
 * ───────────────────────────────────────────────────────────── */

function StripeSetupPendingCard() {
  return (
    <section
      aria-label="Stripe setup pending"
      className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.05] via-card to-card p-6 sm:p-10"
    >
      {/* Paper-corner stamp */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 size-24 rotate-12 rounded-full bg-primary/[0.04] blur-2xl"
      />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <span className="relative grid size-16 -rotate-[6deg] place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <CreditCard className="size-7" strokeWidth={1.75} />
            <span className="absolute -right-2 -bottom-2 grid size-6 place-items-center rounded-full bg-background text-primary ring-1 ring-primary/25">
              <Sparkles className="size-3" strokeWidth={2} />
            </span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-foreground/30" />
            Still warming up
          </div>

          <h2 className="mt-3 text-2xl leading-[1.1] font-semibold tracking-tight">
            Card payments <span className="italic text-primary">land soon.</span>
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We&rsquo;re setting up Stripe for real card capture. Bookings still work during this
            window — the platform is running a stub payment channel, so nothing is blocked. The
            moment Stripe is live, this page becomes your card wallet.
          </p>

          <div className="my-7 border-t-2 border-dashed border-primary/20" />

          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            What goes here, once it&rsquo;s ready
          </p>

          <ul className="mt-4 space-y-3 text-sm">
            <Bullet>
              Attach a card, Apple Pay, or Google Pay — whatever your phone already knows.
            </Bullet>
            <Bullet>
              The rate you see at booking is the rate you pay. No drip-pricing, no surprise add-ons.
            </Bullet>
            <Bullet>
              We authorize on the caregiver&rsquo;s accept, capture only when the visit ends. Short
              visits pro-rate automatically.
            </Bullet>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-[0.3rem] grid size-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        <ArrowRight className="size-2.5" strokeWidth={2.25} />
      </span>
      <span className="leading-relaxed text-foreground/85">{children}</span>
    </li>
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
        <AddCardForm onCancel={() => setAdding(false)} onAdded={onChanged} />
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
 * TODO: Install the Stripe web SDKs before this form can actually
 * tokenize a card:
 *
 *   npm install @stripe/stripe-js @stripe/react-stripe-js
 *
 * Once installed, swap the placeholder body below for:
 *   - <Elements stripe={loadStripe(PUBLISHABLE_KEY)} options={{ clientSecret }}>
 *   - <CardElement /> (or <PaymentElement />)
 *   - stripe.confirmCardSetup(clientSecret, { payment_method: { card } })
 *   - On success → setDefaultPaymentMethod(paymentMethod.id) if no default yet
 *   - Then onAdded() to reload
 *
 * The SetupIntent call below already works; only the Elements half is
 * blocked on that install.
 * ───────────────────────────────────────────────────────────── */

function AddCardForm({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"idle" | "fetching" | "ready" | "error">("fetching");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const primeSetupIntent = useCallback(async () => {
    setPhase("fetching");
    setErrorMsg(null);
    try {
      // This round-trip works today; only the Elements tokenization below
      // is waiting on the @stripe/* install.
      await createSetupIntent();
      setPhase("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not start card setup right now.");
      setPhase("error");
    }
  }, []);

  // Prime the SetupIntent on mount. Same pattern as the reference file's
  // initial getBooking load — async fetch, guard against unmount, setState.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await createSetupIntent();
        if (!alive) return;
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

      {phase === "ready" && (
        <div className="space-y-6">
          {/* Placeholder until @stripe/stripe-js + @stripe/react-stripe-js are
              installed. The box is drawn to match the aesthetic so nothing
              looks broken — the card form will slot in here unchanged. */}
          <div
            aria-hidden
            className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-6 text-center"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Card form slot
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/75">
              Stripe Elements renders here once{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                @stripe/stripe-js
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                @stripe/react-stripe-js
              </code>{" "}
              are installed. The backend SetupIntent round-trip already succeeded — the tokenization
              half is the only piece waiting.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Your card is charged by KindredCare — 7.5% platform fee, the rest goes to the
              caregiver after the visit ends.
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={onCancel} variant="outline">
                Cancel
              </Button>
              <Button disabled title="Add @stripe/stripe-js to enable">
                Save card
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Silence the unused-import lint for onAdded while Elements is deferred.
          The real confirmCardSetup flow calls onAdded() to reload the list. */}
      <span className="hidden" aria-hidden data-onadded={typeof onAdded} />
    </section>
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

function LoadingList() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-border/60 bg-card p-5 pl-9 sm:p-6 sm:pl-11"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.15)_1px,transparent_1.5px)] bg-[length:100%_12px]"
          />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted" />
        </div>
      ))}
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
      className="rounded-3xl border border-accent/30 bg-accent/[0.03] p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Couldn&rsquo;t load your cards.</h2>
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
