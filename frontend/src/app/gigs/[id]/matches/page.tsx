"use client";

import { use, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Heart,
  Languages,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { saveBookingDraft } from "@/lib/bookings";
import { fetchGigMatches, getGig, type CaregiverMatch, type Gig } from "@/lib/gigs";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Matches">
        <MatchesView gigId={Number(id)} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view — loads gig + matches in parallel, then renders
 * ───────────────────────────────────────────────────────────── */

interface LoadState {
  gig: Gig | null;
  matches: CaregiverMatch[] | null;
  meta: { pool_size: number; qualifying: number; returned: number } | null;
  error: "notfound" | "generic" | null;
}

function MatchesView({ gigId }: { gigId: number }) {
  const [state, setState] = useState<LoadState>({
    gig: null,
    matches: null,
    meta: null,
    error: null,
  });
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    Promise.all([getGig(gigId), fetchGigMatches(gigId)])
      .then(([gig, matchesRes]) => {
        if (!alive) return;
        setState({
          gig,
          matches: matchesRes.data,
          meta: matchesRes.meta,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setState({
          gig: null,
          matches: null,
          meta: null,
          error: status === 403 || status === 404 ? "notfound" : "generic",
        });
      });
    return () => {
      alive = false;
    };
  }, [gigId]);

  const visibleMatches = useMemo(
    () => (state.matches ?? []).filter((m) => !skipped.has(m.id)),
    [state.matches, skipped],
  );

  if (state.error === "notfound") {
    return (
      <ErrorScreen
        title="We couldn’t find that gig."
        sub="It may have been removed, or you may not have access to it."
        backHref="/gigs"
      />
    );
  }
  if (state.error === "generic") {
    return (
      <ErrorScreen
        title="Something went sideways."
        sub="Refresh in a moment — our matcher can get temperamental after a fresh deploy."
        backHref={`/gigs/${gigId}`}
      />
    );
  }
  if (!state.gig || !state.matches || !state.meta) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative">
      {/* Paper wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-success/[0.04] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Link
          href={`/gigs/${gigId}`}
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to the gig
        </Link>

        <ShortlistHeader gig={state.gig} meta={state.meta} />

        {visibleMatches.length === 0 ? (
          <EmptyShortlist totalMatched={state.matches.length} meta={state.meta} gigId={gigId} />
        ) : (
          <ol className="mt-12 space-y-5">
            {visibleMatches.map((match, index) => (
              <li key={match.id}>
                <MatchCard
                  rank={index + 1}
                  match={match}
                  gigId={gigId}
                  rankedCaregiverIds={(state.matches ?? []).map((m) => m.user_id)}
                  onSkip={() =>
                    setSkipped((prev) => {
                      const next = new Set(prev);
                      next.add(match.id);
                      return next;
                    })
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header — editorial recap of the gig + shortlist meta
 * ───────────────────────────────────────────────────────────── */

function ShortlistHeader({
  gig,
  meta,
}: {
  gig: Gig;
  meta: { pool_size: number; qualifying: number; returned: number };
}) {
  const start = new Date(gig.scheduled_start);
  const dateLine = start.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLine = start.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header>
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />A shortlist
        <span className="text-foreground/30">— § 07</span>
      </div>

      <h1 className="text-4xl leading-[1.02] font-semibold tracking-tight sm:text-[3.5rem]">
        {meta.returned === 0 ? (
          <>
            No fits yet,
            <br />
            <span className="font-normal italic text-primary">but we&rsquo;re still looking.</span>
          </>
        ) : (
          <>
            {numberWord(meta.returned)} {meta.returned === 1 ? "neighbour" : "neighbours"}
            <br />
            <span className="font-normal italic text-primary">who could fit.</span>
          </>
        )}
      </h1>

      <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-[auto_1fr_auto] sm:items-baseline sm:gap-6">
        <div className="flex items-center gap-2">
          <Heart className="size-4 text-accent" strokeWidth={1.75} />
          <span className="text-foreground">{gig.service_category?.name ?? "Gig"}</span>
        </div>
        <div className="hidden sm:block h-px bg-border/60" />
        <p className="font-mono text-[11px] tracking-[0.12em] uppercase tabular-nums">
          {dateLine.toLowerCase()} · {timeLine.toLowerCase()}
        </p>
      </div>

      <MetaRibbon meta={meta} />
    </header>
  );
}

function MetaRibbon({
  meta,
}: {
  meta: { pool_size: number; qualifying: number; returned: number };
}) {
  return (
    <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border/60 text-sm ring-1 ring-border/60">
      <MetaCell label="In the pool" value={meta.pool_size} hint="offering this service" />
      <MetaCell label="Qualifying" value={meta.qualifying} hint="verified · in range · free" />
      <MetaCell label="Shown below" value={meta.returned} hint="top of the ranking" highlight />
    </div>
  );
}

function MetaCell({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("bg-card px-4 py-4", highlight && "bg-primary/[0.05]")}>
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums",
          highlight ? "text-2xl text-primary" : "text-xl text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug italic text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Ranked card
 * ───────────────────────────────────────────────────────────── */

function MatchCard({
  rank,
  match,
  gigId,
  rankedCaregiverIds,
  onSkip,
}: {
  rank: number;
  match: CaregiverMatch;
  gigId: number;
  rankedCaregiverIds: number[];
  onSkip: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative grid gap-5 rounded-2xl border border-border/60 bg-card p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_10px_40px_-18px_rgba(10,14,40,0.18)]",
        "sm:grid-cols-[auto_auto_1fr_auto] sm:items-center sm:gap-6 sm:p-6",
      )}
    >
      {/* Rank — newspaper position marker */}
      <div className="flex items-baseline gap-2 sm:block">
        <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase sm:block">
          §
        </span>
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground/80 sm:text-4xl">
          {String(rank).padStart(2, "0")}
        </span>
      </div>

      {/* Photo + badge */}
      <div className="relative shrink-0">
        <div className="relative size-20 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60 sm:size-24">
          {match.photo_url ? (
            <Image
              src={match.photo_url}
              alt={match.display_name}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {initials(match.display_name)}
            </div>
          )}
        </div>
        <span
          title="Basic Verified"
          className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-background"
        >
          <BadgeCheck className="size-4" strokeWidth={2.25} />
        </span>
      </div>

      {/* Identity + signals */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-xl font-semibold tracking-tight">{match.display_name}</p>
          {match.trust_is_new && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">
              New on platform
            </span>
          )}
        </div>

        {match.bio && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted-foreground italic">
            &ldquo;{match.bio}&rdquo;
          </p>
        )}

        <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Signal icon={MapPin} label={`${match.distance_km} km away`} />
          <Signal
            icon={Clock}
            label={`${match.years_of_experience} yr${match.years_of_experience === 1 ? "" : "s"} experience`}
          />
          {match.languages.length > 0 && (
            <Signal icon={Languages} label={match.languages.slice(0, 2).join(" · ")} />
          )}
          <Signal icon={ShieldCheck} label={`Trust ${match.trust_score}`} />
        </dl>
      </div>

      {/* Right rail — match % + rate + actions */}
      <div className="flex flex-col items-start gap-3 border-t border-border/50 pt-4 sm:items-end sm:border-0 sm:pt-0">
        <MatchBadge score={match.match_score} />
        <p className="font-mono text-sm tabular-nums">
          <span className="text-lg font-semibold">${match.hourly_rate}</span>
          <span className="text-muted-foreground"> / hour</span>
        </p>
        <CardActions
          gigId={gigId}
          caregiverId={match.user_id}
          rankedCaregiverIds={rankedCaregiverIds}
          onSkip={onSkip}
        />
      </div>
    </article>
  );
}

