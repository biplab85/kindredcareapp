"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  RefreshCw,
  Search,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
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

function BookingsView() {
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    status: "",
    hasDispute: false,
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [resp, setResp] = useState<BookingListResponse | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildQuery = useCallback(
    (f: FilterState, p: number): BookingListQuery => ({
      q: f.q.trim() || undefined,
      status: f.status || undefined,
      has_dispute: f.hasDispute || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
      page: p,
      per_page: 25,
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

  function onPageChange(next: number) {
    setPage(next);
    void reload(filters, next);
  }

  function retry() {
    void reload(filters, page);
  }

  const total = resp?.meta.total ?? 0;
  const lastPage = resp?.meta.last_page ?? 1;
  const hasResults = (resp?.data.length ?? 0) > 0;

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Header />

        <SearchBar value={filters.q} onChange={onSearchChange} />

        <Controls
          filters={filters}
          onStatusChange={onStatusChange}
          onDisputeToggle={onDisputeToggle}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onRefresh={retry}
        />

        <ResultMeta total={total} state={state} filters={filters} />

        <div className="mt-6">
          {state === "loading" && !resp && <LoadingView />}
          {state === "error" && <ErrorCard onRetry={retry} />}
          {state !== "error" && resp && (
            <>
              {hasResults ? <BookingList rows={resp.data} /> : <EmptyState filters={filters} />}
              {hasResults && lastPage > 1 && (
                <Pagination page={page} lastPage={lastPage} onChange={onPageChange} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header>
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">Every visit,</span> on the record.
      </h1>

      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Browse the full booking ledger. Filter by status, date range, or dispute state. Open any row
        to see the GPS check-in, completed tasks, and the dispute thread — and to issue a refund
        where it&apos;s warranted.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Search bar
 * ───────────────────────────────────────────────────────────── */

function SearchBar({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <section aria-label="Search" className="mt-8">
      <div className="relative rounded-2xl border border-border/70 bg-card shadow-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Family or caregiver name, email…"
          aria-label="Search bookings"
          className="w-full bg-transparent py-4 pr-5 pl-12 font-mono text-sm tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls
 * ───────────────────────────────────────────────────────────── */

function Controls({
  filters,
  onStatusChange,
  onDisputeToggle,
  onFromChange,
  onToChange,
  onRefresh,
}: {
  filters: FilterState;
  onStatusChange: (s: string) => void;
  onDisputeToggle: () => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Filters"
      className="mt-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Status
          </p>
          <div className="mt-2 inline-flex flex-wrap rounded-full border border-border/70 bg-background p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value || "any"}
                type="button"
                onClick={() => onStatusChange(t.value)}
                aria-pressed={t.value === filters.status}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
                  t.value === filters.status
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Disputes
          </p>
          <button
            type="button"
            onClick={onDisputeToggle}
            aria-pressed={filters.hasDispute}
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
              filters.hasDispute
                ? "border-accent/40 bg-accent text-accent-foreground"
                : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldAlert className="size-3" strokeWidth={2.25} />
            Open disputes only
          </button>
        </div>

        <div>
          <label
            htmlFor="bookings-from"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            From
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <input
              id="bookings-from"
              type="date"
              value={filters.from}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-36 bg-transparent font-mono text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="bookings-to"
            className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
          >
            To
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <input
              id="bookings-to"
              type="date"
              value={filters.to}
              onChange={(e) => onToChange(e.target.value)}
              className="w-36 bg-transparent font-mono text-xs tabular-nums outline-none"
            />
          </div>
        </div>

        <div className="ml-auto">
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Refresh
          </Button>
        </div>
      </div>
    </section>
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
    <div className="mt-8 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-8 bg-foreground/30" />
      <span>
        {state === "loading" ? (
          "Searching…"
        ) : (
          <>
            <span className="font-mono tabular-nums text-foreground/80">{total}</span> booking
            {total === 1 ? "" : "s"}
            {hasFilters && <span className="text-foreground/40"> · filtered</span>}
          </>
        )}
      </span>
      <span className="text-foreground/30">— § 37</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * List + ticket-stub rows
 * ───────────────────────────────────────────────────────────── */

function BookingList({ rows }: { rows: BookingCard[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((b) => (
        <li key={b.id}>
          <BookingRow booking={b} />
        </li>
      ))}
    </ul>
  );
}

function BookingRow({ booking }: { booking: BookingCard }) {
  const tone = statusTone(booking.status);
  const pTone = paymentTone(booking.payment_status);
  const inAlarm = pTone === "alarm" || booking.flagged_at !== null;
  const start = booking.scheduled_start ? new Date(booking.scheduled_start) : null;

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card transition-all",
        inAlarm
          ? "border-accent/40 bg-accent/[0.02] hover:border-accent/60"
          : "border-border/60 hover:border-foreground/30",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="flex items-center gap-4 py-4 pr-5 pl-9 sm:py-5 sm:pl-10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">
              <span className="text-foreground/60 font-mono tabular-nums">
                #{String(booking.id).padStart(5, "0")}
              </span>{" "}
              · {booking.family?.name ?? "Family ?"}
              {" → "}
              {booking.caregiver?.name ?? "Caregiver ?"}
            </h3>
            <StatusPill status={booking.status} tone={tone} />
            <PaymentPill payment={booking.payment_status} tone={pTone} />
            {booking.flagged_at && <FlagPill />}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            {start && (
              <span className="inline-flex items-center gap-1.5 font-mono normal-case tracking-[0.05em] tabular-nums">
                <CalendarDays className="size-3" strokeWidth={2} />
                {start.toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1 font-mono normal-case tracking-[0.05em] tabular-nums">
              <TimerReset className="size-3" strokeWidth={2} />
              {booking.duration_minutes} min
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="font-mono tabular-nums text-foreground/80">
              {formatDollars(booking.subtotal_cents)}
            </span>
          </div>
        </div>

        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}

function StatusPill({ status, tone }: { status: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        tone === "good" && "border border-success/40 bg-success/[0.07] text-success",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "warn" && "border border-foreground/25 bg-foreground/5 text-foreground/70",
        tone === "neutral" && "border border-border/70 bg-background text-muted-foreground",
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
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "good" && "border border-success/40 bg-success/[0.07] text-success",
        tone === "warn" && "border border-foreground/25 bg-foreground/5 text-foreground/70",
        tone === "neutral" && "border border-border/70 bg-background text-muted-foreground",
      )}
    >
      {paymentStatusLabel(payment)}
    </span>
  );
}

function FlagPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
      <Flag className="size-2.5" strokeWidth={2.25} />
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
      className="mt-8 flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3"
    >
      <button
        type="button"
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors",
          canPrev ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
        )}
      >
        <ChevronLeft className="size-3.5" strokeWidth={2} />
        Prev
      </button>
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
        Page <span className="text-foreground">{page}</span> of {lastPage}
      </p>
      <button
        type="button"
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors",
          canNext ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
        )}
      >
        Next
        <ChevronRight className="size-3.5" strokeWidth={2} />
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
    <section className="rounded-3xl border border-dashed border-border/70 bg-background/50 p-10 text-center sm:p-14">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <CalendarDays className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        {hasFilters ? (
          <>
            Nothing matches{" "}
            <span className="font-normal italic text-muted-foreground">that slice.</span>
          </>
        ) : (
          <>
            No bookings <span className="font-normal italic text-muted-foreground">yet.</span>
          </>
        )}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {hasFilters
          ? "Try widening the date range or clearing a filter."
          : "Once families and caregivers start booking, this is where they'll show up."}
      </p>
    </section>
  );
}

function LoadingView() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="h-[88px] animate-pulse rounded-2xl border border-border/60 bg-card/60"
        />
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-accent/[0.04] p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
          <AlertCircle className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight">Couldn&apos;t load the ledger.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again.
          </p>
          <div className="mt-4">
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="size-3.5" strokeWidth={2} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
