"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  Loader2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { useAuthStore } from "@/lib/auth";
import { listGigs, listGigsForRecipient, type Gig } from "@/lib/gigs";
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

export default function MarketplacePage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Marketplace">
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          }
        >
          <MarketplaceView />
        </Suspense>
      </DashboardShell>
    </AuthGuard>
  );
}

function MarketplaceView() {
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("category");

  const recipients = useAuthStore((s) => s.user?.family_profile?.care_recipients ?? []);

  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug);
  // null = "All gigs" view (recent-first). A recipient id = personalized
  // ranking via MatchingEngine::gigsForRecipient.
  const [activeRecipientId, setActiveRecipientId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const fetcher =
      activeRecipientId !== null
        ? listGigsForRecipient(activeRecipientId)
        : listGigs(activeSlug ?? undefined);
    fetcher.then(setGigs).catch(() => setLoadError(true));
  }, [activeSlug, activeRecipientId]);

  const activeRecipientName = useMemo(
    () =>
      activeRecipientId !== null
        ? (recipients.find((r) => r.id === activeRecipientId)?.name ?? null)
        : null,
    [recipients, activeRecipientId],
  );

  const sortedGigs = useMemo(() => {
    if (!gigs) return null;
    // Server already sorts by match_score when recipient is set; keep
    // that order. Otherwise sort by recency.
    if (activeRecipientId !== null) return gigs;
    return [...gigs].sort((a, b) =>
      (b.published_at ?? "").localeCompare(a.published_at ?? ""),
    );
  }, [gigs, activeRecipientId]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&rsquo;t load the marketplace.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Refresh the page in a moment, or try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 max-w-3xl">
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            {activeRecipientName ? (
              <>
                Caregivers for{" "}
                <span className="italic font-normal text-primary">
                  {activeRecipientName}
                </span>
                .
              </>
            ) : (
              <>
                Verified neighbours,{" "}
                <span className="italic font-normal text-primary">ready to help</span>.
              </>
            )}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {activeRecipientName
              ? `Ranked by distance, trust score, and how well each caregiver's profile fits ${activeRecipientName}'s.`
              : "Each listing is one caregiver's service offering. Pick one that fits and book a visit — they confirm, you're set."}
          </p>
        </div>

        {/* Recipient picker — only renders when the family has at least
            one care recipient. "All" falls back to the recent-first feed. */}
        {recipients.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
              Recommended for
            </p>
            <div className="flex flex-wrap gap-2">
              <RecipientChip
                label="All gigs"
                active={activeRecipientId === null}
                onClick={() => setActiveRecipientId(null)}
              />
              {recipients.map((r) => (
                <RecipientChip
                  key={r.id}
                  label={r.name}
                  active={activeRecipientId === r.id}
                  onClick={() => setActiveRecipientId(r.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Category chips — hidden when a recipient is active because the
            matcher ranks across the whole catalog (top 10) and a category
            cut on top would leave the grid nearly empty. Family can switch
            to "All gigs" to filter by category. */}
        {categories && activeRecipientId === null && (
          <div className="mb-8 flex flex-wrap gap-2 border-b border-border/60 pb-4">
            <CategoryChip
              label="All"
              active={activeSlug === null}
              onClick={() => setActiveSlug(null)}
            />
            {categories.map((cat) => (
              <CategoryChip
                key={cat.slug}
                label={cat.name}
                active={activeSlug === cat.slug}
                onClick={() => setActiveSlug(cat.slug)}
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!sortedGigs ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : sortedGigs.length === 0 ? (
          <EmptyState filter={activeSlug ? "filter" : "all"} />
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedGigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecipientChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 bg-card text-foreground/80 hover:border-foreground/30 hover:bg-muted/40",
      )}
    >
      {label}
    </button>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-foreground text-background"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function GigCard({ gig }: { gig: Gig }) {
  const Icon = gig.service_category?.icon ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const initials = (gig.caregiver?.display_name ?? "—")
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");

  return (
    <li>
      <div className="group rounded-2xl bg-card p-6 ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:ring-foreground/30 hover:shadow-sm">
        {/* Gig body — links to gig detail */}
        <Link href={`/gigs/${gig.id}`} className="block">
          {/* Eyebrow */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-primary" strokeWidth={1.75} />
              <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                {gig.service_category?.name ?? "Service"}
              </p>
            </div>
            {typeof gig.match_score === "number" ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] text-primary uppercase ring-1 ring-primary/30"
                title="Match score 0–100 — distance, trust, language and interest fit"
              >
                {gig.match_score} match
              </span>
            ) : null}
          </div>

          {/* Title */}
          <h2 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight">
            {gig.title}
          </h2>

          {/* Description */}
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground italic">
            &ldquo;{gig.description}&rdquo;
          </p>
        </Link>

        {/* Caregiver row — separate link to the caregiver's public profile,
            so a family who wants to vet a caregiver before clicking through
            to the gig has a one-tap shortcut. */}
        <div className="mt-5 flex items-center gap-3 border-t border-border/40 pt-4">
          {gig.caregiver ? (
            <Link
              href={`/caregivers/${gig.caregiver.user_id}`}
              className="-mx-2 -my-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40"
            >
              {gig.caregiver.photo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={gig.caregiver.photo_url}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover ring-1 ring-border/60"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold tracking-[0.08em] text-primary">
                  {initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium">
                  {gig.caregiver.display_name}
                  <ShieldCheck className="size-3.5 text-success" strokeWidth={2} />
                </p>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  View profile
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                —
              </span>
              <p className="text-sm font-medium text-muted-foreground">Caregiver</p>
            </div>
          )}
          <p className="font-mono text-base font-semibold tabular-nums">
            ${gig.hourly_rate_dollars.toFixed(0)}
            <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">/hr</span>
          </p>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ filter }: { filter: "filter" | "all" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-20 text-center">
      <h2 className="max-w-sm text-2xl font-semibold tracking-tight">
        {filter === "filter" ? "No gigs in that catalogue yet." : "No gigs on the board yet."}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filter === "filter"
          ? "Try a different category, or browse the full board."
          : "Verified caregivers in your area haven't posted yet. Check back in a day or two."}
      </p>
    </div>
  );
}
