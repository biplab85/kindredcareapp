"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  Languages,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  clearBookingDraft,
  createBooking,
  formatCents,
  formatHours,
  loadBookingDraft,
} from "@/lib/bookings";
import { fetchGigMatches, getGig, type CaregiverMatch, type Gig } from "@/lib/gigs";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

interface RouteParams {
  id: string;
  caregiverUserId: string;
}

export default function BookingConfirmPage({ params }: { params: Promise<RouteParams> }) {
  const { id, caregiverUserId } = use(params);
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Confirm booking">
        <BookingConfirmView gigId={Number(id)} caregiverUserId={Number(caregiverUserId)} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view — loads gig + the selected caregiver from matches.
 * If the draft queue is missing (user refreshed / deep-linked),
 * we re-run matches so cascade still has something to work with.
 * ───────────────────────────────────────────────────────────── */

interface LoadState {
  gig: Gig | null;
  match: CaregiverMatch | null;
  rankedIds: number[];
  error: "notfound" | "generic" | "not-in-shortlist" | null;
}

function BookingConfirmView({
  gigId,
  caregiverUserId,
}: {
  gigId: number;
  caregiverUserId: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({
    gig: null,
    match: null,
    rankedIds: [],
    error: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const draft = loadBookingDraft(gigId);
        const [gig, matchesRes] = await Promise.all([
          getGig(gigId),
          draft && draft.rankedCaregiverIds.length > 0
            ? Promise.resolve(null)
            : fetchGigMatches(gigId),
        ]);

        let rankedIds: number[] = draft?.rankedCaregiverIds ?? [];
        let match: CaregiverMatch | null = null;

        if (matchesRes) {
          rankedIds = matchesRes.data.map((m) => m.user_id);
          match = matchesRes.data.find((m) => m.user_id === caregiverUserId) ?? null;
        } else {
          // We have a draft queue but still need the caregiver card.
          const fresh = await fetchGigMatches(gigId);
          match = fresh.data.find((m) => m.user_id === caregiverUserId) ?? null;
        }

        if (!alive) return;

        if (!match) {
          setState({ gig, match: null, rankedIds, error: "not-in-shortlist" });
          return;
        }

        // Ensure the primary caregiver is first in the queue.
        const primaryFirst = [caregiverUserId, ...rankedIds.filter((id) => id !== caregiverUserId)];

        setState({ gig, match, rankedIds: primaryFirst, error: null });
      } catch (err) {
        if (!alive) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setState({
          gig: null,
          match: null,
          rankedIds: [],
          error: status === 403 || status === 404 ? "notfound" : "generic",
        });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [gigId, caregiverUserId]);

  const totals = useMemo(() => {
    if (!state.gig || !state.match) return null;
    const start = new Date(state.gig.scheduled_start);
    const end = new Date(state.gig.scheduled_end);
    const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    const hours = minutes / 60;
    const rate = state.match.hourly_rate;
    const subtotal = rate * hours;
    const fee = Math.round(subtotal * 0.075 * 100) / 100;
    const payout = Math.round((subtotal - fee) * 100) / 100;
    return {
      minutes,
      hours,
      rateCents: Math.round(rate * 100),
      subtotalCents: Math.round(subtotal * 100),
      feeCents: Math.round(fee * 100),
      payoutCents: Math.round(payout * 100),
    };
  }, [state.gig, state.match]);

  async function handleConfirm() {
    if (!state.gig || !state.match || state.rankedIds.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await createBooking({
        gig_id: state.gig.id,
        caregiver_user_id: state.match.user_id,
        ranked_caregiver_ids: state.rankedIds,
      });
      clearBookingDraft(state.gig.id);
      router.push(`/bookings/${booking.id}`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
          ?.response?.data?.message ?? "We couldn't send the offer. Try again in a moment.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  }

  if (state.error === "notfound") {
    return (
      <ErrorScreen
        title="We couldn't find that gig."
        sub="It may have been cancelled or moved."
        backHref="/gigs"
      />
    );
  }
  if (state.error === "not-in-shortlist") {
    return (
      <ErrorScreen
        title="That caregiver isn't on the shortlist."
        sub="Availability can shift between visits — go back and pick from the current matches."
        backHref={`/gigs/${gigId}/matches`}
      />
    );
  }
  if (state.error === "generic") {
    return (
      <ErrorScreen
        title="Something went sideways."
        sub="Refresh and try again in a moment."
        backHref={`/gigs/${gigId}/matches`}
      />
    );
  }
  if (!state.gig || !state.match || !totals) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative">
      {/* Paper wash — matches other Phase 5/6 pages */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Link
          href={`/gigs/${gigId}/matches`}
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to the shortlist
        </Link>

        <ConfirmHeader gig={state.gig} />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <CaregiverColumn match={state.match} />
          <ReceiptColumn
            gig={state.gig}
            match={state.match}
            totals={totals}
            submitting={submitting}
            submitError={submitError}
            onConfirm={handleConfirm}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function ConfirmHeader({ gig }: { gig: Gig }) {
  return (
    <header>
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />A booking slip
        <span className="text-foreground/30">— § 08</span>
      </div>

      <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-[3.25rem]">
        Ready to
        <br />
        <span className="font-normal italic text-primary">send the offer?</span>
      </h1>

      <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Review the particulars — {gig.service_category?.name.toLowerCase() ?? "the gig"} on{" "}
        {new Date(gig.scheduled_start).toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        . If the caregiver accepts, the address is revealed and both parties are notified.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Left column — caregiver identity card
 * ───────────────────────────────────────────────────────────── */

function CaregiverColumn({ match }: { match: CaregiverMatch }) {
  return (
    <section
      aria-labelledby="caregiver-heading"
      className="relative rounded-3xl border border-border/60 bg-card p-6 sm:p-8"
    >
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        The caregiver
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-5">
        <div className="relative shrink-0">
          <div className="relative size-24 overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60 sm:size-28">
            {match.photo_url ? (
              <Image
                src={match.photo_url}
                alt={match.display_name}
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-muted-foreground">
                {initials(match.display_name)}
              </div>
            )}
          </div>
          <span
            title="Basic Verified"
            className="absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-background"
          >
            <BadgeCheck className="size-5" strokeWidth={2.25} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 id="caregiver-heading" className="text-2xl font-semibold tracking-tight">
            {match.display_name}
          </h2>
          {match.trust_is_new && (
            <span className="mt-2 inline-flex rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">
              New on platform
            </span>
          )}
          {match.bio && (
            <p className="mt-3 text-sm leading-snug text-muted-foreground italic">
              &ldquo;{match.bio}&rdquo;
            </p>
          )}
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <Signal icon={MapPin} label={`${match.distance_km} km away`} />
        <Signal
          icon={Clock}
          label={`${match.years_of_experience} yr${match.years_of_experience === 1 ? "" : "s"} experience`}
        />
        {match.languages.length > 0 && (
          <Signal icon={Languages} label={match.languages.slice(0, 3).join(" · ")} />
        )}
        <Signal icon={ShieldCheck} label={`Trust ${match.trust_score}/100`} />
      </dl>

      <div className="mt-8 flex items-center gap-3 rounded-xl bg-primary/[0.06] px-4 py-3 ring-1 ring-primary/20">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-foreground/80">
          Match score{" "}
          <span className="font-mono font-semibold text-primary">{match.match_score}%</span> —
          ranked from your shortlist.
        </p>
      </div>
    </section>
  );
}

function Signal({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground/80">
      <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
      <span>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Right column — itemised receipt with perforations + CTA
 * ───────────────────────────────────────────────────────────── */

interface Totals {
  minutes: number;
  hours: number;
  rateCents: number;
  subtotalCents: number;
  feeCents: number;
  payoutCents: number;
}

function ReceiptColumn({
  gig,
  match,
  totals,
  submitting,
  submitError,
  onConfirm,
}: {
  gig: Gig;
  match: CaregiverMatch;
  totals: Totals;
  submitting: boolean;
  submitError: string | null;
  onConfirm: () => void;
}) {
  const start = new Date(gig.scheduled_start);
  const end = new Date(gig.scheduled_end);

  return (
    <section
      aria-labelledby="receipt-heading"
      className="relative rounded-3xl border border-border/60 bg-card"
    >
      {/* Decorative tick-marks along the top edge — evokes a torn receipt */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-[1px] h-3 overflow-hidden rounded-t-3xl"
        style={{
          backgroundImage:
            "radial-gradient(circle at 8px 0, transparent 3px, hsl(var(--border) / 0.6) 3.5px, transparent 4px)",
          backgroundSize: "16px 6px",
          backgroundRepeat: "repeat-x",
        }}
      />

      <div className="px-6 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-foreground/30" />
          Order of service
        </div>

        <h2 id="receipt-heading" className="mt-3 font-mono text-sm tracking-[0.14em] uppercase">
          Booking slip #{String(gig.id).padStart(4, "0")}-{String(match.user_id).padStart(4, "0")}
        </h2>

        <dl className="mt-6 space-y-3 text-sm">
          <ReceiptLine label="Service" value={gig.service_category?.name ?? "Gig"} />
          <ReceiptLine
            label="When"
            value={start.toLocaleString("en-CA", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
          <ReceiptLine
            label="Ends"
            value={end.toLocaleTimeString("en-CA", {
              hour: "numeric",
              minute: "2-digit",
            })}
          />
          <ReceiptLine label="Duration" value={formatHours(totals.minutes)} />
          <ReceiptLine
            label="Neighbourhood"
            value={gig.location_address.split(",").slice(1).join(",").trim() || "Durham Region"}
          />
        </dl>

        {/* Dotted perforation line */}
        <div className="my-8 border-t-2 border-dashed border-border/60" />

        <dl className="space-y-3 text-sm">
          <ReceiptLine label="Rate" value={`${formatCents(totals.rateCents)} / hour`} tabular />
          <ReceiptLine
            label={`Hours × ${totals.hours.toLocaleString("en-CA", { maximumFractionDigits: 1 })}`}
            value={formatCents(totals.subtotalCents)}
            tabular
          />
          <ReceiptLine
            label="Platform fee (7.5%)"
            value={`− ${formatCents(totals.feeCents)}`}
            tabular
            muted
          />
        </dl>

        <div className="my-6 border-t border-border/60" />

        <div className="flex items-baseline justify-between font-mono tabular-nums">
          <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">You pay</p>
          <p className="text-3xl font-semibold text-foreground">
            {formatCents(totals.subtotalCents)}
          </p>
        </div>
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {match.display_name.split(" ")[0]} receives {formatCents(totals.payoutCents)} after the
          platform fee.
        </p>

        {/* CTA block */}
        <div className="mt-8 space-y-3">
          {submitError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/30">
              {submitError}
            </p>
          )}
          <Button
            onClick={onConfirm}
            disabled={submitting}
            size="lg"
            className="w-full text-base font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending the offer
              </>
            ) : (
              <>
                <CalendarDays className="size-4" />
                Send offer to {match.display_name.split(" ")[0]}
              </>
            )}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            You won&rsquo;t be charged until the visit is completed. The caregiver has a response
            window &mdash; if they decline, the next ranked caregiver gets the offer automatically.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReceiptLine({
  label,
  value,
  tabular = false,
  muted = false,
}: {
  label: string;
  value: string;
  tabular?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm text-foreground",
          tabular && "font-mono tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States
 * ───────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Drafting the booking slip
      </div>
      <div className="h-14 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-14 w-1/2 animate-pulse rounded-lg bg-muted/60" />
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
        <div className="h-96 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
      </div>
    </div>
  );
}

function ErrorScreen({ title, sub, backHref }: { title: string; sub: string; backHref: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{sub}</p>
      <Link href={backHref} className="mt-6 inline-block">
        <Button variant="outline">Back</Button>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ───────────────────────────────────────────────────────────── */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}
