"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type AdminCertification,
  type AdminCertStatusFilter,
  getAdminCertification,
  listAdminCertifications,
  rejectAdminCertification,
  verifyAdminCertification,
} from "@/lib/admin-certifications";
import { statusLabel, statusTone } from "@/lib/certifications";
import { cn } from "@/lib/utils";

/**
 * Admin certification review queue. Default tab is `pending_review` since
 * that's the only state that needs action; everything else is browseable
 * via the tab strip for audit and re-review.
 */
export default function AdminCertificationsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <AdminCertificationsView />
    </AuthGuard>
  );
}

const TABS: { value: AdminCertStatusFilter; label: string }[] = [
  { value: "pending_review", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "self_reported", label: "Self-reported" },
  { value: "all", label: "All" },
];

function AdminCertificationsView() {
  const [tab, setTab] = useState<AdminCertStatusFilter>("pending_review");
  const [rows, setRows] = useState<AdminCertification[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Loading flip lands on the next microtask so React 19's
      // setState-in-effect rule doesn't complain about a synchronous
      // cascade — same observable behavior, lint-clean.
      setIsLoading(true);
      try {
        const res = await listAdminCertifications({ status: tab, per_page: 50 });
        if (!alive) return;
        setRows(res.data);
        setMeta({ total: res.total });
      } catch {
        if (alive) toast.error("Couldn't load the certifications queue.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, refreshNonce]);

  return (
    <DashboardShell pageTitle="Certifications">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Eyebrow label="§ 01 · Certifications" />

        <header className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl">
              Cert <span className="italic text-primary">review queue.</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Caregiver-uploaded certifications. Verified entries show with the leaf-green
              shield on the public profile; rejected ones bounce back to the caregiver with
              a note.
            </p>
          </div>
          {meta ? (
            <span className="rounded-full bg-muted px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {meta.total} {tab === "all" ? "total" : statusLabel(tab as never).toLowerCase()}
            </span>
          ) : null}
        </header>

        <div className="my-6 border-t border-dashed border-border/60" />

        <div className="-mx-1 overflow-x-auto">
          <div role="tablist" className="flex min-w-max items-stretch gap-1 px-1">
            {TABS.map((t) => {
              const active = t.value === tab;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "border-b-2 px-3 py-3 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <CertRow
                  key={row.id}
                  cert={row}
                  onOpen={() => setSelectedId(row.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedId !== null ? (
        <DetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={async () => {
            refresh();
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function Eyebrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-6 bg-foreground/30" />
      {label}
    </div>
  );
}

function CertRow({ cert, onOpen }: { cert: AdminCertification; onOpen: () => void }) {
  const caregiver = cert.caregiver_profile?.user;
  return (
    <li
      className="cursor-pointer rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-foreground/30 sm:p-5"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-base font-semibold tracking-tight">{cert.name}</h3>
            <StatusPill status={cert.status} />
            {cert.has_document ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                <FileText className="size-3" strokeWidth={2} />
                Document
              </span>
            ) : (
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/60 uppercase">
                No document
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
            {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Issuer not on file"}
          </p>
          {caregiver ? (
            <p className="mt-2 text-sm text-foreground/90">
              {caregiver.name}{" "}
              <span className="font-mono text-[11px] text-muted-foreground">{caregiver.email}</span>
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1">
          <Eye className="size-3.5" strokeWidth={2} />
          Review
        </Button>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: AdminCertification["status"] }) {
  const tone = statusTone(status);
  const cls: Record<typeof tone, string> = {
    muted: "bg-muted text-muted-foreground ring-foreground/15",
    primary: "bg-primary/10 text-primary ring-primary/30",
    success: "bg-success/10 text-success ring-success/30",
    destructive: "bg-destructive/10 text-destructive ring-destructive/30",
    warning: "bg-accent/10 text-accent ring-accent/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase ring-1",
        cls[tone],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function EmptyState({ tab }: { tab: AdminCertStatusFilter }) {
  const msg =
    tab === "pending_review"
      ? "Inbox zero. No certs waiting on review."
      : tab === "verified"
        ? "No verified certs yet."
        : tab === "rejected"
          ? "No rejected certs."
          : tab === "self_reported"
            ? "No self-reported certs (caregivers who skipped the upload)."
            : "No certifications on record yet.";
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center">
      <ShieldCheck className="mx-auto size-8 text-muted-foreground/60" strokeWidth={1.5} />
      <p className="mt-3 text-sm text-muted-foreground italic">{msg}</p>
    </div>
  );
}

function DetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [cert, setCert] = useState<AdminCertification | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getAdminCertification(id);
        if (!alive) return;
        setCert(res.certification);
        setDocumentUrl(res.document_url);
        if (res.certification.expires_at) {
          setExpiresAt(res.certification.expires_at.slice(0, 10));
        }
      } catch {
        toast.error("Couldn't load the certification.");
        if (alive) onClose();
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, onClose]);

  const handleVerify = async () => {
    if (!cert || busy) return;
    setBusy(true);
    try {
      await verifyAdminCertification(cert.id, expiresAt || null);
      toast.success("Certification verified.");
      await onChanged();
      onClose();
    } catch {
      toast.error("Couldn't verify the certification.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!cert || busy || rejectReason.trim().length < 5) {
      toast.error("Add a rejection reason (at least 5 characters).");
      return;
    }
    setBusy(true);
    try {
      await rejectAdminCertification(cert.id, rejectReason.trim());
      toast.success("Certification rejected.");
      await onChanged();
      onClose();
    } catch {
      toast.error("Couldn't reject the certification.");
    } finally {
      setBusy(false);
    }
  };

  const caregiver = useMemo(() => cert?.caregiver_profile?.user ?? null, [cert]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-border/60 bg-background p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !cert ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow label="§ Review certification" />
                <h2 className="mt-2 text-2xl leading-tight font-semibold tracking-tight">
                  {cert.name}
                </h2>
                <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                  {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Issuer not on file"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusPill status={cert.status} />
                  {caregiver ? (
                    <span className="text-sm text-foreground/90">
                      {caregiver.name}{" "}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {caregiver.email}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <XCircle className="size-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="my-6 border-t border-dashed border-border/60" />

            {documentUrl ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                    <FileText className="size-3.5" strokeWidth={2} />
                    Uploaded document
                  </p>
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.18em] text-primary uppercase transition-colors hover:text-primary/80"
                  >
                    Open in new tab
                    <ExternalLink className="size-3" strokeWidth={2.5} />
                  </a>
                </div>
                <div className="mt-3 overflow-hidden rounded-lg border border-border/60 bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={documentUrl}
                    alt={cert.name}
                    className="block max-h-[400px] w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground/60 uppercase">
                  PDF? It won&apos;t preview inline. Use the open-in-new-tab link.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                <AlertTriangle
                  className="mx-auto size-6 text-muted-foreground/60"
                  strokeWidth={1.5}
                />
                <p className="mt-2 text-sm text-muted-foreground italic">
                  No document attached. This is self-reported only.
                </p>
              </div>
            )}

            {cert.rejection_reason ? (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <span className="font-medium">Previous rejection:</span> {cert.rejection_reason}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  Expires at (optional)
                </span>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                />
              </label>
            </div>

            {rejectMode ? (
              <div className="mt-6 space-y-3 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
                <span className="font-mono text-[10px] tracking-[0.22em] text-destructive uppercase">
                  Reason for rejection
                </span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Document is for someone else. Re-upload your own."
                  className="block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectMode(false)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReject}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                    Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectMode(true)}
                  disabled={busy}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Reject
                </Button>
                <Button onClick={handleVerify} disabled={busy} className="gap-1">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" strokeWidth={2.25} />
                  )}
                  Verify
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

