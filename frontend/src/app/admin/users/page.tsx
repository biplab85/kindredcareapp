"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  Mail,
  MoreVertical,
  Phone,
  RefreshCw,
  Search,
  ShieldOff,
  Table as TableIcon,
  UserMinus,
  UsersRound,
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
type ViewMode = "grid" | "table";

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
  const [view, setView] = useState<ViewMode>("grid");
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
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
          Users
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Search across name, email, phone, and ID, then filter by role and status. Suspended
          caregivers drop out of matching the moment the kill-switch flips.
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
            placeholder="Search by name, email, phone, or ID…"
            aria-label="Search users"
            className="h-11 w-full rounded-lg border border-input bg-background pr-4 pl-10 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Role
            </p>
            <SlideTabs
              ariaLabel="Role"
              value={filters.role}
              options={ROLE_OPTIONS}
              onChange={onRoleChange}
              tabWidthClass="w-[88px]"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Status
            </p>
            <SlideTabs
              ariaLabel="Status"
              value={filters.status}
              options={STATUS_OPTIONS}
              onChange={onStatusChange}
              tabWidthClass="w-[92px]"
            />
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
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      <div>
        {state === "loading" && !resp && <LoadingView view={view} />}
        {state === "error" && <ErrorCard onRetry={retry} />}
        {state !== "error" && resp && (
          <>
            {hasResults ? (
              view === "table" ? (
                <UserTable rows={resp.data} />
              ) : (
                <UserList rows={resp.data} />
              )
            ) : (
              <EmptyState filters={filters} />
            )}
            {hasResults && lastPage > 1 && (
              <Pagination page={page} lastPage={lastPage} onChange={onPageChange} />
            )}
          </>
        )}
      </div>
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

function UserActionsMenu({ userId }: { userId: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User actions"
        className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-32">
        <DropdownMenuItem
          render={<Link href={`/admin/users/${userId}`} />}
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
    <div className="flex items-center gap-2 text-sm">
      {state === "loading" ? (
        <span className="text-muted-foreground">Searching…</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-muted-foreground">
            {total === 1 ? "user" : "users"}
            {hasFilters && " · filtered"}
          </span>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Results list — premium cards with avatars
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

function UserTable({ rows }: { rows: AdminUserCard[] }) {
  const th = "px-4 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className={cn(th, "pl-5")}>User</th>
              <th className={th}>Role</th>
              <th className={th}>Status</th>
              <th className={th}>Contact</th>
              <th className={th}>Checks</th>
              <th className={cn(th, "pr-5")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <UserTableRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserTableRow({ user }: { user: AdminUserCard }) {
  const isDeleted = user.status === "deleted";
  const isCaregiver = user.role === "caregiver";

  return (
    <tr className="border-b border-border/60 align-middle transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      <td className="px-4 py-3 pl-5">
        <Link href={`/admin/users/${user.id}`} className="group flex items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
              isDeleted ? "bg-muted text-muted-foreground" : AVATAR_TONES[user.role],
            )}
          >
            {initialsOf(user.name)}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-semibold text-foreground group-hover:text-primary",
                isDeleted && "text-muted-foreground line-through",
              )}
            >
              {user.name}
            </span>
            <span className="block text-xs tabular-nums text-muted-foreground/70">
              #{String(user.id).padStart(5, "0")}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <RolePill role={user.role} />
      </td>
      <td className="px-4 py-3">
        <StatusPill status={user.status} />
      </td>
      <td className="px-4 py-3">
        <div className="text-[13px] text-foreground/80">{user.email}</div>
        {user.phone && (
          <div className="text-xs tabular-nums text-muted-foreground">{user.phone}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {isCaregiver ? (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {user.cleared_checks}/{user.total_checks}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-4 py-3 pr-5 text-right">
        <UserActionsMenu userId={user.id} />
      </td>
    </tr>
  );
}

const AVATAR_TONES: Record<AdminUserRole, string> = {
  family: "bg-primary/10 text-primary",
  caregiver: "bg-success/10 text-success",
  admin: "bg-foreground/10 text-foreground/80",
};

function UserRow({ user }: { user: AdminUserCard }) {
  const isSuspended = user.status === "suspended";
  const isCaregiver = user.role === "caregiver";
  const isDeleted = user.status === "deleted";

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-16px_rgba(10,14,40,0.22)]",
        isSuspended
          ? "border-accent/40 bg-accent/[0.03] hover:border-accent/60"
          : "border-border hover:border-primary/30",
      )}
    >
      {/* Identity (links to the detail record) */}
      <Link href={`/admin/users/${user.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold",
            isDeleted ? "bg-muted text-muted-foreground" : AVATAR_TONES[user.role],
          )}
        >
          {initialsOf(user.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h3
              className={cn(
                "text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary",
                isDeleted && "text-muted-foreground line-through",
              )}
            >
              {user.name}
            </h3>
            <RolePill role={user.role} />
            <StatusPill status={user.status} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-medium tabular-nums text-muted-foreground/70">
              #{String(user.id).padStart(5, "0")}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
              {user.email}
            </span>
            {user.phone && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Phone className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
                  {user.phone}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Right rail: verification counter + actions */}
      <div className="flex shrink-0 items-center gap-3">
        {isCaregiver && <VerificationCounter user={user} />}
        <UserActionsMenu userId={user.id} />
      </div>
    </div>
  );
}

function RolePill({ role }: { role: AdminUserRole }) {
  const styles: Record<AdminUserRole, string> = {
    family: "bg-primary/10 text-primary",
    caregiver: "bg-success/10 text-success",
    admin: "bg-foreground/10 text-foreground/80",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        Active
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20">
        <ShieldOff className="size-3" strokeWidth={2.25} />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/60 ring-1 ring-foreground/15">
      <UserMinus className="size-3" strokeWidth={2.25} />
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
        "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 sm:inline-flex",
        fully ? "border-success/40 bg-success/[0.07]" : "border-border bg-muted/40",
      )}
      title={fully ? "Fully verified" : `Cleared ${cleared} of ${total} checks`}
    >
      <BadgeCheck
        className={cn("size-4", fully ? "text-success" : "text-muted-foreground/60")}
        strokeWidth={2}
      />
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
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

/* ─────────────────────────────────────────────────────────────
 * Empty / loading / error states
 * ───────────────────────────────────────────────────────────── */

function EmptyState({ filters }: { filters: FilterState }) {
  const hasFilters = filters.q.trim() !== "" || filters.role !== "all" || filters.status !== "all";

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <UsersRound className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        {hasFilters ? "No matches in this slice." : "Nobody on the books yet."}
      </h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {hasFilters
          ? "Try a looser search or clear a filter — the roster might be quieter than you expected."
          : "Once families and caregivers sign up, they'll appear here."}
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
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load the roster.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again — and if it keeps failing, ping the engineering
        channel.
      </p>
      <Button onClick={onRetry} size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ───────────────────────────────────────────────────────────── */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
