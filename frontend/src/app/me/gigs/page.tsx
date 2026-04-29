"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Heart,
  type LucideIcon,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { listMyGigs, deleteGig, type Gig } from "@/lib/gigs";
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

const statusStyles: Record<Gig["status"], string> = {
  published: "bg-success/10 text-success ring-success/30",
  draft: "bg-muted text-muted-foreground ring-foreground/15",
  paused: "bg-accent/10 text-accent ring-accent/25",
};

export default function MyGigsPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="My gigs">
        <MyGigsView />
      </DashboardShell>
    </AuthGuard>
  );
}

function MyGigsView() {
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    listMyGigs()
      .then(setGigs)
      .catch(() => setLoadError(true));
  }, []);

  const handleDelete = async (gig: Gig) => {
    if (!confirm(`Delete "${gig.title}"? This can't be undone.`)) return;
    try {
      await deleteGig(gig.id);
      setGigs((prev) => prev?.filter((g) => g.id !== gig.id) ?? null);
      toast.success("Gig deleted.");
    } catch {
      toast.error("Couldn't delete that gig.");
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn&rsquo;t load your gigs.</h1>
        <p className="mt-3 text-sm text-muted-foreground">Refresh the page in a moment.</p>
      </div>
    );
  }

  if (!gigs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />

      <div className="mx-auto max-w-5xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              <span className="h-px w-8 bg-foreground/30" />
              Your notices
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              The shop, <br />
              <span className="italic font-normal text-primary">at a glance</span>.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Each notice is one of your services. Families can find them in the marketplace and
              book directly.
            </p>
          </div>

          <Link href="/me/gigs/new">
            <Button size="lg" className="h-12 px-6 text-base">
              <Plus className="size-4" />
              Post a new notice
            </Button>
          </Link>
        </div>

        {/* List */}
        {gigs.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {gigs.map((gig, idx) => (
              <GigRow key={gig.id} gig={gig} rank={idx + 1} onDelete={() => handleDelete(gig)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GigRow({ gig, rank, onDelete }: { gig: Gig; rank: number; onDelete: () => void }) {
  const Icon = gig.service_category?.icon ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const rankLabel = String(rank).padStart(2, "0");

  return (
    <li>
      <article className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-5 rounded-2xl bg-card px-5 py-4 ring-1 ring-border/60 transition-colors hover:ring-foreground/30 sm:gap-6 sm:px-6">
        {/* Rank */}
        <span className="font-mono text-xs tracking-[0.22em] text-foreground/40 uppercase">
          § {rankLabel}
        </span>

        {/* Icon */}
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>

        {/* Body */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {gig.title}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] uppercase ring-1",
                statusStyles[gig.status],
              )}
            >
              {gig.status}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{gig.description}</p>
          <p className="mt-1.5 flex items-baseline gap-2 font-mono text-xs tracking-[0.1em] text-foreground/60 uppercase">
            <span>{gig.service_category?.name ?? "—"}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums normal-case tracking-normal text-foreground">
              ${gig.hourly_rate_dollars.toFixed(2)} / hour
            </span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/me/gigs/${gig.id}/edit`}>
            <Button variant="ghost" size="sm" className="h-9">
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-9 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </article>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Heart className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="max-w-sm text-2xl font-semibold tracking-tight">
        You haven&rsquo;t posted a notice yet.
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Each notice is one productized service. Most caregivers post 2–3 — companionship, errands,
        tech help — and let families pick.
      </p>
      <Link href="/me/gigs/new" className="mt-2">
        <Button size="lg">
          <Plus className="size-4" />
          Post your first notice
        </Button>
      </Link>
    </div>
  );
}
