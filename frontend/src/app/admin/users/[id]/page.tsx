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

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <BackLink />
        {state === "loading" && <DetailSkeleton />}
        {state === "error" && <ErrorCard onRetry={reload} />}
        {state === "ready" && user && <UserDetailBody user={user} onMutated={reload} />}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/users"
      className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      Back to users
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Detail body
 * ───────────────────────────────────────────────────────────── */

function UserDetailBody({ user, onMutated }: { user: AdminUserDetail; onMutated: () => void }) {
  return (
    <div className="mt-6 space-y-10">
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
 * Profile header
 * ───────────────────────────────────────────────────────────── */

function ProfileHeader({ user }: { user: AdminUserDetail }) {
  return (
    <header className="mt-6">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        <span>User #{String(user.id).padStart(5, "0")}</span>
        <span className="text-foreground/30">— § 24</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            <span className={cn(user.status === "deleted" && "text-muted-foreground line-through")}>
              {user.name}
            </span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <RolePill role={user.role} />
            <StatusPill status={user.status} />
            {user.email_verified_at && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/[0.07] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-success uppercase">
                <BadgeCheck className="size-2.5" strokeWidth={2.25} />
                Email verified
              </span>
            )}
            {user.phone_verified_at && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/[0.07] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-success uppercase">
                <BadgeCheck className="size-2.5" strokeWidth={2.25} />
                Phone verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact line */}
      <ul className="mt-6 grid gap-3 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-2">
        <ContactRow
          icon={<Mail className="size-3.5" strokeWidth={2} />}
          label="Email"
          value={user.email}
        />
        {user.phone && (
          <ContactRow
            icon={<Phone className="size-3.5" strokeWidth={2} />}
            label="Phone"
            value={user.phone}
            mono
          />
        )}
        {user.date_of_birth && (
          <ContactRow
            icon={<CalendarRange className="size-3.5" strokeWidth={2} />}
            label="Date of birth"
            value={user.date_of_birth}
            mono
          />
        )}
        {user.gender && (
          <ContactRow
            icon={<ClipboardList className="size-3.5" strokeWidth={2} />}
            label="Gender"
            value={user.gender}
          />
        )}
        {user.created_at && (
          <ContactRow
            icon={<CalendarRange className="size-3.5" strokeWidth={2} />}
            label="Member since"
            value={formatDate(user.created_at)}
            mono
          />
        )}
      </ul>
    </header>
  );
}

function ContactRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-sm text-foreground/90",
            mono && "font-mono tabular-nums",
          )}
        >
          {value}
        </p>
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Action panel — suspend / reactivate
 * ───────────────────────────────────────────────────────────── */

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
      <section className="rounded-2xl border border-foreground/20 bg-foreground/[0.03] p-5">
        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Account state
        </p>
        <p className="mt-2 text-sm text-foreground/80">
          This account is marked deleted. Reactivation requires the Phase 15 compliance flow.
        </p>
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
      <div className="space-y-6">
        <section className="rounded-2xl border border-success/40 bg-success/[0.04] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-success/15 text-success">
              <ShieldCheck className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] tracking-[0.22em] text-success uppercase">
                Reactivation
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">
                <span className="font-normal italic">Bring them back</span> into the marketplace.
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Caregivers re-enter matching immediately. Families regain booking access.
              </p>
              <div className="mt-4">
                <Button onClick={onReactivate} disabled={busy} size="sm">
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

        <section className="rounded-2xl border border-accent/50 bg-accent/[0.04] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
              <Trash2 className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
                Permanent deletion
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">
                <span className="font-normal italic">End it permanently.</span>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Anonymizes name, email, phone, DOB, and message bodies. Booking + payment records
                stay for the CRA-mandated 7-year retention. This cannot be undone.
              </p>

              {!showDelete ? (
                <div className="mt-4">
                  <Button onClick={() => setShowDelete(true)} variant="destructive" size="sm">
                    <Trash2 className="size-3.5" strokeWidth={2} />
                    Delete account
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-accent/40 bg-background p-3">
                  <label
                    htmlFor="delete-reason"
                    className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase"
                  >
                    Reason (5-500 chars · audit trail)
                  </label>
                  <textarea
                    id="delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    maxLength={500}
                    placeholder="Confirmed fraud — multiple flagged verifications and dispute pattern."
                    className="mt-2 min-h-[72px] w-full resize-y rounded-lg border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-accent/60"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
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
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={onDelete}
                        disabled={deleting || deleteReason.trim().length < 5}
                        variant="destructive"
                        size="sm"
                      >
                        {deleting ? (
                          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                          <Trash2 className="size-3.5" strokeWidth={2} />
                        )}
                        Confirm permanent deletion
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
    <section className="rounded-2xl border border-accent/40 bg-accent/[0.03] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
          <ShieldX className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
            Kill-switch
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            <span className="font-normal italic">Pull them</span> from the marketplace.
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Caregivers drop out of matching immediately. Families lose booking access. The reason
            below is logged on the audit trail — be specific enough that the next admin reading it
            knows why.
          </p>

          <div className="mt-4">
            <label
              htmlFor="suspend-reason"
              className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
            >
              Reason (5-500 chars)
            </label>
            <textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Inconsistent behaviour reports. Pending investigation by safety team."
              className="mt-2 min-h-[80px] w-full resize-y rounded-xl border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-accent/50"
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {reason.length}/500
              </p>
              <Button
                onClick={onSuspend}
                disabled={busy || reason.trim().length < 5}
                variant="destructive"
                size="sm"
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
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <ShieldCheck className="size-3.5" strokeWidth={2} />
        Verification
        <span className="text-foreground/30">— § 25</span>
      </div>

      {records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground italic">
          No verification records on file.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium tracking-tight capitalize">
                  {humanCheckType(r.check_type)}
                </p>
                {r.provider && (
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    via {r.provider}
                  </p>
                )}
              </div>
              <VerificationStatusPill status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VerificationStatusPill({ status }: { status: string }) {
  const isCleared = status === "cleared";
  const isPending = status === "pending_review" || status === "in_progress";
  const isFlagged = status === "flagged" || status === "rejected";

  if (isCleared) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/[0.07] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-success uppercase">
        <CheckCircle2 className="size-2.5" strokeWidth={2.25} />
        Cleared
      </span>
    );
  }
  if (isFlagged) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/[0.06] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-accent uppercase">
        <XCircle className="size-2.5" strokeWidth={2.25} />
        {status.replace("_", " ")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
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
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <Star className="size-3.5" strokeWidth={2} />
        Ratings
        <span className="text-foreground/30">— § 26</span>
      </div>

      {count === 0 || avg === null ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground italic">
          No public reviews yet.
        </p>
      ) : (
        <div className="flex items-end gap-4">
          <p className="font-mono text-5xl font-semibold tabular-nums">{avg.toFixed(2)}</p>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-4",
                    i < Math.round(avg) ? "fill-primary text-primary" : "text-muted-foreground/30",
                  )}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
              From {count} review{count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}
    </section>
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
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Bookings
        <span className="text-foreground/30">— § 27</span>
      </div>

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
    <article className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums">{tally.total}</p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground italic">No bookings on this side.</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {entries.map(([status, count]) => (
            <li
              key={status}
              className="flex items-center justify-between border-t border-dashed border-border/50 pt-1.5 first:border-t-0 first:pt-0"
            >
              <span className="text-sm capitalize">{status.replace("_", " ")}</span>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Pills (copied from list page, kept colocated for brevity)
 * ───────────────────────────────────────────────────────────── */

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
      Deleted
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Skeleton + error
 * ───────────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="h-12 w-2/3 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      <div className="h-24 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
        <div className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-6 rounded-2xl border border-accent/40 bg-accent/[0.04] p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
          <AlertCircle className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight">Couldn&apos;t load the user.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again or head back to the search.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="size-3.5" strokeWidth={2} />
              Retry
            </Button>
            <Link href="/admin/users">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-3.5" strokeWidth={2} />
                Back to users
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function humanCheckType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
