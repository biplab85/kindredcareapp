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
  ArrowRight,
  Sparkles,
  SearchX,
  Eye,
  UserRound,
  MoreVertical,
  Star,
  type LucideIcon,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    return [...gigs].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
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

  const showCategoryFilter = Boolean(categories && activeRecipientId === null);
  const showFilterPanel = recipients.length > 0 || showCategoryFilter;
  const resultCount = sortedGigs?.length ?? 0;

  return (
    <div className="max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Page header — dashboard-style title + meta, live result count aside */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">
            {activeRecipientName ? (
              <>
                Caregivers for{" "}
                <span className="font-normal text-muted-foreground">{activeRecipientName}</span>.
              </>
            ) : (
              <>
                Verified neighbours,{" "}
                <span className="font-normal text-muted-foreground">ready to help</span>.
              </>
            )}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {activeRecipientName
              ? `Ranked by distance, trust score, and how well each caregiver's profile fits ${activeRecipientName}'s.`
              : "Each listing is one caregiver's service offering. Pick one that fits and book a visit — they confirm, you're set."}
          </p>
        </div>

        {sortedGigs && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
            <span className="font-bold tabular-nums text-foreground">{resultCount}</span>
            <span className="text-muted-foreground">
              {resultCount === 1 ? "caregiver" : "caregivers"}
            </span>
          </span>
        )}
      </div>

      {/* Filter panel — recipient picker + category chips grouped into a
          single premium toolbar card. */}
      {showFilterPanel && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5">
          {/* Recipient picker — only renders when the family has at least
              one care recipient. "All" falls back to the recent-first feed. */}
          {recipients.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
          {showCategoryFilter && (
            <div className={recipients.length > 0 ? "mt-4 border-t border-border/60 pt-4" : ""}>
              <p className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Browse by service
              </p>
              <div className="flex flex-wrap gap-1.5">
                <CategoryChip
                  label="All"
                  active={activeSlug === null}
                  onClick={() => setActiveSlug(null)}
                />
                {categories!.map((cat) => (
                  <CategoryChip
                    key={cat.slug}
                    label={cat.name}
                    active={activeSlug === cat.slug}
                    onClick={() => setActiveSlug(cat.slug)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="mt-8">
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
        "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
          : "border border-border bg-card text-foreground/75 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground",
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
        "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
          : "border-border bg-card text-foreground/70 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* Footer action — 3-dot dropdown ("View gig" with an eye icon, plus a
   shortcut to the caregiver's public profile when present). Mirrors the
   dashboard card-header kebab menu pattern. */
function GigCardMenu({ gigId, caregiverUserId }: { gigId: number; caregiverUserId?: number }) {
  const itemClass =
    "cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Gig actions"
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        <DropdownMenuItem render={<Link href={`/gigs/${gigId}`} />} className={itemClass}>
          <Eye className="size-4 text-muted-foreground" />
          View gig
        </DropdownMenuItem>
        {caregiverUserId != null && (
          <DropdownMenuItem
            render={<Link href={`/caregivers/${caregiverUserId}`} />}
            className={itemClass}
          >
            <UserRound className="size-4 text-muted-foreground" />
            View profile
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
      <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-sm shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_34px_-16px_rgba(10,14,40,0.22)]">
        {/* Header — category badge + optional match score */}
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary">
            <Icon className="size-3.5" strokeWidth={2} />
            {gig.service_category?.name ?? "Service"}
          </span>
          {typeof gig.match_score === "number" ? (
            <span
              className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] font-semibold tabular-nums text-success ring-1 ring-success/20"
              title="Match score 0–100 — distance, trust, language and interest fit"
            >
              <Sparkles className="size-3" strokeWidth={2} />
              {gig.match_score}% match
            </span>
          ) : null}
        </div>

        {/* Body — links to gig detail */}
        <Link href={`/gigs/${gig.id}`} className="flex grow flex-col px-5 pt-3.5">
          <h2 className="line-clamp-2 text-sm leading-snug font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {gig.title}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {gig.description}
          </p>
        </Link>

        {/* Caregiver row — separate link to the caregiver's public profile,
            so a family who wants to vet a caregiver before clicking through
            to the gig has a one-tap shortcut. */}
        <div className="mt-4 px-5">
          {gig.caregiver ? (
            <Link
              href={`/caregivers/${gig.caregiver.user_id}`}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-2.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
            >
              <span className="relative shrink-0">
                {gig.caregiver.photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={gig.caregiver.photo_url}
                    alt=""
                    className="size-10 rounded-full object-cover ring-1 ring-border/60"
                  />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-xs font-bold tracking-wide text-primary">
                    {initials}
                  </span>
                )}
                {/* Avatar shield only when ALL four checks are cleared. The
                    prior version showed it unconditionally, which lied on
                    partially-verified profiles. */}
                {gig.caregiver.is_verified && (
                  <span
                    className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-card"
                    title="Fully verified"
                  >
                    <ShieldCheck className="size-4 text-success" strokeWidth={2.25} />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {gig.caregiver.display_name}
                </p>
                <p className="flex items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{gig.caregiver.is_verified ? "Verified caregiver" : "Pending verification"}</span>
                  {gig.caregiver.rating && gig.caregiver.rating.average !== null && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                      <Star
                        className="size-3 fill-accent text-accent"
                        strokeWidth={0}
                      />
                      {gig.caregiver.rating.average.toFixed(1)}
                      <span className="font-medium text-muted-foreground">
                        ({gig.caregiver.rating.count})
                      </span>
                    </span>
                  )}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                —
              </span>
              <p className="text-sm font-medium text-muted-foreground">Caregiver</p>
            </div>
          )}
        </div>

        {/* Footer — rate + 3-dot actions menu */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 px-5 py-4">
          <div className="leading-none">
            <span className="text-xl font-bold tabular-nums text-foreground">
              ${gig.hourly_rate_dollars.toFixed(0)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">/hr</span>
          </div>
          <GigCardMenu gigId={gig.id} caregiverUserId={gig.caregiver?.user_id} />
        </div>
      </div>
    </li>
  );
}

function EmptyState({ filter }: { filter: "filter" | "all" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <SearchX className="size-7" strokeWidth={1.75} />
      </span>
      <h2 className="max-w-sm text-xl font-semibold tracking-tight">
        {filter === "filter" ? "No gigs in that catalogue yet." : "No gigs on the board yet."}
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {filter === "filter"
          ? "Try a different category, or browse the full board."
          : "Verified caregivers in your area haven't posted yet. Check back in a day or two."}
      </p>
    </div>
  );
}
