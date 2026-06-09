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
import { listGigs, type Gig } from "@/lib/gigs";
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

  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    listGigs(activeSlug ?? undefined)
      .then(setGigs)
      .catch(() => setLoadError(true));
  }, [activeSlug]);

  const sortedGigs = useMemo(
    () =>
      gigs
        ? [...gigs].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
        : null,
    [gigs],
  );

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
            Verified neighbours,{" "}
            <span className="italic font-normal text-primary">ready to help</span>.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Each listing is one caregiver&rsquo;s service offering. Pick one that fits and book a
            visit — they confirm, you&rsquo;re set.
          </p>
        </div>

        {/* Category chips */}
        {categories && (
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
          <div className="mb-3 flex items-center gap-2">
            <Icon className="size-4 text-primary" strokeWidth={1.75} />
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              {gig.service_category?.name ?? "Service"}
            </p>
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
