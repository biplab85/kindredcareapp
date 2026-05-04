"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldOff,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type AdminUserCard,
  type AdminUserListQuery,
  type AdminUserListResponse,
  type AdminUserRole,
  type AdminUserStatus,
  getAdminUsers,
  roleLabel,
} from "@/lib/admin-users";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminUsersPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Users">
        <UsersView />
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
  role: AdminUserRole | "all";
  status: AdminUserStatus | "all";
}

const ROLE_OPTIONS: Array<{ value: AdminUserRole | "all"; label: string }> = [
  { value: "all", label: "Any role" },
  { value: "family", label: "Family" },
  { value: "caregiver", label: "Caregiver" },
  { value: "admin", label: "Admin" },
];

const STATUS_OPTIONS: Array<{ value: AdminUserStatus | "all"; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

function UsersView() {
  // Controlled inputs. Like /admin/revenue, all reloads are explicit.
  const [filters, setFilters] = useState<FilterState>({ q: "", role: "all", status: "all" });
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [resp, setResp] = useState<AdminUserListResponse | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildQuery = useCallback(
    (f: FilterState, p: number): AdminUserListQuery => ({
      q: f.q.trim() || undefined,
      role: f.role === "all" ? undefined : f.role,
      status: f.status === "all" ? undefined : f.status,
      page: p,
      per_page: 25,
    }),
    [],
  );

  const reload = useCallback(
    async (f: FilterState, p: number) => {
      setState("loading");
      try {
        const data = await getAdminUsers(buildQuery(f, p));
        setResp(data);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [buildQuery],
  );

  // Mount-only fetch.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAdminUsers(buildQuery(filters, page));
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

  function onRoleChange(next: AdminUserRole | "all") {
    const f = { ...filters, role: next };
    setFilters(f);
    setPage(1);
    void reload(f, 1);
  }

  function onStatusChange(next: AdminUserStatus | "all") {
    const f = { ...filters, status: next };
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
      {/* Paper wash */}
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
        <FilterBar
          role={filters.role}
          status={filters.status}
          onRoleChange={onRoleChange}
          onStatusChange={onStatusChange}
          onRefresh={retry}
        />

        <ResultMeta total={total} state={state} filters={filters} />

        <div className="mt-6">
          {state === "loading" && !resp && <LoadingView />}
          {state === "error" && <ErrorCard onRetry={retry} />}
          {state !== "error" && resp && (
            <>
              {hasResults ? <UserList rows={resp.data} /> : <EmptyState filters={filters} />}
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
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Users
        <span className="text-foreground/30">— § 22</span>
      </div>

      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">Search the bench,</span> open a record.
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Free-text search across name, email, phone, and ID. Role and status filters narrow the
        slice. Suspended caregivers drop out of matching the moment the kill-switch flips.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Search bar — large, mono input. The headline action of the page.
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
          placeholder="Name, email, phone, or ID…"
          aria-label="Search users"
          className="w-full bg-transparent py-4 pr-5 pl-12 font-mono text-sm tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Filter bar — role + status pills.
 * ───────────────────────────────────────────────────────────── */

function FilterBar({
  role,
  status,
  onRoleChange,
  onStatusChange,
  onRefresh,
}: {
  role: AdminUserRole | "all";
  status: AdminUserStatus | "all";
  onRoleChange: (r: AdminUserRole | "all") => void;
  onStatusChange: (s: AdminUserStatus | "all") => void;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Filters"
      className="mt-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end gap-6">
        <FilterPills
          label="Role"
          value={role}
          options={ROLE_OPTIONS}
          onChange={(v) => onRoleChange(v as AdminUserRole | "all")}
        />
        <FilterPills
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(v) => onStatusChange(v as AdminUserStatus | "all")}
        />
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

function FilterPills<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (v: V) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-2 inline-flex flex-wrap rounded-full border border-border/70 bg-background p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={opt.value === value}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors",
              opt.value === value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Result meta strip
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
  const hasFilters = filters.q.trim() !== "" || filters.role !== "all" || filters.status !== "all";

  return (
    <div className="mt-8 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-8 bg-foreground/30" />
      <span>
        {state === "loading" ? (
          "Searching…"
        ) : (
          <>
            <span className="font-mono tabular-nums text-foreground/80">{total}</span>{" "}
            {total === 1 ? "match" : "matches"}
            {hasFilters && <span className="text-foreground/40"> · filtered</span>}
          </>
        )}
      </span>
      <span className="text-foreground/30">— § 23</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Results list — ticket-stub rows
 * ───────────────────────────────────────────────────────────── */

function UserList({ rows }: { rows: AdminUserCard[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((u) => (
        <li key={u.id}>
          <UserRow user={u} />
        </li>
      ))}
    </ul>
  );
}

function UserRow({ user }: { user: AdminUserCard }) {
  const isSuspended = user.status === "suspended";
  const isCaregiver = user.role === "caregiver";

  return (
    <Link
      href={`/admin/users/${user.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card transition-all",
        isSuspended
          ? "border-accent/40 bg-accent/[0.02] hover:border-accent/60"
          : "border-border/60 hover:border-foreground/30",
      )}
    >
      {/* Perforated left edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="flex items-center gap-4 py-4 pr-5 pl-9 sm:py-5 sm:pl-10">
        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3
              className={cn(
                "text-base font-semibold tracking-tight sm:text-lg",
                user.status === "deleted" && "text-muted-foreground line-through",
              )}
            >
              {user.name}
            </h3>
            <RolePill role={user.role} />
            <StatusPill status={user.status} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            <span className="font-mono tabular-nums text-foreground/60">
              ID {String(user.id).padStart(5, "0")}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1.5 normal-case tracking-[0.05em]">
              <Mail className="size-3" strokeWidth={2} />
              <span className="text-foreground/70">{user.email}</span>
            </span>
            {user.phone && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1.5 normal-case tracking-[0.05em]">
                  <Phone className="size-3" strokeWidth={2} />
                  <span className="font-mono text-foreground/70 tabular-nums">{user.phone}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right rail: verification counter + chevron */}
        <div className="flex shrink-0 items-center gap-4">
          {isCaregiver && <VerificationCounter user={user} />}
          <ArrowRight
            className="size-4 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
            strokeWidth={2}
          />
        </div>
      </div>
    </Link>
  );
}

function RolePill({ role }: { role: AdminUserRole }) {
  const styles: Record<AdminUserRole, string> = {
    family: "border-primary/30 bg-primary/[0.06] text-primary",
    caregiver: "border-success/40 bg-success/[0.07] text-success",
    admin: "border-foreground/30 bg-foreground/[0.06] text-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        styles[role],
      )}
    >
      {roleLabel(role)}
    </span>
  );
}

function StatusPill({ status }: { status: AdminUserStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        Active
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-accent-foreground uppercase">
        <ShieldOff className="size-2.5" strokeWidth={2.25} />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/60 uppercase">
      <UserMinus className="size-2.5" strokeWidth={2.25} />
      Deleted
    </span>
  );
}

function VerificationCounter({ user }: { user: AdminUserCard }) {
  const cleared = user.cleared_checks;
  const total = user.total_checks;
  const fully = cleared >= total && total > 0;

  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-lg border px-3 py-1.5 sm:inline-flex",
        fully ? "border-success/40 bg-success/[0.07]" : "border-border/70 bg-background",
      )}
      title={fully ? "Fully verified" : `Cleared ${cleared} of ${total} checks`}
    >
      <BadgeCheck
        className={cn("size-3.5", fully ? "text-success" : "text-muted-foreground/60")}
        strokeWidth={2}
      />
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          fully ? "text-success" : "text-muted-foreground",
        )}
      >
        {cleared}/{total}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Pagination
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

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function EmptyState({ filters }: { filters: FilterState }) {
  const hasFilters = filters.q.trim() !== "" || filters.role !== "all" || filters.status !== "all";

  return (
    <section className="rounded-3xl border border-dashed border-border/70 bg-background/50 p-10 text-center sm:p-14">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <UsersRound className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">
        {hasFilters ? (
          <>
            No matches{" "}
            <span className="font-normal italic text-muted-foreground">in this slice.</span>
          </>
        ) : (
          <>
            Nobody on the books{" "}
            <span className="font-normal italic text-muted-foreground">yet.</span>
          </>
        )}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {hasFilters
          ? "Try a looser search or clear a filter — the roster might be quieter than you expected."
          : "Once families and caregivers sign up, they'll appear here."}
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
          <h3 className="text-base font-semibold tracking-tight">Couldn&apos;t load the roster.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again — and if it keeps failing, ping the engineering
            channel.
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
