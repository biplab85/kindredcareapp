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
  CheckCircle2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
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

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Link
          href={backHref}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
          {/* Main */}
          <div className="min-w-0">
            {/* Eyebrow */}
            <div className="mb-4 flex items-center gap-2">
              <Icon className="size-4 text-primary" strokeWidth={1.75} />
              <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                {gig.service_category?.name ?? "Service"}
              </p>
            </div>

            <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl">
              {gig.title}
            </h1>

            <blockquote className="mt-6 border-l-2 border-accent/60 pl-5 text-lg leading-relaxed text-foreground/90 italic">
              &ldquo;{gig.description}&rdquo;
            </blockquote>

            {gig.photo_url && (
              <div className="mt-8 overflow-hidden rounded-2xl ring-1 ring-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gig.photo_url} alt={gig.title} className="max-h-96 w-full object-cover" />
              </div>
            )}

            {gig.tasks_included.length > 0 && (
              <section className="mt-10">
                <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                  What&rsquo;s included
                </p>
                <ul className="space-y-2">
                  {gig.tasks_included.map((task) => (
                    <li
                      key={task}
                      className="flex items-start gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border/60"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      <span className="text-sm leading-relaxed">{task}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Sticky caregiver + book card */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
              {/* Caregiver */}
              <div className="flex items-center gap-3">
                {gig.caregiver?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gig.caregiver.photo_url}
                    alt=""
                    className="size-12 rounded-full object-cover ring-1 ring-border/60"
                  />
                ) : (
                  <span className="grid size-12 place-items-center rounded-full bg-primary/10 font-mono text-sm font-semibold tracking-[0.08em] text-primary">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-base font-semibold">
                    {gig.caregiver?.display_name ?? "Caregiver"}
                    <ShieldCheck className="size-4 text-success" strokeWidth={2} />
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Verified · {gig.caregiver?.years_of_experience ?? 0} yrs experience
                  </p>
                </div>
              </div>

              {/* Languages */}
              {(gig.caregiver?.languages?.length ?? 0) > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Speaks {gig.caregiver?.languages.join(", ")}
                </p>
              )}

              {/* Price */}
              <div className="mt-6 border-t border-border/40 pt-5">
                <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  Hourly rate
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
                  ${gig.hourly_rate_dollars.toFixed(2)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ hour</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Platform fee 7.5% added at booking
                </p>
              </div>

              {/* CTA */}
              <div className="mt-6">
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
                      className="h-12 w-full bg-accent text-base text-accent-foreground hover:bg-accent/90"
                    >
                      Book a visit
                    </Button>
                  </Link>
                ) : (
                  <p className="rounded-xl bg-muted/60 px-4 py-3 text-center text-xs text-muted-foreground">
                    Sign in as a family to book a visit.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