function Signal({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-foreground/80">
      <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
      <span>{label}</span>
    </div>
  );
}

function MatchBadge({ score }: { score: number }) {
  const tier = score >= 90 ? "high" : score >= 70 ? "mid" : "low";
  const styles: Record<typeof tier, string> = {
    high: "bg-success/10 text-success ring-success/40",
    mid: "bg-primary/10 text-primary ring-primary/40",
    low: "bg-muted text-foreground/60 ring-foreground/15",
  };
  return (
    <div
      className={cn("inline-flex items-baseline gap-1 rounded-full px-3 py-1 ring-1", styles[tier])}
    >
      <span className="text-2xl font-semibold tabular-nums leading-none">{score}</span>
      <span className="text-[11px] font-medium tracking-wider uppercase">%&nbsp;match</span>
    </div>
  );
}

function CardActions({
  gigId,
  caregiverId,
  rankedCaregiverIds,
  onSkip,
}: {
  gigId: number;
  caregiverId: number;
  rankedCaregiverIds: number[];
  onSkip: () => void;
}) {
  // Stash the ranked queue so the confirm page can send it along and the
  // cascade has every backup in the right order.
  const handleBookClick = () => {
    saveBookingDraft({
      gigId,
      primaryCaregiverUserId: caregiverId,
      rankedCaregiverIds: [caregiverId, ...rankedCaregiverIds.filter((id) => id !== caregiverId)],
      createdAt: Date.now(),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={`/caregivers/${caregiverId}`}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/80 underline decoration-dotted decoration-foreground/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
      >
        View profile
      </Link>
      <Link
        href={`/gigs/${gigId}/book/${caregiverId}`}
        onClick={handleBookClick}
        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(198,59,52,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Book
      </Link>
      <button
        type="button"
        onClick={onSkip}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-mono tracking-[0.14em] uppercase text-muted-foreground transition-colors hover:text-foreground"
      >
        Skip
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States
 * ───────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-16 pb-24 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />A shortlist forming
      </div>
      <div className="h-14 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-14 w-1/2 animate-pulse rounded-lg bg-muted/60" />

      <div className="mt-12 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Ranking verified caregivers in your area…
      </div>

      <ol className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-muted/40 ring-1 ring-border/50"
          />
        ))}
      </ol>
    </div>
  );
}

function EmptyShortlist({
  totalMatched,
  meta,
  gigId,
}: {
  totalMatched: number;
  meta: { pool_size: number; qualifying: number; returned: number };
  gigId: number;
}) {
  // Distinguishing exhausted (skipped everyone) vs genuine empty.
  const exhausted = totalMatched > 0 && meta.returned > 0;

  return (
    <section className="mt-14 rounded-2xl border border-dashed border-foreground/25 bg-card/60 p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Sparkles className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">
        {exhausted ? "That’s the shortlist." : "Not enough hands today."}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {exhausted
          ? "You’ve reviewed everyone we ranked. Loosen a preference, open the call to the wider feed, or check back later."
          : "No verified neighbour in your area matches all of the filters yet. Try broadening the preferences or switching to an open call."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={`/gigs/${gigId}`}>
          <Button variant="outline">Back to the gig</Button>
        </Link>
        <Link href={`/gigs/${gigId}/edit`}>
          <Button>Broaden preferences</Button>
        </Link>
      </div>
    </section>
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

function numberWord(n: number): string {
  const words = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  return words[n] ?? String(n);
}
