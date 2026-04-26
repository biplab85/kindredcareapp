"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
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
        <BackLink />
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
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/verifications"
      className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      Back to queue
    </Link>
  );
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
    <div className="mt-6 space-y-10">
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
 * Profile header
 * ───────────────────────────────────────────────────────────── */

function ProfileHeader({ data, tone }: { data: VerificationDetail; tone: StatusTone }) {
  return (
    <header className="mt-6">
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        <span>Verification #{String(data.id).padStart(5, "0")}</span>
        <span className="text-foreground/30">— § 32</span>
      </div>

      <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        {data.user.name}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
          {checkTypeLabel(data.check_type)}
        </span>
        <StatusPill status={data.status} tone={tone} />
        {data.provider && (
          <span className="inline-flex items-center rounded-full border border-foreground/20 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
            via {data.provider}
          </span>
        )}
      </div>
    </header>
  );
}

function StatusPill({ status, tone }: { status: string; tone: StatusTone }) {
  const isCleared = status === "cleared";
  const isFlagged = status === "flagged";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase",
        tone === "good" && "border border-success/40 bg-success/[0.07] text-success",
        tone === "alarm" && "bg-accent text-accent-foreground",
        tone === "warn" && "border border-foreground/25 bg-foreground/5 text-foreground/70",
        tone === "neutral" && "border border-border/70 bg-background text-muted-foreground",
      )}
    >
      {isCleared && <BadgeCheck className="size-2.5" strokeWidth={2.25} />}
      {isFlagged && <ShieldX className="size-2.5" strokeWidth={2.25} />}
      {statusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Decision panel — approve / reject
 * ───────────────────────────────────────────────────────────── */

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
    <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-primary/15 text-primary">
          <ShieldCheck className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-primary uppercase">Decision</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            <span className="font-normal italic">Clear them</span> or send them back?
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve flips this check to <span className="font-mono">cleared</span>. Reject requires
            a reason that goes back to the caregiver, and lands on the audit trail.
          </p>

          <div className="mt-4">
            <label
              htmlFor="admin-notes"
              className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
            >
              Admin notes (optional, internal)
            </label>
            <textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              maxLength={500}
              placeholder="Anything the next admin should know about this decision."
              className="mt-2 min-h-[64px] w-full resize-y rounded-xl border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
            />
          </div>

          {showReject && (
            <div className="mt-4 rounded-xl border border-accent/40 bg-accent/[0.04] p-4">
              <label
                htmlFor="rejection-reason"
                className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase"
              >
                Rejection reason (visible to caregiver, 5-500 chars)
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                maxLength={500}
                placeholder="ID photo unreadable. Please reupload a clearer scan in good lighting."
                className="mt-2 min-h-[80px] w-full resize-y rounded-xl border border-border/70 bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-accent/60"
              />
              <p className="mt-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                {rejectionReason.length}/500
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={onApprove} disabled={busy} size="sm">
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
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <XCircle className="size-3.5" strokeWidth={2} />
                  )}
                  Confirm rejection
                </Button>
                <Button onClick={() => setShowReject(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowReject(true)} variant="outline" size="sm">
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
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <ClipboardList className="size-3.5" strokeWidth={2} />
        Caregiver
        <span className="text-foreground/30">— § 33</span>
      </div>

      <ul className="space-y-3">
        <Field
          icon={<Mail className="size-3.5" strokeWidth={2} />}
          label="Email"
          value={data.user.email}
        />
        {data.user.phone && (
          <Field
            icon={<ClipboardList className="size-3.5" strokeWidth={2} />}
            label="Phone"
            value={data.user.phone}
            mono
          />
        )}
        {data.user.gender && (
          <Field
            icon={<ClipboardList className="size-3.5" strokeWidth={2} />}
            label="Gender"
            value={data.user.gender}
          />
        )}
        {profile && profile.years_of_experience !== null && (
          <Field
            icon={<CalendarDays className="size-3.5" strokeWidth={2} />}
            label="Experience"
            value={`${profile.years_of_experience} year${profile.years_of_experience === 1 ? "" : "s"}`}
            mono
          />
        )}
        {profile && profile.hourly_rate !== null && (
          <Field
            icon={<ClipboardList className="size-3.5" strokeWidth={2} />}
            label="Hourly rate"
            value={`$${profile.hourly_rate}/hr`}
            mono
          />
        )}
      </ul>

      {profile?.bio && (
        <blockquote className="mt-4 border-l-2 border-foreground/20 pl-3 text-sm leading-relaxed text-foreground/85 italic">
          &ldquo;{profile.bio}&rdquo;
        </blockquote>
      )}

      {services.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Services
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-foreground/70 uppercase"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
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
 * Documents panel
 * ───────────────────────────────────────────────────────────── */

function DocumentsPanel({ urls }: { urls: Record<string, string> }) {
  const entries = Object.entries(urls);

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <FileText className="size-3.5" strokeWidth={2} />
        Documents
        <span className="text-foreground/30">— § 34</span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground italic">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([key, url]) => (
            <li key={key}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium tracking-tight capitalize">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    Open in new tab
                  </p>
                </div>
                <ExternalLink
                  className="size-4 text-muted-foreground/60 transition-colors group-hover:text-primary"
                  strokeWidth={2}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Review history panel
 * ───────────────────────────────────────────────────────────── */

function ReviewHistoryPanel({ data }: { data: VerificationDetail }) {
  const reviewed = data.reviewed_at ? new Date(data.reviewed_at) : null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Review history
        <span className="text-foreground/30">— § 35</span>
      </div>

      <article className="rounded-2xl border border-border/60 bg-card p-5">
        {data.reviewer && reviewed && (
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
            Reviewed by{" "}
            <span className="text-foreground/80 normal-case tracking-[0.05em]">
              {data.reviewer.name}
            </span>{" "}
            ·{" "}
            {reviewed.toLocaleString("en-CA", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
        {data.admin_notes && (
          <div className="mt-3">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Admin notes
            </p>
            <blockquote className="mt-1 border-l-2 border-foreground/20 pl-3 text-sm leading-relaxed text-foreground/85 italic">
              &ldquo;{data.admin_notes}&rdquo;
            </blockquote>
          </div>
        )}
        {data.rejection_reason && (
          <div className="mt-3">
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
              Rejection reason
            </p>
            <blockquote className="mt-1 border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-foreground/85 italic">
              &ldquo;{data.rejection_reason}&rdquo;
            </blockquote>
          </div>
        )}
      </article>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Skeleton + error
 * ───────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="h-12 w-2/3 animate-pulse rounded-lg bg-muted/60" />
      <div className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
        <div className="h-48 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
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
          <h3 className="text-base font-semibold tracking-tight">
            Couldn&apos;t load this verification.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The server didn&apos;t answer. Try again or head back to the queue.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="size-3.5" strokeWidth={2} />
              Retry
            </Button>
            <Link href="/admin/verifications">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-3.5" strokeWidth={2} />
                Back to queue
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
