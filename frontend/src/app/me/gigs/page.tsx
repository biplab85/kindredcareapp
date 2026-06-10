"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  Heart,
  type LucideIcon,
  MoreVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Header — matches the dashboard title font size & colour */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">
          The shop, at a glance.
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Each gig is one of your services. Families find them in the marketplace and book directly.
        </p>
      </div>

      {/* List */}
      {gigs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {/* card toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              Your gigs
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums ring-1 ring-primary/20">
                {gigs.length}
              </span>
            </h2>
            <Link href="/me/gigs/new">
              <Button className="cursor-pointer">
                <Plus className="size-4" />
                Post a new gig
              </Button>
            </Link>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th className="py-3 pr-4 pl-5 text-[11px] font-semibold tracking-wide text-foreground capitalize sm:pl-6">
                    Gig
                  </th>
                  <th className="hidden px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground capitalize md:table-cell">
                    Category
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground capitalize">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground capitalize">
                    Status
                  </th>
                  <th className="py-3 pr-5 pl-4 text-right text-[11px] font-semibold tracking-wide text-foreground capitalize sm:pr-6"></th>
                </tr>
              </thead>
              <tbody>
                {gigs.map((gig) => (
                  <GigRow key={gig.id} gig={gig} onDelete={() => handleDelete(gig)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function GigRow({ gig, onDelete }: { gig: Gig; onDelete: () => void }) {
  const Icon = gig.service_category?.icon ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;

  return (
    <tr className="group border-b border-border/60 transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      {/* Gig — icon avatar + title + description */}
      <td className="py-3 pr-4 pl-5 sm:pl-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <Link
              href={`/gigs/${gig.id}`}
              className="block truncate text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
            >
              {gig.title}
            </Link>
            <p className="mt-0.5 line-clamp-1 max-w-[320px] text-[13px] text-muted-foreground">
              {gig.description}
            </p>
            {/* category shown inline on small screens where the column is hidden */}
            <p className="mt-0.5 text-[12px] text-muted-foreground md:hidden">
              {gig.service_category?.name ?? "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="hidden px-4 py-3 align-middle md:table-cell">
        <span className="text-sm text-muted-foreground">{gig.service_category?.name ?? "—"}</span>
      </td>

      {/* Rate */}
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        <span className="text-sm font-medium text-foreground tabular-nums">
          ${gig.hourly_rate_dollars.toFixed(2)}
        </span>
        <span className="text-[13px] text-muted-foreground"> / hr</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-middle">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1",
            statusStyles[gig.status],
          )}
        >
          {gig.status}
        </span>
      </td>

      {/* Actions — 3-dot kebab dropdown, same pattern as the dashboard cards */}
      <td className="py-3 pr-5 pl-4 text-right align-middle sm:pr-6">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Gig actions"
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-40">
              <DropdownMenuItem
                render={<Link href={`/gigs/${gig.id}`} />}
                className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
              >
                <Eye className="size-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href={`/me/gigs/${gig.id}/edit`} />}
                className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
              >
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete} className="cursor-pointer gap-2">
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Heart className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="max-w-sm text-2xl font-semibold tracking-tight">
        You haven&rsquo;t posted a gig yet.
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Each gig is one productized service. Most caregivers post 2–3 — companionship, errands, tech
        help — and let families pick.
      </p>
      <Link href="/me/gigs/new" className="mt-2">
        <Button size="lg" className="cursor-pointer">
          <Plus className="size-4" />
          Post your first gig
        </Button>
      </Link>
    </div>
  );
}
