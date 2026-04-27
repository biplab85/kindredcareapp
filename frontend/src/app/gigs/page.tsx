"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
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
  Pencil,
  XCircle,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { listGigs, cancelGig, deleteGig, type Gig, type GigStatus } from "@/lib/gigs";
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

type StatusFilter = "all" | GigStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "matched", label: "Matched" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusStyles: Record<GigStatus, string> = {
  open: "bg-primary/10 text-primary ring-primary/30",
  matched: "bg-info/10 text-info ring-info/30",
  booked: "bg-success/10 text-success ring-success/30",
  completed: "bg-muted text-foreground/70 ring-foreground/20",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/25",
};

export default function GigsPage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="My gigs">
        <GigsDashboard />
      </DashboardShell>
    </AuthGuard>
  );
}

function GigsDashboard() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const refreshKey = useRef(0);

  // Fetch inline — all state mutations live inside the promise callbacks so
  // React 19's set-state-in-effect rule stays satisfied. We keep old results
  // visible during re-fetch; a single spinner only shows on the initial load.
  useEffect(() => {
    refreshKey.current += 1;
    const key = refreshKey.current;
    listGigs(filter === "all" ? undefined : filter)
      .then((data) => {
        if (key !== refreshKey.current) return;
        setGigs(data);
        setLoadError(false);
      })
      .catch(() => {
        if (key !== refreshKey.current) return;
        setLoadError(true);
      });
  }, [filter]);

  const reload = () => {
    refreshKey.current += 1;
    const key = refreshKey.current;
    listGigs(filter === "all" ? undefined : filter)
      .then((data) => {
        if (key !== refreshKey.current) return;
        setGigs(data);
        setLoadError(false);
      })
      .catch(() => {
        if (key !== refreshKey.current) return;
        setLoadError(true);
      });
  };

  const handleCancel = async (gig: Gig) => {
    try {
      await cancelGig(gig.id);
      toast.success("Gig cancelled.");
      reload();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not cancel the gig.";
      toast.error(message);
    }
  };

  const handleDelete = async (gig: Gig) => {
    if (!confirm("Delete this gig permanently?")) return;
    try {
      await deleteGig(gig.id);
      toast.success("Gig deleted.");
      reload();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not delete the gig.";
      toast.error(message);
    }
  };

  // Group by status only — keeps render pure (no Date.now()) and aligns with
  // how the state machine already tracks gig lifecycle.
  const grouped = useMemo(() => {
    if (!gigs) return { upcoming: [], past: [] };
    return gigs.reduce<{ upcoming: Gig[]; past: Gig[] }>(
      (acc, gig) => {
        if (gig.status === "completed" || gig.status === "cancelled") {
          acc.past.push(gig);
        } else {
          acc.upcoming.push(gig);
        }
        return acc;
      },
      { upcoming: [], past: [] },
    );
  }, [gigs]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Your notices
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Every gig you&rsquo;ve posted,
            <br />
            <span className="italic font-normal text-primary">at a glance</span>.
          </h1>
        </div>

        <Link href="/gigs/new">
          <Button size="lg" className="h-12 px-6 text-base">
            <Plus className="size-4" />
            Post a new gig
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-border/60 pb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              filter === f.value
                ? "bg-foreground text-background"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loadError ? (
        <ErrorBlock onRetry={reload} />
      ) : gigs === null ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : gigs.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-12">
          {grouped.upcoming.length > 0 && (
            <GigSection
              label="Upcoming"
              gigs={grouped.upcoming}
              onCancel={handleCancel}
              onDelete={handleDelete}
            />
          )}
          {grouped.past.length > 0 && (
            <GigSection
              label="Past &amp; closed"
              gigs={grouped.past}
              onCancel={handleCancel}
              onDelete={handleDelete}
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}

function GigSection({
  label,
  gigs,
  onCancel,
  onDelete,
  muted,
}: {
  label: string;
  gigs: Gig[];
  onCancel: (gig: Gig) => void;
  onDelete: (gig: Gig) => void;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-5 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
        <span dangerouslySetInnerHTML={{ __html: label }} />
      </h2>
      <ul className={cn("grid gap-4", muted && "opacity-80")}>
        {gigs.map((gig) => (
          <GigCard key={gig.id} gig={gig} onCancel={onCancel} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}

function GigCard({
  gig,
  onCancel,
  onDelete,
}: {
  gig: Gig;
  onCancel: (gig: Gig) => void;
  onDelete: (gig: Gig) => void;
}) {
  const Icon = gig.service_category ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const start = new Date(gig.scheduled_start);
  const end = new Date(gig.scheduled_end);
  const canEdit = gig.status === "open";

  const startLine = start.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLine = `${start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;

  return (
    <li>
      <article
        className={cn(
          "relative flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-border/70 transition-all sm:flex-row sm:items-start",
          "hover:ring-foreground/25 hover:shadow-[0_20px_48px_-28px] hover:shadow-foreground/20",
        )}
      >
        {/* Icon */}
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Icon className="size-5" strokeWidth={1.8} />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/gigs/${gig.id}`}
              className="truncate text-lg font-semibold tracking-tight hover:underline"
            >
              {gig.service_category?.name ?? "Gig"}
            </Link>
            <StatusBadge status={gig.status} />
            {gig.is_recurring && (
              <Badge variant="outline" className="text-[10px]">
                Recurring
              </Badge>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {gig.description}
          </p>

          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-foreground/75 sm:grid-cols-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-foreground/50" />
              <dt className="sr-only">When</dt>
              <dd>
                {startLine} · {timeLine}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-foreground/50" />
              <dt className="sr-only">Where</dt>
              <dd className="truncate">{gig.location_address}</dd>
            </div>
          </dl>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          <Link href={`/gigs/${gig.id}`}>
            <Button variant="outline" size="sm" className="w-full">
              View
            </Button>
          </Link>
          {canEdit && (
            <>
              <Link href={`/gigs/${gig.id}/edit`}>
                <Button variant="ghost" size="sm" className="w-full">
                  <Pencil className="size-3" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => onCancel(gig)}
              >
                <XCircle className="size-3" />
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => onDelete(gig)}
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
            </>
          )}
        </div>
      </article>
    </li>
  );
}

function StatusBadge({ status }: { status: GigStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase ring-1",
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}

function EmptyState({ filter }: { filter: StatusFilter }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarDays className="size-6" />
      </div>
      <h2 className="max-w-sm text-2xl font-semibold tracking-tight">
        {filter === "all" ? "You haven't posted a gig yet." : `No ${filter} gigs right now.`}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tell us what would help, and we&rsquo;ll show it to verified caregivers near you.
      </p>
      <Link href="/gigs/new" className="mt-2">
        <Button size="lg">
          <Plus className="size-4" />
          Post your first gig
        </Button>
      </Link>
    </div>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <h2 className="text-xl font-semibold">Couldn&rsquo;t load your gigs.</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Something got stuck between here and the server. Try again in a moment.
      </p>
      <Button variant="outline" onClick={onRetry} className="mt-2">
        Retry
      </Button>
    </div>
  );
}
