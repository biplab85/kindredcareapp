"use client";

import { use, useEffect, useState } from "react";
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
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ImageOff,
  Languages,
  UserRound,
  Pencil,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { VerificationBreakdown } from "@/components/caregiver/verification-breakdown";
import { getGig, type Gig } from "@/lib/gigs";
import { useAuthStore } from "@/lib/auth";

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

export default function GigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gigId = Number(id);

  return (
    <AuthGuard>
      <DashboardShell pageTitle="Listing">
        <GigDetailView gigId={gigId} />
      </DashboardShell>
    </AuthGuard>
  );
}

function GigDetailView({ gigId }: { gigId: number }) {
  const user = useAuthStore((s) => s.user);
  const [gig, setGig] = useState<Gig | null>(null);
  const [error, setError] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const idIsValid = !Number.isNaN(gigId);

  useEffect(() => {
    if (!idIsValid) return;
    getGig(gigId)
      .then(setGig)
      .catch(() => setError(true));
  }, [gigId, idIsValid]);

  if (!idIsValid || error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn&rsquo;t find that listing.</h1>
        <Link href="/marketplace" className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="size-4" />
            Back to marketplace
          </Button>
        </Link>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const Icon = gig.service_category?.icon ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const initials = (gig.caregiver?.display_name ?? "—")
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
  const isFamily = user?.role === "family";
  // Caregiver viewing their own listing — they need management actions, not
  // the family-facing "Book" CTA, and the back-link should land them on
  // their own dashboard since the marketplace route is family-gated.
  const isOwner = !!user && gig.caregiver?.user_id === user.id;
  const backHref = isOwner ? "/me/gigs" : "/marketplace";
  const backLabel = isOwner ? "Back to my gigs" : "Back to marketplace";
  const showPhoto = !!gig.photo_url && !photoFailed;

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-8">
        {/* Main */}
        <div className="min-w-0 space-y-6">
          {/* Header card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs sm:p-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
              <Icon className="size-3.5" strokeWidth={2} />
              {gig.service_category?.name ?? "Service"}
            </span>

            <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
              {gig.title}
            </h1>

            <p className="mt-3 leading-relaxed text-muted-foreground">{gig.description}</p>
          </div>

          {/* Photo — solid panel, graceful fallback (never a broken image) */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {showPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gig.photo_url ?? undefined}
                alt={gig.title}
                onError={() => setPhotoFailed(true)}
                className="h-64 w-full object-cover sm:h-80"
              />
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center gap-3 bg-muted/40 sm:h-80">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImageOff className="size-6" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No photo for this listing yet
                </p>
              </div>
            )}
          </div>

          {/* What's included */}
          {gig.tasks_included.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="border-b border-border px-5 py-4 sm:px-6">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  What&rsquo;s included
                </h2>
              </div>
              <ul className="flex flex-wrap gap-2 px-5 py-5 sm:px-6">
                {gig.tasks_included.map((task) => (
                  <li key={task}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success ring-1 ring-success/30">
                      <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2.25} />
                      {task}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sticky caregiver + book card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Brand-gradient header band */}
            <div className="relative h-24 bg-gradient-to-br from-primary/20 via-primary/5 to-accent/15">
              <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_0%,oklch(1_0_0/0.35),transparent_55%)]" />
            </div>

            <div className="px-6 pb-6">
              {/* Avatar overlapping the band, name + trust line beside it */}
              <div className="-mt-12 flex items-end gap-4">
                <div className="relative shrink-0">
                  {gig.caregiver?.photo_url && !avatarFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={gig.caregiver.photo_url}
                      alt=""
                      onError={() => setAvatarFailed(true)}
                      className="size-20 rounded-full object-cover shadow-md ring-4 ring-card"
                    />
                  ) : (
                    <span className="grid size-20 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-primary shadow-md ring-4 ring-card">
                      {initials}
                    </span>
                  )}
                  {/* Only stamp the avatar shield when the caregiver has
                      actually cleared all four background checks. The
                      previous overlay was hard-coded on every gig and
                      misled families on partially-verified profiles. */}
                  {gig.caregiver?.is_verified && (
                    <span
                      className="absolute right-0.5 bottom-0.5 grid size-7 place-items-center rounded-full bg-success text-white ring-2 ring-card"
                      title="Fully verified"
                    >
                      <ShieldCheck className="size-4" strokeWidth={2.5} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 pb-1">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {gig.caregiver?.display_name ?? "Caregiver"}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {gig.caregiver?.years_of_experience ?? 0} yrs experience
                    </span>
                    {gig.caregiver?.rating && gig.caregiver.rating.average !== null && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                        <Star
                          className="size-3.5 fill-accent text-accent"
                          strokeWidth={0}
                        />
                        {gig.caregiver.rating.average.toFixed(1)}
                        <span className="font-medium text-muted-foreground">
                          ({gig.caregiver.rating.count})
                        </span>
                      </span>
                    )}
                  </div>
                  {/* Slim 4-chip breakdown — replaces the prior hard-coded
                      "Verified" text pill with the actual per-check state. */}
                  {gig.caregiver?.verification_checks &&
                    gig.caregiver.verification_checks.length > 0 && (
                      <VerificationBreakdown
                        checks={gig.caregiver.verification_checks}
                        variant="slim"
                        className="mt-2"
                      />
                    )}
                </div>
              </div>

              {/* Languages */}
              {(gig.caregiver?.languages?.length ?? 0) > 0 && (
                <div className="mt-5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <Languages className="size-3.5" strokeWidth={2} />
                    Speaks
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {gig.caregiver?.languages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.06] px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-primary/15"
                      >
                        <span className="size-1.5 rounded-full bg-primary/70" />
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full profile — premium row */}
              {gig.caregiver ? (
                <Link
                  href={`/caregivers/${gig.caregiver.user_id}`}
                  className="group mt-5 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-xs transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                      <UserRound className="size-4" strokeWidth={2} />
                    </span>
                    <span className="text-sm font-semibold text-foreground">View full profile</span>
                  </span>
                  <ArrowUpRight
                    className="size-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                    strokeWidth={2.5}
                  />
                </Link>
              ) : null}

              {/* Price panel */}
              <div className="mt-5 rounded-xl bg-muted/40 p-4 ring-1 ring-border/60">
                <p className="text-xs font-medium text-muted-foreground">Hourly rate</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                    ${gig.hourly_rate_dollars.toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">/hr</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Platform fee 7.5% added at booking
                </p>
              </div>

              {/* CTA */}
              <div className="mt-4">
                {isOwner ? (
                  <Link href={`/me/gigs/${gig.id}/edit`} className="block">
                    <Button size="lg" variant="outline" className="h-12 w-full text-base">
                      <Pencil className="size-4" />
                      Edit this gig
                    </Button>
                  </Link>
                ) : isFamily ? (
                  <Link href={`/gigs/${gig.id}/book`} className="block">
                    <Button
                      size="lg"
                      className="h-12 w-full bg-accent text-base text-accent-foreground shadow-sm transition-colors hover:bg-accent/90"
                    >
                      Book a visit
                    </Button>
                  </Link>
                ) : (
                  <p className="rounded-lg bg-muted/60 px-4 py-3 text-center text-xs text-muted-foreground">
                    Sign in as a family to book a visit.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
