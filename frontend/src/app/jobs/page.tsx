"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Loader2,
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  Sparkles,
  RefreshCw,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { fetchCaregiverFeed, type CaregiverGig, type FeedSort } from "@/lib/caregiver-feed";
import { fetchServiceCategories, type ServiceCategory } from "@/lib/service-categories";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
};

export default function JobsPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Open gigs">
        <Feed />
      </DashboardShell>
    </AuthGuard>
  );
}

function Feed() {
  const [gigs, setGigs] = useState<CaregiverGig[] | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [sort, setSort] = useState<FeedSort>("soonest");
  const refreshKey = useRef(0);

  // Load categories once for the filter chip row (limited to categories the
  // caregiver actually offers — we rely on feed results to infer them).
  useEffect(() => {
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => {
        /* Silent — filter chips will be empty and the feed still works. */
      });
  }, []);

  useEffect(() => {
    refreshKey.current += 1;
    const key = refreshKey.current;
    fetchCaregiverFeed({ service: serviceFilter || undefined, sort })
      .then((data) => {
        if (key !== refreshKey.current) return;
        setGigs(data);
        setLoadError(false);
      })
      .catch(() => {
        if (key !== refreshKey.current) return;
        setLoadError(true);
      });
  }, [serviceFilter, sort]);

  const offeredCategoryIds = useMemo(() => {
    if (!gigs) return new Set<number>();
    return new Set(
      gigs.map((g) => g.service_category?.id).filter((id): id is number => id !== undefined),
    );
  }, [gigs]);

  const filterableCategories = useMemo(() => {
    // Surface only categories where we have at least one available gig OR where
    // the user has explicitly filtered. Prevents empty-promise chips.
    return categories.filter((c) => offeredCategoryIds.has(c.id) || c.slug === serviceFilter);
  }, [categories, offeredCategoryIds, serviceFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
      {/* Masthead */}
      <header className="mb-10 border-b-2 border-foreground pb-6">
        <div className="flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" />
          The noticeboard
          <span className="h-px w-8 bg-foreground/30" />
        </div>
        <div className="mt-5 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Today&rsquo;s open
              <br />
              <span className="italic font-normal text-primary">notices</span> from Durham.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Only gigs in services you offer. Exact addresses are shared once a booking is
              accepted.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SortToggle sort={sort} onChange={setSort} />
          </div>
        </div>
      </header>

      {/* Filter row */}
      {filterableCategories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <FilterChip active={serviceFilter === ""} onClick={() => setServiceFilter("")}>
            Everything
          </FilterChip>
          {filterableCategories.map((c) => (
            <FilterChip
              key={c.id}
              active={serviceFilter === c.slug}
              onClick={() => setServiceFilter(c.slug)}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>
      )}

      {/* Content */}
      {loadError ? (
        <ErrorBlock
          onRetry={() => {
            refreshKey.current += 1;
            const key = refreshKey.current;
            fetchCaregiverFeed({ service: serviceFilter || undefined, sort })
              .then((data) => {
                if (key !== refreshKey.current) return;
                setGigs(data);
                setLoadError(false);
              })
              .catch(() => {
                if (key !== refreshKey.current) return;
                setLoadError(true);
              });
          }}
        />
      ) : gigs === null ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : gigs.length === 0 ? (
        <EmptyState serviceFilter={serviceFilter} onClear={() => setServiceFilter("")} />
      ) : (
        <ul className="grid gap-5">
          {gigs.map((gig) => (
            <li key={gig.id}>
              <JobCard gig={gig} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Pieces
 * ───────────────────────────────────────────────────────────── */

function SortToggle({ sort, onChange }: { sort: FeedSort; onChange: (s: FeedSort) => void }) {
  return (
    <div className="inline-flex rounded-full bg-muted/60 p-1 ring-1 ring-border/60">
      <button
        type="button"
        onClick={() => onChange("soonest")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
          sort === "soonest"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground",
        )}
      >
        <CalendarDays className="size-3.5" />
        Soonest
      </button>
      <button
        type="button"
        onClick={() => onChange("nearest")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
          sort === "nearest"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground",
        )}
      >
        <Compass className="size-3.5" />
        Nearest
      </button>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/70 bg-background hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function JobCard({ gig }: { gig: CaregiverGig }) {
  const Icon = gig.service_category ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const start = new Date(gig.scheduled_start);
  const end = new Date(gig.scheduled_end);
  const duration = Math.round((end.getTime() - start.getTime()) / 3_600_000);

  const dateLine = start.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLine = `${start.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;

  const prefLines: string[] = [];
  if (gig.preferences.gender && gig.preferences.gender !== "any") {
    prefLines.push(gig.preferences.gender === "female" ? "Prefers female" : "Prefers male");
  }
  if (gig.preferences.language) prefLines.push(gig.preferences.language);
  const rateLine =
    gig.preferences.rate_max != null ? `Caps at $${gig.preferences.rate_max}/hr` : null;

  return (
    <Link
      href={`/jobs/${gig.id}`}
      className={cn(
        "group relative grid grid-cols-[auto_1fr_auto] items-start gap-5 rounded-2xl bg-card p-5 ring-1 ring-border/70 transition-all",
        "hover:ring-foreground/25 hover:shadow-[0_20px_48px_-28px] hover:shadow-foreground/20",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      {/* Icon */}
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>

      {/* Body */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {gig.service_category?.name ?? "Notice"}
          </h2>
          {gig.is_recurring && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-accent uppercase ring-1 ring-accent/30">
              Recurring
            </span>
          )}
          {rateLine && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-success uppercase ring-1 ring-success/30">
              {rateLine}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {gig.description}
        </p>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-foreground/75 sm:grid-cols-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-foreground/45" />
            <dt className="sr-only">When</dt>
            <dd>
              {dateLine} · {timeLine} · {duration}h
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-foreground/45" />
            <dt className="sr-only">Where</dt>
            <dd>{gig.neighbourhood.label}</dd>
          </div>
          {prefLines.length > 0 && (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <Sparkles className="size-3.5 text-foreground/45" />
              <dt className="sr-only">Preferences</dt>
              <dd className="italic text-foreground/65">{prefLines.join(" · ")}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Arrow */}
      <ArrowUpRight
        className="mt-2 size-5 -translate-x-0.5 translate-y-0.5 text-foreground/30 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-foreground/80"
        strokeWidth={1.8}
      />
    </Link>
  );
}

function EmptyState({ serviceFilter, onClear }: { serviceFilter: string; onClear: () => void }) {
  if (serviceFilter) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-20 text-center">
        <h2 className="max-w-md text-2xl font-semibold tracking-tight">
          Nothing in this category right now.
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Try a different service or view everything that&rsquo;s open.
        </p>
        <Button variant="outline" onClick={onClear}>
          <RefreshCw className="size-4" />
          Show everything
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-6" />
      </div>
      <h2 className="max-w-md text-2xl font-semibold tracking-tight">The noticeboard is quiet.</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        No gigs match your services at the moment. Make sure your profile lists every service
        you&rsquo;d like to offer — more services, more notices.
      </p>
      <Link href="/onboarding" className="mt-2">
        <Button variant="outline">Review your profile</Button>
      </Link>
    </div>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <h2 className="text-xl font-semibold">Couldn&rsquo;t load the noticeboard.</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        The server isn&rsquo;t answering right now. Give it a moment and try again.
      </p>
      <Button variant="outline" onClick={onRetry} className="mt-2">
        Retry
      </Button>
    </div>
  );
}
