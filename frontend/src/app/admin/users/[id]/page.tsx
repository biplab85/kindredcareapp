"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Loader2,
  type LucideIcon,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  ShieldX,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type AdminUserDetail,
  type AdminUserRole,
  type AdminUserStatus,
  type BookingTally,
  deleteUser,
  getAdminUser,
  reactivateUser,
  roleLabel,
  suspendUser,
  type VerificationRecordSummary,
} from "@/lib/admin-users";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminUserDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="User detail">
        <UserDetailView id={id} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

const AVATAR_TONES: Record<AdminUserRole, string> = {
  family: "bg-primary/10 text-primary",
  caregiver: "bg-success/10 text-success",
  admin: "bg-foreground/10 text-foreground/80",
};

function UserDetailView({ id }: { id: string }) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const reload = useCallback(async () => {
    setState("loading");
    try {
      const data = await getAdminUser(id);
      setUser(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getAdminUser(id);
        if (!alive) return;
        setUser(data);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href="/admin/users"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to users
      </Link>

      {state === "loading" && <DetailSkeleton />}
      {state === "error" && <ErrorCard onRetry={reload} />}
      {state === "ready" && user && <UserDetailBody user={user} onMutated={reload} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Detail body
 * ───────────────────────────────────────────────────────────── */

function UserDetailBody({ user, onMutated }: { user: AdminUserDetail; onMutated: () => void }) {
  return (
    <div className="space-y-6">
      <ProfileHeader user={user} />
      <ActionPanel user={user} onMutated={onMutated} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VerificationPanel records={user.verification_records} />
        <RatingsPanel ratings={user.ratings} />
      </div>

      <BookingsPanel bookings={user.bookings} role={user.role} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Profile header — hero card
 * ───────────────────────────────────────────────────────────── */

function ProfileHeader({ user }: { user: AdminUserDetail }) {
  const isDeleted = user.status === "deleted";

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      {/* Cover band */}
      <div className="relative h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/10 sm:h-24">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(10,14,40,0.05) 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="mt-[-67px] flex flex-col gap-4 sm:flex-row sm:items-end">
          <span
            className={cn(
              "grid size-20 shrink-0 place-items-center rounded-2xl text-2xl font-bold ring-4 ring-card sm:size-24",
              isDeleted ? "bg-muted text-muted-foreground" : AVATAR_TONES[user.role],
            )}
          >
            {initialsOf(user.name)}
          </span>

          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={cn(
                  "text-2xl font-bold tracking-tight text-foreground",
                  isDeleted && "text-muted-foreground line-through",
                )}
              >
                {user.name}
              </h1>
              <span className="text-sm font-medium tabular-nums text-muted-foreground/70">
                #{String(user.id).padStart(5, "0")}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <RolePill role={user.role} />
              <StatusPill status={user.status} />
              {user.email_verified_at && <VerifiedPill label="Email verified" />}
              {user.phone_verified_at && <VerifiedPill label="Phone verified" />}
            </div>
          </div>
        </div>

        {/* Contact detail grid */}
        <div className="mt-6 grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailTile icon={Mail} label="Email" value={user.email} />
          {user.phone && <DetailTile icon={Phone} label="Phone" value={user.phone} />}
          {user.date_of_birth && (
            <DetailTile icon={CalendarRange} label="Date of birth" value={user.date_of_birth} />
          )}
          {user.gender && (
            <DetailTile icon={ClipboardList} label="Gender" value={user.gender} capitalize />
          )}
          {user.created_at && (
            <DetailTile
              icon={CalendarRange}
              label="Member since"
              value={formatDate(user.created_at)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function VerifiedPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
      <BadgeCheck className="size-3" strokeWidth={2.25} />
      {label}
    </span>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-sm font-medium text-foreground",
            capitalize && "capitalize",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Card primitive
 * ───────────────────────────────────────────────────────────── */

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="grow p-5">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Action panel — suspend / reactivate / delete
 * ───────────────────────────────────────────────────────────── */

const TEXTAREA_CLASS =
  "mt-2 min-h-[80px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50";

function ActionPanel({ user, onMutated }: { user: AdminUserDetail; onMutated: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (deleteReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    setDeleting(true);
    try {
      await deleteUser(user.id, deleteReason.trim());
      toast.success(`${user.name} permanently anonymized.`);
      router.push("/admin/users");
    } catch {
      toast.error("Couldn't delete. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (user.status === "deleted") {
    return (
      <section className="flex items-start gap-3.5 rounded-xl border border-border bg-muted/30 p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground/70">
          <Trash2 className="size-5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Account state
          </p>
          <p className="mt-1 text-sm text-foreground/80">
            This account is marked deleted. Reactivation requires the Phase 15 compliance flow.
          </p>
        </div>
      </section>
    );
  }

  async function onSuspend() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    setBusy(true);
    try {
      await suspendUser(user.id, reason.trim());
      toast.success(`${user.name} suspended.`);
      setReason("");
      onMutated();
    } catch {
      toast.error("Couldn't suspend. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onReactivate() {
    setBusy(true);
    try {
      await reactivateUser(user.id);
      toast.success(`${user.name} reactivated.`);
      onMutated();
    } catch {
      toast.error("Couldn't reactivate. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (user.status === "suspended") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-success/40 bg-success/[0.04] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
          <div className="flex items-start gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <ShieldCheck className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-success uppercase">
                Reactivation
              </p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                Bring them back into the marketplace.
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Caregivers re-enter matching immediately. Families regain booking access.
              </p>
              <div className="mt-4">
                <Button onClick={onReactivate} disabled={busy} size="sm" className="cursor-pointer">
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <ShieldCheck className="size-3.5" strokeWidth={2} />
                  )}
                  Reactivate account
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-destructive/40 bg-destructive/[0.04] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
          <div className="flex items-start gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <Trash2 className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-destructive uppercase">
                Permanent deletion
              </p>
              <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                End it permanently.
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Anonymizes name, email, phone, DOB, and message bodies. Booking + payment records
                stay for the CRA-mandated 7-year retention. This cannot be undone.
              </p>

              {!showDelete ? (
                <div className="mt-4">
                  <Button
                    onClick={() => setShowDelete(true)}
                    variant="destructive"
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} />
                    Delete account
                  </Button>
                </div>
              ) : (
                <div className="mt-4">
                  <label
                    htmlFor="delete-reason"
                    className="text-[11px] font-semibold tracking-[0.12em] text-destructive uppercase"
                  >
                    Reason (5–500 chars · audit trail)
                  </label>
                  <textarea
                    id="delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    maxLength={500}
                    placeholder="Confirmed fraud — multiple flagged verifications and dispute pattern."
                    className={TEXTAREA_CLASS}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {deleteReason.length}/500
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setShowDelete(false);
                          setDeleteReason("");
                        }}
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={onDelete}
                        disabled={deleting || deleteReason.trim().length < 5}
                        variant="destructive"
                        size="sm"
                        className="cursor-pointer"
                      >
                        {deleting ? (
                          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                          <Trash2 className="size-3.5" strokeWidth={2} />
                        )}
                        Confirm deletion
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-accent/40 bg-accent/[0.04] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <ShieldX className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
            Kill-switch
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
            Pull them from the marketplace.
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Caregivers drop out of matching immediately. Families lose booking access. The reason
            below is logged on the audit trail — be specific enough that the next admin reading it
            knows why.
          </p>

          <div className="mt-4">
            <label
              htmlFor="suspend-reason"
              className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Reason (5–500 chars)
            </label>
            <textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Inconsistent behaviour reports. Pending investigation by safety team."
              className={TEXTAREA_CLASS}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground tabular-nums">{reason.length}/500</p>
              <Button
                onClick={onSuspend}
                disabled={busy || reason.trim().length < 5}
                variant="destructive"
                size="sm"
                className="cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <ShieldOff className="size-3.5" strokeWidth={2} />
                )}
                Suspend account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Verification panel
 * ───────────────────────────────────────────────────────────── */

function VerificationPanel({ records }: { records: VerificationRecordSummary[] }) {
  return (
    <Panel icon={ShieldCheck} title="Verification">
      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No verification records on file.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-foreground capitalize">
                  {humanCheckType(r.check_type)}
                </p>
                {r.provider && <p className="text-xs text-muted-foreground">via {r.provider}</p>}
              </div>
              <VerificationStatusPill status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function VerificationStatusPill({ status }: { status: string }) {
  const isCleared = status === "cleared";
  const isFlagged = status === "flagged" || status === "rejected";
  const isPending = status === "pending_review" || status === "in_progress";

  if (isCleared) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
        <CheckCircle2 className="size-3" strokeWidth={2.25} />
        Cleared
      </span>
    );
  }
  if (isFlagged) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent capitalize ring-1 ring-accent/20">
        <XCircle className="size-3" strokeWidth={2.25} />
        {status.replace("_", " ")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize ring-1 ring-border">
      {isPending ? "Pending" : status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Ratings panel
 * ───────────────────────────────────────────────────────────── */

function RatingsPanel({ ratings }: { ratings: AdminUserDetail["ratings"] }) {
  const avg = ratings.average_stars;
  const count = ratings.count;

  return (
    <Panel icon={Star} title="Ratings">
      {count === 0 || avg === null ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No public reviews yet.
        </p>
      ) : (
        <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-5xl font-bold tabular-nums text-foreground">{avg.toFixed(2)}</p>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-4",
                    i < Math.round(avg) ? "fill-accent text-accent" : "text-muted-foreground/30",
                  )}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              From {count} review{count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Bookings panel
 * ───────────────────────────────────────────────────────────── */

function BookingsPanel({
  bookings,
  role,
}: {
  bookings: AdminUserDetail["bookings"];
  role: AdminUserRole;
}) {
  const showCaregiverSide = role === "caregiver" || bookings.as_caregiver.total > 0;
  const showFamilySide = role === "family" || bookings.as_family.total > 0;

  if (!showCaregiverSide && !showFamilySide) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Bookings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {showCaregiverSide && (
          <BookingTallyCard label="As caregiver" tally={bookings.as_caregiver} />
        )}
        {showFamilySide && <BookingTallyCard label="As family" tally={bookings.as_family} />}
      </div>
    </section>
  );
}

function BookingTallyCard({ label, tally }: { label: string; tally: BookingTally }) {
  const entries = Object.entries(tally.by_status);

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-3xl font-bold tabular-nums text-foreground">{tally.total}</p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No bookings on this side.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map(([status, count]) => (
            <li
              key={status}
              className="flex items-center justify-between border-t border-border/60 pt-2 first:border-t-0 first:pt-0"
            >
              <span className="text-sm text-foreground/80 capitalize">
                {status.replace("_", " ")}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Pills
 * ───────────────────────────────────────────────────────────── */

function RolePill({ role }: { role: AdminUserRole }) {
  const styles: Record<AdminUserRole, string> = {
    family: "bg-primary/10 text-primary",
    caregiver: "bg-success/10 text-success",
    admin: "bg-foreground/10 text-foreground/80",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
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
      <Trash2 className="size-3" strokeWidth={2.25} />
      Deleted
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Skeleton + error
 * ───────────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 animate-pulse rounded-xl border border-border bg-card/60" />
      <div className="h-32 animate-pulse rounded-xl border border-border bg-card/60" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card/60" />
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card/60" />
      </div>
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
        Couldn&apos;t load the user.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again or head back to the search.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onRetry} size="sm" className="cursor-pointer">
          <RefreshCw className="size-3.5" strokeWidth={2} />
          Retry
        </Button>
        <Link href="/admin/users">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to users
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function humanCheckType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
