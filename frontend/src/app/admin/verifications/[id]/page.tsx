"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  type LucideIcon,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  approveVerification,
  checkTypeLabel,
  getVerification,
  rejectVerification,
  statusLabel,
  type StatusTone,
  statusTone,
  type VerificationDetail,
} from "@/lib/admin-verifications";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminVerificationDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Verification detail">
        <DetailView id={id} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

const AVATAR_TONES: Record<StatusTone, string> = {
  good: "bg-success/10 text-success",
  alarm: "bg-accent/10 text-accent",
  warn: "bg-foreground/10 text-foreground/70",
  neutral: "bg-primary/10 text-primary",
};

function DetailView({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<VerificationDetail | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("loading");

  const reload = useCallback(async () => {
    setState("loading");
    try {
      const resp = await getVerification(id);
      setData(resp.verification);
      setDocumentUrls(resp.document_urls ?? {});
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await getVerification(id);
        if (!alive) return;
        setData(resp.verification);
        setDocumentUrls(resp.document_urls ?? {});
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
        href="/admin/verifications"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to queue
      </Link>

      {state === "loading" && <Skeleton />}
      {state === "error" && <ErrorCard onRetry={reload} />}
      {state === "ready" && data && (
        <Body
          data={data}
          documentUrls={documentUrls}
          onDecision={() => router.push("/admin/verifications")}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared primitives
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

function StatusPill({ status, tone }: { status: string; tone: StatusTone }) {
  const isCleared = status === "cleared";
  const isFlagged = status === "flagged";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "good" && "bg-success/10 text-success",
        tone === "alarm" && "bg-accent/10 text-accent",
        tone === "warn" && "bg-foreground/10 text-foreground/70",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {isCleared && <BadgeCheck className="size-3" strokeWidth={2.25} />}
      {isFlagged && <ShieldX className="size-3" strokeWidth={2.25} />}
      {statusLabel(status)}
    </span>
  );
}

function MutedPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
      {children}
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────
 * Body layout
 * ───────────────────────────────────────────────────────────── */

function Body({
  data,
  documentUrls,
  onDecision,
}: {
  data: VerificationDetail;
  documentUrls: Record<string, string>;
  onDecision: () => void;
}) {
  const tone = statusTone(data.status);
  const canAct = data.status === "pending_review" || data.status === "not_started";

  return (
    <div className="space-y-6">
      <ProfileHeader data={data} tone={tone} />

      {canAct && <DecisionPanel id={data.id} onDone={onDecision} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <CaregiverPanel data={data} />
        <DocumentsPanel urls={documentUrls} />
      </div>

      {(data.reviewer || data.admin_notes || data.rejection_reason) && (
        <ReviewHistoryPanel data={data} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Profile header — hero card
 * ───────────────────────────────────────────────────────────── */

function ProfileHeader({ data, tone }: { data: VerificationDetail; tone: StatusTone }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
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
              AVATAR_TONES[tone],
            )}
          >
            {initialsOf(data.user.name)}
          </span>

          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {data.user.name}
              </h1>
              <span className="text-sm font-medium tabular-nums text-muted-foreground/70">
                #{String(data.id).padStart(5, "0")}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <MutedPill>{checkTypeLabel(data.check_type)}</MutedPill>
              <StatusPill status={data.status} tone={tone} />
              {data.provider && <MutedPill>via {data.provider}</MutedPill>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Decision panel — approve / reject
 * ───────────────────────────────────────────────────────────── */

const TEXTAREA_CLASS =
  "mt-2 min-h-[72px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50";

function DecisionPanel({ id, onDone }: { id: number; onDone: () => void }) {
  const [adminNotes, setAdminNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function onApprove() {
    setBusy(true);
    try {
      await approveVerification(id, adminNotes.trim() || undefined);
      toast.success("Verification approved.");
      onDone();
    } catch {
      toast.error("Couldn't approve. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (rejectionReason.trim().length < 5) {
      toast.error("Rejection reason must be at least 5 characters.");
      return;
    }
    setBusy(true);
    try {
      await rejectVerification(id, rejectionReason.trim(), adminNotes.trim() || undefined);
      toast.success("Verification rejected.");
      onDone();
    } catch {
      toast.error("Couldn't reject. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
            Decision
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
            Clear them or send them back?
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Approve flips this check to cleared. Reject requires a reason that goes back to the
            caregiver, and lands on the audit trail.
          </p>

          <div className="mt-4">
            <label
              htmlFor="admin-notes"
              className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Admin notes (optional, internal)
            </label>
            <textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              maxLength={500}
              placeholder="Anything the next admin should know about this decision."
              className={TEXTAREA_CLASS}
            />
          </div>

          {showReject && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/[0.04] p-4">
              <label
                htmlFor="rejection-reason"
                className="text-[11px] font-semibold tracking-[0.12em] text-destructive uppercase"
              >
                Rejection reason (visible to caregiver, 5–500 chars)
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                maxLength={500}
                placeholder="ID photo unreadable. Please reupload a clearer scan in good lighting."
                className={TEXTAREA_CLASS}
              />
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {rejectionReason.length}/500
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={onApprove} disabled={busy} size="sm" className="cursor-pointer">
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
              )}
              Approve
            </Button>

            {showReject ? (
              <>
                <Button
                  onClick={onReject}
                  disabled={busy || rejectionReason.trim().length < 5}
                  variant="destructive"
                  size="sm"
                  className="cursor-pointer"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <XCircle className="size-3.5" strokeWidth={2} />
                  )}
                  Confirm rejection
                </Button>
                <Button
                  onClick={() => setShowReject(false)}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShowReject(true)}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                <XCircle className="size-3.5" strokeWidth={2} />
                Reject
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Caregiver panel
 * ───────────────────────────────────────────────────────────── */

function CaregiverPanel({ data }: { data: VerificationDetail }) {
  const profile = data.user.caregiver_profile;
  const services = profile?.services ?? [];

  return (
    <Panel icon={ClipboardList} title="Caregiver">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailTile icon={Mail} label="Email" value={data.user.email} />
        {data.user.phone && <DetailTile icon={Phone} label="Phone" value={data.user.phone} />}
        {data.user.gender && (
          <DetailTile icon={UserRound} label="Gender" value={data.user.gender} capitalize />
        )}
        {profile && profile.years_of_experience !== null && (
          <DetailTile
            icon={Clock}
            label="Experience"
            value={`${profile.years_of_experience} year${profile.years_of_experience === 1 ? "" : "s"}`}
          />
        )}
        {profile && profile.hourly_rate !== null && (
          <DetailTile icon={DollarSign} label="Hourly rate" value={`$${profile.hourly_rate}/hr`} />
        )}
      </div>

      {profile?.bio && (
        <p className="mt-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
          {profile.bio}
        </p>
      )}

      {services.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Services
          </p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span
                key={s.name}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Documents panel
 * ───────────────────────────────────────────────────────────── */

function DocumentsPanel({ urls }: { urls: Record<string, string> }) {
  const entries = Object.entries(urls);

  return (
    <Panel icon={FileText} title="Documents">
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([key, url]) => (
            <DocumentRow key={key} docKey={key} url={url} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DocumentRow({ docKey, url }: { docKey: string; url: string }) {
  const label = docKey.replace(/_/g, " ");

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]">
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label={`Preview ${label}`}
              className="relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-muted/40 transition-all hover:border-primary/50 hover:shadow-[0_4px_12px_rgba(10,14,40,0.08)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={label} className="size-full object-cover" loading="lazy" />
            </button>
          }
        />
        <DialogContent className="max-w-3xl p-0">
          <DialogTitle className="px-6 pt-6 capitalize">{label}</DialogTitle>
          <DialogDescription className="px-6 pb-3 text-xs text-muted-foreground">
            Signed link expires in 15 minutes from page load.
          </DialogDescription>
          <div className="px-6 pb-6">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={label} className="block h-auto w-full object-contain" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="size-3.5" strokeWidth={2} />
                Open in new tab
              </a>
              <DialogClose
                render={
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    <X className="size-3.5" strokeWidth={2} />
                    Close
                  </Button>
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight text-foreground capitalize">{label}</p>
        <p className="text-xs text-muted-foreground">Click thumbnail to preview</p>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${label} in new tab`}
        className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <ExternalLink className="size-4" strokeWidth={2} />
      </a>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Review history panel
 * ───────────────────────────────────────────────────────────── */

function ReviewHistoryPanel({ data }: { data: VerificationDetail }) {
  const reviewed = data.reviewed_at ? new Date(data.reviewed_at) : null;

  return (
    <Panel icon={ClipboardList} title="Review history">
      {data.reviewer && reviewed && (
        <p className="text-sm text-muted-foreground">
          Reviewed by <span className="font-semibold text-foreground">{data.reviewer.name}</span> ·{" "}
          <span className="tabular-nums">
            {reviewed.toLocaleString("en-CA", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </p>
      )}
      {data.admin_notes && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Admin notes
          </p>
          <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
            {data.admin_notes}
          </p>
        </div>
      )}
      {data.rejection_reason && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-destructive uppercase">
            Rejection reason
          </p>
          <p className="rounded-lg border border-destructive/25 bg-destructive/[0.04] px-3 py-2.5 text-sm leading-relaxed text-foreground/85">
            {data.rejection_reason}
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Skeleton + error
 * ───────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 animate-pulse rounded-xl border border-border bg-card/60" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/60" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card/60" />
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
        Couldn&apos;t load this verification.
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The server didn&apos;t answer. Try again or head back to the queue.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onRetry} size="sm" className="cursor-pointer">
          <RefreshCw className="size-3.5" strokeWidth={2} />
          Retry
        </Button>
        <Link href="/admin/verifications">
          <Button variant="outline" size="sm" className="cursor-pointer">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to queue
          </Button>
        </Link>
      </div>
    </div>
  );
}
