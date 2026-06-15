"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
  Check,
  LayoutGrid,
  Rows3,
  ChevronLeft,
  ChevronRight,
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

// Card-overlay status — a frosted pill with a colour-coded dot, legible
// over both the gradient placeholder and real photos.
const statusDot: Record<Gig["status"], string> = {
  published: "bg-success",
  draft: "bg-muted-foreground/60",
  paused: "bg-accent",
};

const statusText: Record<Gig["status"], string> = {
  published: "text-success",
  draft: "text-muted-foreground",
  paused: "text-accent",
};

type ViewMode = "grid" | "table";

// Table view paginates; grid shows everything at once.
const TABLE_PAGE_SIZE = 10;

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
  // Grid is the default view, per spec.
  const [view, setView] = useState<ViewMode>("grid");
  const [tablePage, setTablePage] = useState(0);

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

  // Table pagination — clamp the stored page in case a delete shrank the list.
  const totalPages = Math.max(1, Math.ceil(gigs.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(tablePage, totalPages - 1);
  const pageStart = safePage * TABLE_PAGE_SIZE;
  const tableRows = gigs.slice(pageStart, pageStart + TABLE_PAGE_SIZE);

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

      {gigs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Toolbar — count, view switcher, primary action */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              Your gigs
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums ring-1 ring-primary/20">
                {gigs.length}
              </span>
            </h2>

            <div className="flex items-center gap-2.5">
              <ViewSwitcher
                view={view}
                onChange={(v) => {
                  setView(v);
                  setTablePage(0);
                }}
              />
              <Link href="/me/gigs/new">
                <Button className="cursor-pointer">
                  <Plus className="size-4" />
                  Post a new gig
                </Button>
              </Link>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gigs.map((gig) => (
                <GigCard key={gig.id} gig={gig} onDelete={() => handleDelete(gig)} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
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
                    {tableRows.map((gig) => (
                      <GigRow key={gig.id} gig={gig} onDelete={() => handleDelete(gig)} />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <TablePager
                  page={safePage}
                  totalPages={totalPages}
                  rangeStart={pageStart + 1}
                  rangeEnd={pageStart + tableRows.length}
                  total={gigs.length}
                  onPage={setTablePage}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * View switcher — segmented Grid / Table control
 * ───────────────────────────────────────────────────────────── */

function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { id: ViewMode; label: string; icon: LucideIcon }[] = [
    { id: "grid", label: "Grid", icon: LayoutGrid },
    { id: "table", label: "Table", icon: Rows3 },
  ];

  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = view === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Table pager — Metronic-style footer: range summary + numbered
 * pages, matching the dashboard's pagination treatment.
 * ───────────────────────────────────────────────────────────── */

function TablePager({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
      <p className="text-[13px] text-muted-foreground tabular-nums">
        Showing{" "}
        <span className="font-medium text-foreground">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of <span className="font-medium text-foreground">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous page"
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPage(i)}
            aria-label={`Page ${i + 1}`}
            aria-current={i === page ? "page" : undefined}
            className={cn(
              "grid size-7 cursor-pointer place-items-center rounded-md text-[12px] font-semibold tabular-nums transition-colors",
              i === page
                ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          disabled={page === totalPages - 1}
          aria-label="Next page"
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Grid card — mirrors the /me/gigs/new "Marketplace preview" card,
 * fed with real gig data plus a status pill and kebab actions.
 * ───────────────────────────────────────────────────────────── */

function GigCard({ gig, onDelete }: { gig: Gig; onDelete: () => void }) {
  const Icon = gig.service_category?.icon ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const taskCount = gig.tasks_included?.length ?? 0;
  // Only ever show the caregiver's own uploaded photo. A gig with none —
  // or one whose image fails to load — gets the gradient placeholder
  // rather than a stock stand-in.
  const [imgFailed, setImgFailed] = useState(false);
  const src = gig.photo_url;
  const showImage = Boolean(src) && !imgFailed;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(10,14,40,0.28)]">
      {/* media */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {showImage && src ? (
          <Image
            src={src}
            alt={gig.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
            <Icon className="size-12 text-primary/30" strokeWidth={1.5} />
          </div>
        )}

        {/* status — frosted pill, top-left */}
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase shadow-sm ring-1 ring-border/60 backdrop-blur",
            statusText[gig.status],
          )}
        >
          <span className={cn("size-1.5 rounded-full", statusDot[gig.status])} />
          {gig.status}
        </span>

        {/* actions — kebab, top-right */}
        <div className="absolute top-2.5 right-2.5">
          <GigActions gig={gig} onDelete={onDelete} overMedia />
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" strokeWidth={1.75} />
          {gig.service_category?.name ?? "—"}
        </div>

        <Link
          href={`/gigs/${gig.id}`}
          className="mt-1.5 line-clamp-2 text-base leading-snug font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          {gig.title}
        </Link>

        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {gig.description}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
          <p className="text-sm">
            <span className="font-semibold text-foreground tabular-nums">
              ${gig.hourly_rate_dollars.toFixed(2)}
            </span>
            <span className="text-muted-foreground"> / hr</span>
          </p>
          {taskCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Check className="size-3.5" strokeWidth={2.5} />
              {taskCount} task{taskCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared kebab actions — used by both the grid card and table row
 * ───────────────────────────────────────────────────────────── */

function GigActions({
  gig,
  onDelete,
  overMedia,
}: {
  gig: Gig;
  onDelete: () => void;
  overMedia?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Gig actions"
        className={cn(
          "grid size-8 shrink-0 cursor-pointer place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          overMedia
            ? "bg-card/90 text-muted-foreground shadow-sm ring-1 ring-border/60 backdrop-blur hover:text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
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
          <GigActions gig={gig} onDelete={onDelete} />
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
