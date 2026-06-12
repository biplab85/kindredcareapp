"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  LayoutGrid,
  Loader2,
  MoreVertical,
  RefreshCw,
  ShieldCheck,
  Table as TableIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
 * Admin certification review queue. Verified entries show the leaf-green
 * shield on the public profile; rejected ones bounce back with a note.
 */
export default function AdminCertificationsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <AdminCertificationsView />
    </AuthGuard>
  );
}

type ViewMode = "grid" | "table";

const TABS: { value: AdminCertStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "self_reported", label: "Self-reported" },
];

type CertTone = ReturnType<typeof statusTone>;

const AVATAR_TONES: Record<CertTone, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-accent/10 text-accent",
};

function AdminCertificationsView() {
  const [tab, setTab] = useState<AdminCertStatusFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [rows, setRows] = useState<AdminCertification[]>([]);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
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

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await listAdminCertifications({ status: tab, per_page: 50 });
      setRows(res.data);
      setMeta({ total: res.total });
    } catch {
      toast.error("Couldn't refresh the queue.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <DashboardShell pageTitle="Certifications">
      <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
            Certifications
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Caregiver-uploaded certifications. Verified entries show the leaf-green shield on the
            public profile; rejected ones bounce back to the caregiver with a note.
          </p>
        </div>

        {/* Filter toolbar */}
        <section
          aria-label="Filters"
          className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Status
              </p>
              <SlideTabs
                ariaLabel="Certification status"
                value={tab}
                options={TABS}
                onChange={setTab}
                tabWidthClass="w-[104px]"
              />
            </div>

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
        </section>

        <div className="mt-6 mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {isLoading ? (
              <span className="text-muted-foreground">Loading…</span>
            ) : (
              <>
                <span className="font-semibold tabular-nums text-foreground">
                  {meta?.total ?? rows.length}
                </span>
                <span className="text-muted-foreground">
                  {(meta?.total ?? rows.length) === 1 ? "certification" : "certifications"}
                </span>
              </>
            )}
          </div>
          <ViewSwitcher view={view} onChange={setView} />
        </div>

        <div>
          {isLoading ? (
            <LoadingView view={view} />
          ) : rows.length === 0 ? (
            <EmptyState tab={tab} />
          ) : view === "table" ? (
            <CertTable rows={rows} onOpen={setSelectedId} />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <CertRow cert={row} onOpen={() => setSelectedId(row.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedId !== null ? (
        <DetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={refresh} />
      ) : null}
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────
 * View switcher + actions menu
 * ───────────────────────────────────────────────────────────── */

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

function CertActionsMenu({ onOpen }: { onOpen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Certification actions"
        className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-32">
        <DropdownMenuItem
          onClick={onOpen}
          className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
        >
          <Eye className="size-4 text-muted-foreground" />
          Review
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Grid rows
 * ───────────────────────────────────────────────────────────── */

function CertRow({ cert, onOpen }: { cert: AdminCertification; onOpen: () => void }) {
  const caregiver = cert.caregiver_profile?.user;
  const tone = statusTone(cert.status);

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_-16px_rgba(10,14,40,0.22)]">
      <button
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold",
            AVATAR_TONES[tone],
          )}
        >
          {initialsOf(caregiver?.name ?? cert.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary">
              {cert.name}
            </h3>
            <StatusPill status={cert.status} />
            <DocChip hasDoc={cert.has_document} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span>
              {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Issuer not on file"}
            </span>
            {caregiver && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span>
                  <span className="font-medium text-foreground/80">{caregiver.name}</span> ·{" "}
                  {caregiver.email}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      <CertActionsMenu onOpen={onOpen} />
    </div>
  );
}

function DocChip({ hasDoc }: { hasDoc: boolean }) {
  if (hasDoc) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
        <FileText className="size-3" strokeWidth={2} />
        Document
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground/60">
      No document
    </span>
  );
}

function StatusPill({ status }: { status: AdminCertification["status"] }) {
  const tone = statusTone(status);
  const cls: Record<CertTone, string> = {
    muted: "bg-muted text-muted-foreground ring-1 ring-border",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-accent/10 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        cls[tone],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Table view — striped + hover
 * ───────────────────────────────────────────────────────────── */

function CertTable({ rows, onOpen }: { rows: AdminCertification[]; onOpen: (id: number) => void }) {
  const th = "px-4 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className={cn(th, "pl-5")}>Certification</th>
              <th className={th}>Caregiver</th>
              <th className={th}>Status</th>
              <th className={th}>Document</th>
              <th className={cn(th, "pr-5")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((cert) => (
              <CertTableRow key={cert.id} cert={cert} onOpen={() => onOpen(cert.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CertTableRow({ cert, onOpen }: { cert: AdminCertification; onOpen: () => void }) {
  const caregiver = cert.caregiver_profile?.user;
  const tone = statusTone(cert.status);

  return (
    <tr className="border-b border-border/60 align-middle transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      <td className="px-4 py-3 pl-5">
        <button onClick={onOpen} className="group flex cursor-pointer items-center gap-3 text-left">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
              AVATAR_TONES[tone],
            )}
          >
            {initialsOf(caregiver?.name ?? cert.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground group-hover:text-primary">
              {cert.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground/70">
              {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Issuer not on file"}
            </span>
          </span>
        </button>
      </td>
      <td className="px-4 py-3">
        {caregiver ? (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{caregiver.name}</div>
            <div className="truncate text-xs text-muted-foreground">{caregiver.email}</div>
          </div>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={cert.status} />
      </td>
      <td className="px-4 py-3">
        <DocChip hasDoc={cert.has_document} />
      </td>
      <td className="px-4 py-3 pr-5 text-right">
        <CertActionsMenu onOpen={onOpen} />
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty / loading
 * ───────────────────────────────────────────────────────────── */

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
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <ShieldCheck className="size-7" strokeWidth={1.75} />
      </span>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{msg}</p>
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
            <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-muted" />
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

/* ─────────────────────────────────────────────────────────────
 * Review modal
 * ───────────────────────────────────────────────────────────── */

function DetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
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
      onChanged();
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
      onChanged();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !cert ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg",
                    AVATAR_TONES[statusTone(cert.status)],
                  )}
                >
                  <ShieldCheck className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {cert.name}
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Issuer not on file"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={cert.status} />
                    {caregiver && (
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{caregiver.name}</span> ·{" "}
                        {caregiver.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="grow space-y-5 overflow-y-auto p-5 sm:p-6">
              {documentUrl ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      <FileText className="size-3.5" strokeWidth={2} />
                      Uploaded document
                    </p>
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Open in new tab
                      <ExternalLink className="size-3.5" strokeWidth={2} />
                    </a>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/60 bg-card">
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
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    PDF? It won&apos;t preview inline — use the open-in-new-tab link.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                  <AlertTriangle className="size-6 text-muted-foreground/60" strokeWidth={1.75} />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No document attached. This is self-reported only.
                  </p>
                </div>
              )}

              {cert.rejection_reason ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/[0.05] px-4 py-3 text-sm text-foreground/85">
                  <span className="font-semibold text-destructive">Previous rejection:</span>{" "}
                  {cert.rejection_reason}
                </p>
              ) : null}

              <div>
                <label
                  htmlFor="cert-expires"
                  className="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                >
                  Expires at (optional)
                </label>
                <input
                  id="cert-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
                />
              </div>

              {rejectMode && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/[0.04] p-4">
                  <label
                    htmlFor="cert-reject"
                    className="text-[11px] font-semibold tracking-[0.12em] text-destructive uppercase"
                  >
                    Reason for rejection
                  </label>
                  <textarea
                    id="cert-reject"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Document is for someone else. Re-upload your own."
                    className="mt-2 block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
              {rejectMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectMode(false)}
                    disabled={busy}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReject}
                    disabled={busy}
                    className="cursor-pointer"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Confirm rejection
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    disabled={busy}
                    className="cursor-pointer"
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectMode(true)}
                    disabled={busy}
                    className="cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={handleVerify}
                    disabled={busy}
                    size="sm"
                    className="cursor-pointer"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
                    )}
                    Verify
                  </Button>
                </>
              )}
            </div>
          </>
        )}
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
