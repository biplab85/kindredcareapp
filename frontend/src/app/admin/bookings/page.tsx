"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  LayoutGrid,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldAlert,
  Table as TableIcon,
  TimerReset,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SlideTabs } from "@/components/ui/slide-tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type BookingCard,
  type BookingListQuery,
  type BookingListResponse,
  formatDollars,
  getAdminBookings,
  paymentStatusLabel,
  paymentTone,
  statusLabel,
  type StatusTone,
  statusTone,
} from "@/lib/admin-bookings";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminBookingsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Bookings">
        <BookingsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";
type ViewMode = "grid" | "table";

interface FilterState {
  q: string;
  status: string;
  hasDispute: boolean;
  from: string;
  to: string;
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any" },
  { value: "pending_caregiver", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
];

const DATE_INPUT_CLASS =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50";

// The shared Calendar opens its initial view at (toYear − 25) — tuned for
// dates of birth. For a recent-date range filter we want it to land on the
// current year, so toYear is offset by +25. Snapshotted once at module load.
const CALENDAR_TO_YEAR = new Date().getFullYear() + 25;

function BookingsView() {
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    status: "",
    hasDispute: false,
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [resp, setResp] = useState<BookingListResponse | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The grid view has no pager, so it fetches everything in one page; the
  // table view paginates. Read via a ref so buildQuery stays dependency-free.
  const viewRef = useRef<ViewMode>("grid");

  const buildQuery = useCallback(
    (f: FilterState, p: number): BookingListQuery => ({
      q: f.q.trim() || undefined,
      status: f.status || undefined,
      has_dispute: f.hasDispute || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
      page: p,
      per_page: viewRef.current === "grid" ? 100 : 15,
    }),
    [],
  );

  const reload = useCallback(
    async (f: FilterState, p: number) => {
      setState("loading");
      try {
        const data = await getAdminBookings(buildQuery(f, p));
        setResp(data);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAdminBookings(buildQuery(filters, page));
        if (!alive) return;
        setResp(data);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearchChange(next: string) {
    setFilters((prev) => ({ ...prev, q: next }));
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void reload({ ...filters, q: next }, 1);
    }, 250);
  }

  function onStatusChange(next: string) {
    const f = { ...filters, status: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onDisputeToggle() {
    const f = { ...filters, hasDispute: !filters.hasDispute };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onFromChange(next: string) {
    const f = { ...filters, from: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onToChange(next: string) {
    const f = { ...filters, to: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onDatesReset() {
    const f = { ...filters, from: "", to: "" };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onPageChange(next: number) {
    setPage(next);
    void reload(filters, next);
  }

  // Switching view changes the page size (grid = all, table = paginated),
  // so refetch from page 1 whenever the view toggles.
  function onViewChange(next: ViewMode) {
    if (next === view) return;
    viewRef.current = next;
    setView(next);
    setPage(1);
    void reload(filters, 1);
  }

  function retry() {
    void reload(filters, page);
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload(filters, page);
    } finally {
      setRefreshing(false);
    }
  }

  const total = resp?.meta.total ?? 0;
  const lastPage = resp?.meta.last_page ?? 1;
  const hasResults = (resp?.data.length ?? 0) > 0;

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
          Bookings
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The full booking ledger. Filter by status, date range, or dispute state. Open any row to
          see the GPS check-in, completed tasks, and the dispute thread — and to issue a refund
          where it&apos;s warranted.
        </p>
      </div>

      {/* Filter toolbar */}
      <section
        aria-label="Search & filters"
        className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by family or caregiver name, email…"
            aria-label="Search bookings"
            className="h-11 w-full rounded-lg border border-input bg-background pr-4 pl-10 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Status
            </p>
            <SlideTabs
              ariaLabel="Booking status"
              value={filters.status}
              options={STATUS_TABS}
              onChange={onStatusChange}
              tabWidthClass="w-[84px]"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Disputes
            </p>
            <button
              type="button"
              onClick={onDisputeToggle}
              aria-pressed={filters.hasDispute}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors",
                filters.hasDispute
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <ShieldAlert className="size-3.5" strokeWidth={2.25} />
              Open disputes only
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="bookings-from"
                className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
              >
                From
              </label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger
                  id="bookings-from"
                  className={cn(
                    DATE_INPUT_CLASS,
                    "flex min-w-[150px] cursor-pointer items-center justify-between gap-2 data-[popup-open]:border-ring",
                  )}
                >
                  <span className={cn(!filters.from && "text-muted-foreground")}>
                    {filters.from ? format(parseISO(filters.from), "MMM d, yyyy") : "Any date"}
                  </span>
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto">
                  <Calendar
                    value={filters.from ? parseISO(filters.from) : null}
                    toYear={CALENDAR_TO_YEAR}
                    onSelect={(date) => {
                      onFromChange(format(date, "yyyy-MM-dd"));
                      setFromOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="bookings-to"
                className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
              >
                To
              </label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger
                  id="bookings-to"
                  className={cn(
                    DATE_INPUT_CLASS,
                    "flex min-w-[150px] cursor-pointer items-center justify-between gap-2 data-[popup-open]:border-ring",
                  )}
                >
                  <span className={cn(!filters.to && "text-muted-foreground")}>
                    {filters.to ? format(parseISO(filters.to), "MMM d, yyyy") : "Any date"}
                  </span>
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto">
                  <Calendar
                    value={filters.to ? parseISO(filters.to) : null}
                    toYear={CALENDAR_TO_YEAR}
                    onSelect={(date) => {
                      onToChange(format(date, "yyyy-MM-dd"));
                      setToOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {(filters.from || filters.to) && (
              <button
                type="button"
                onClick={onDatesReset}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" strokeWidth={2.25} />
                Reset
              </button>
            )}
          </div>

          <div className="ml-auto">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="cursor-pointer"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} strokeWidth={2} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-6 mb-3 flex items-center justify-between gap-3">
        <ResultMeta total={total} state={state} filters={filters} />
        <ViewSwitcher view={view} onChange={onViewChange} />
      </div>

      <div>
        {state === "loading" && !resp && <LoadingView view={view} />}
        {state === "error" && <ErrorCard onRetry={retry} />}
        {state !== "error" && resp && (
          <>
            {hasResults ? (
              view === "table" ? (
                <BookingTable rows={resp.data} />
              ) : (
                <BookingList rows={resp.data} />
              )
            ) : (
              <EmptyState filters={filters} />
            )}
            {view === "table" && hasResults && lastPage > 1 && (
              <Pagination page={page} lastPage={lastPage} onChange={onPageChange} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Result meta
 * ───────────────────────────────────────────────────────────── */

function ResultMeta({
  total,
  state,
  filters,
}: {
  total: number;
  state: LoadState;
  filters: FilterState;
}) {
  const hasFilters =
    filters.q.trim() !== "" ||
    filters.status !== "" ||
    filters.hasDispute ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="flex items-center gap-2 text-sm">
      {state === "loading" ? (
        <span className="text-muted-foreground">Searching…</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-muted-foreground">
            {total === 1 ? "booking" : "bookings"}
            {hasFilters && " · filtered"}
          </span>
        </>
      )}
    </div>
  );
}

function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { value: "grid", label: "Grid view", icon: LayoutGrid },
    { value: "table", label: "Table view", icon: TableIcon },
  ];
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex shrink-0 gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {options.map((o) => {
        const Icon = o.icon;
        const active = view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-label={o.label}
            aria-pressed={active}
            title={o.label}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-lg transition-colors",
              active
                ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

function BookingActionsMenu({ bookingId }: { bookingId: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Booking actions"
        className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-32">
        <DropdownMenuItem
          render={<Link href={`/admin/bookings/${bookingId}`} />}
          className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
        >
          <Eye className="size-4 text-muted-foreground" />
          View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────────────────────────────────────────
 * List + premium rows
 * ───────────────────────────────────────────────────────────── */

const TILE_TONES: Record<StatusTone, string> = {
  good: "bg-success/10 text-success",
  alarm: "bg-accent/10 text-accent",
  warn: "bg-foreground/10 text-foreground/70",
  neutral: "bg-primary/10 text-primary",
};

// Role-tinted gradient for the card header band, keyed off status tone.
const HEADER_TONES: Record<StatusTone, string> = {
  good: "from-success/15 via-success/5",
  alarm: "from-accent/15 via-accent/5",
  warn: "from-foreground/10 via-foreground/5",
  neutral: "from-primary/15 via-primary/5",
};

function BookingList({ rows }: { rows: BookingCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((b) => (
        <BookingCardTile key={b.id} booking={b} />
      ))}
    </div>
  );
}

function BookingCardTile({ booking }: { booking: BookingCard }) {
  const tone = statusTone(booking.status);
  const pTone = paymentTone(booking.payment_status);
  const inAlarm = pTone === "alarm" || booking.flagged_at !== null;
  const start = booking.scheduled_start ? new Date(booking.scheduled_start) : null;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(10,14,40,0.28)]",
        inAlarm
          ? "border-accent/40 hover:border-accent/60"
          : "border-border hover:border-primary/30",
      )}
    >
      {/* Header band — gradient keyed off status tone */}
      <div
        className={cn(
          "relative h-20 w-full overflow-hidden bg-gradient-to-br to-transparent",
          HEADER_TONES[tone],
        )}
      >
        <div className="absolute top-2.5 right-2.5">
          <BookingActionsMenu bookingId={booking.id} />
        </div>
      </div>

      {/* Icon tile overlapping the band */}
      <div className="px-4">
        <Link href={`/admin/bookings/${booking.id}`} aria-label={`View booking #${booking.id}`}>
          <span
            className={cn(
              "-mt-9 grid size-16 place-items-center rounded-2xl ring-4 ring-card transition-transform group-hover:scale-[1.03]",
              TILE_TONES[tone],
            )}
          >
            <CalendarDays className="size-7" strokeWidth={2} />
          </span>
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
        <Link
          href={`/admin/bookings/${booking.id}`}
          className="inline-flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          <span className="truncate">{booking.family?.name ?? "Family ?"}</span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50" strokeWidth={2} />
          <span className="truncate">{booking.caregiver?.name ?? "Caregiver ?"}</span>
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill status={booking.status} tone={tone} />
          <PaymentPill payment={booking.payment_status} tone={pTone} />
          {booking.flagged_at && <FlagPill />}
        </div>

        <div className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
          {start && (
            <p className="flex items-center gap-2 tabular-nums">
              <CalendarDays
                className="size-3.5 shrink-0 text-muted-foreground/70"
                strokeWidth={2}
              />
              {start.toLocaleString("en-CA", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="flex items-center gap-2 tabular-nums">
            <TimerReset className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={2} />
            {booking.duration_minutes} min
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
            #{String(booking.id).padStart(5, "0")}
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatDollars(booking.subtotal_cents)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Table view — striped + hover
 * ───────────────────────────────────────────────────────────── */

function BookingTable({ rows }: { rows: BookingCard[] }) {
  const th = "px-4 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className={cn(th, "pl-5")}>Booking</th>
              <th className={th}>Status</th>
              <th className={th}>Payment</th>
              <th className={th}>When</th>
              <th className={cn(th, "text-right")}>Amount</th>
              <th className={cn(th, "pr-5")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <BookingTableRow key={b.id} booking={b} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingTableRow({ booking }: { booking: BookingCard }) {
  const tone = statusTone(booking.status);
  const pTone = paymentTone(booking.payment_status);
  const start = booking.scheduled_start ? new Date(booking.scheduled_start) : null;

  return (
    <tr className="border-b border-border/60 align-middle transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      <td className="px-4 py-3 pl-5">
        <Link href={`/admin/bookings/${booking.id}`} className="group flex items-center gap-3">
          <span
            className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TILE_TONES[tone])}
          >
            <CalendarDays className="size-4" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-primary">
              <span className="truncate">{booking.family?.name ?? "Family ?"}</span>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/50" strokeWidth={2} />
              <span className="truncate">{booking.caregiver?.name ?? "Caregiver ?"}</span>
              {booking.flagged_at && (
                <Flag className="size-3 shrink-0 text-accent" strokeWidth={2.25} />
              )}
            </span>
            <span className="block text-xs tabular-nums text-muted-foreground/70">
              #{String(booking.id).padStart(5, "0")} · {booking.duration_minutes} min
            </span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <StatusPill status={booking.status} tone={tone} />
      </td>
      <td className="px-4 py-3">
        <PaymentPill payment={booking.payment_status} tone={pTone} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
        {start
          ? start.toLocaleString("en-CA", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "—"}
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
        {formatDollars(booking.subtotal_cents)}
      </td>
      <td className="px-4 py-3 pr-5 text-right">
        <BookingActionsMenu bookingId={booking.id} />
      </td>
    </tr>
  );
}

function StatusPill({ status, tone }: { status: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-success/10 text-success",
        tone === "alarm" && "bg-accent/10 text-accent",
        tone === "warn" && "bg-foreground/10 text-foreground/70",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function PaymentPill({ payment, tone }: { payment: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "alarm" && "bg-accent/10 text-accent",
        tone === "good" && "bg-success/10 text-success",
        tone === "warn" && "bg-foreground/10 text-foreground/70",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {paymentStatusLabel(payment)}
    </span>
  );
}

function FlagPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
      <Flag className="size-3" strokeWidth={2.25} />
      Flagged
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Pagination + states
 * ───────────────────────────────────────────────────────────── */

function Pagination({
  page,
  lastPage,
  onChange,
}: {
  page: number;
  lastPage: number;
  onChange: (next: number) => void;
}) {
  const canPrev = page > 1;
  const canNext = page < lastPage;
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      <button
        type="button"
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          canPrev ? "cursor-pointer text-foreground hover:bg-muted" : "text-muted-foreground/40",
        )}
      >
        <ChevronLeft className="size-4" strokeWidth={2} />
        Prev
      </button>
      <p className="text-sm text-muted-foreground tabular-nums">
        Page <span className="font-semibold text-foreground">{page}</span> of {lastPage}
      </p>
      <button
        type="button"
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
          canNext ? "cursor-pointer text-foreground hover:bg-muted" : "text-muted-foreground/40",
        )}
      >
        Next
        <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </nav>
  );
}

function EmptyState({ filters }: { filters: FilterState }) {
  const hasFilters =
    filters.q.trim() !== "" ||
    filters.status !== "" ||
    filters.hasDispute ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <CalendarDays className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        {hasFilters ? "Nothing matches that slice." : "No bookings yet."}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {hasFilters
          ? "Try widening the date range or clearing a filter."
          : "Once families and caregivers start booking, this is where they'll show up."}
      </p>
    </div>
  );
}

function LoadingView({ view }: { view: ViewMode }) {
  if (view === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/60 px-5 py-4 last:border-0"
          >
            <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-20 w-full animate-pulse bg-muted" />
          <div className="px-4">
            <div className="-mt-9 size-16 animate-pulse rounded-2xl bg-muted ring-4 ring-card" />
          </div>
          <div className="space-y-2 px-4 pt-3 pb-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load the ledger.
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again.
      </p>
      <Button onClick={onRetry} size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}
