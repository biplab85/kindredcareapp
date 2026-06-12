"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle as AlertTriangleIcon,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileSearch,
  Loader2,
  ShieldCheck,
  Upload,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface VerificationRecord {
  id: number;
  check_type: string;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  document_paths: Record<string, string> | null;
}

const CHECK_META: Record<string, { icon: LucideIcon; label: string; description: string }> = {
  identity: {
    icon: ShieldCheck,
    label: "Identity",
    description: "Government ID + selfie, reviewed by the admin team.",
  },
  cpic: {
    icon: FileSearch,
    label: "Criminal record check",
    description: "CPIC run after identity clears — typically 3–7 days.",
  },
  aml: {
    icon: AlertTriangleIcon,
    label: "AML / sanctions",
    description:
      "Financial-sanctions screen, bundled with the CPIC check — clears automatically the moment your CPIC check clears. Nothing to do here.",
  },
  reference: {
    icon: UserCheck,
    label: "References",
    description: "Two professional references filled out from your profile.",
  },
};

type StatusKey = "not_started" | "pending_review" | "cleared" | "flagged" | "rejected";

const STATUS_CONFIG: Record<
  StatusKey,
  {
    label: string;
    icon: LucideIcon;
    tone: "neutral" | "pending" | "positive" | "warning" | "critical";
  }
> = {
  not_started: { label: "Not started", icon: Clock, tone: "neutral" },
  pending_review: { label: "Pending review", icon: Clock, tone: "pending" },
  cleared: { label: "Cleared", icon: CheckCircle2, tone: "positive" },
  flagged: { label: "Flagged", icon: AlertTriangleIcon, tone: "warning" },
  rejected: { label: "Rejected", icon: XCircle, tone: "critical" },
};

const TONE_PILL: Record<"neutral" | "pending" | "positive" | "warning" | "critical", string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  pending: "bg-primary/10 text-primary ring-primary/30",
  positive: "bg-success/10 text-success ring-success/30",
  warning: "bg-accent/10 text-accent ring-accent/30",
  critical: "bg-destructive/10 text-destructive ring-destructive/30",
};

export default function VerificationPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <VerificationView />
    </AuthGuard>
  );
}

function VerificationView() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [isFullyVerified, setIsFullyVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/api/verification/status");
        if (!alive) return;
        setRecords(res.data.records);
        setIsFullyVerified(res.data.is_fully_verified);
      } catch {
        if (alive) toast.error("Failed to load verification status.");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get("/api/verification/status");
      setRecords(res.data.records);
      setIsFullyVerified(res.data.is_fully_verified);
    } catch {
      toast.error("Failed to refresh status.");
    }
  };

  const handleUploadId = async () => {
    const front = idFrontRef.current?.files?.[0];
    if (!front) {
      toast.error("Please select the front of your ID.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("id_front", front);
      const back = idBackRef.current?.files?.[0];
      if (back) formData.append("id_back", back);

      await api.post("/api/verification/upload-id", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const selfie = selfieRef.current?.files?.[0];
      if (selfie) {
        const selfieData = new FormData();
        selfieData.append("selfie", selfie);
        await api.post("/api/verification/upload-selfie", selfieData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast.success("Documents uploaded! Pending admin review.");
      await loadStatus();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const recordFor = (type: string) => records.find((r) => r.check_type === type);
  const clearedCount = records.filter((r) => r.status === "cleared").length;
  const identityRecord = recordFor("identity");
  const pct = Math.round((clearedCount / 4) * 100);

  return (
    <DashboardShell pageTitle="Verification">
      <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        {/* Header / progress card */}
        <section
          className={cn(
            "overflow-hidden rounded-2xl border bg-card shadow-sm",
            isFullyVerified ? "border-success/40" : "border-border",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl ring-1",
                  isFullyVerified
                    ? "bg-success/10 text-success ring-success/25"
                    : "bg-primary/10 text-primary ring-primary/20",
                )}
              >
                {isFullyVerified ? (
                  <BadgeCheck className="size-6" strokeWidth={2} />
                ) : (
                  <ShieldCheck className="size-6" strokeWidth={2} />
                )}
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {isFullyVerified ? "You're Basic Verified" : "Verification"}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {isFullyVerified
                    ? "Every check is cleared. Your badge is live on the shortlist and families can book you."
                    : "Complete each step below. The admin team reviews manually today; once all four clear, your profile becomes matchable."}
                </p>
              </div>
            </div>
            {isFullyVerified && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success ring-1 ring-success/30">
                <BadgeCheck className="size-3.5" strokeWidth={2.25} />
                Basic Verified
              </span>
            )}
          </div>

          {/* Progress */}
          <div className="border-t border-border px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {clearedCount} of 4 checks cleared
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  clearedCount === 4 ? "text-success" : "text-muted-foreground",
                )}
              >
                {pct}%
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {(["identity", "cpic", "aml", "reference"] as const).map((type) => {
              const record = recordFor(type);
              const meta = CHECK_META[type];
              const status = (record?.status ?? "not_started") as StatusKey;
              const config = STATUS_CONFIG[status];
              const Icon = meta.icon;
              const StatusIcon = config.icon;
              const cleared = status === "cleared";

              return (
                <section
                  key={type}
                  className={cn(
                    "rounded-2xl border bg-card p-5 shadow-sm sm:p-6",
                    cleared ? "border-success/40 bg-success/[0.03]" : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-4 sm:gap-5">
                    <div
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl ring-1",
                        cleared
                          ? "bg-success/10 text-success ring-success/25"
                          : "bg-muted text-foreground/80 ring-border",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={2} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                          {meta.label}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                            TONE_PILL[config.tone],
                          )}
                        >
                          <StatusIcon className="size-3.5" strokeWidth={2.25} />
                          {config.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {meta.description}
                      </p>

                      {status === "rejected" && record?.rejection_reason && (
                        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
                          <p className="text-xs font-semibold text-destructive">Reason given</p>
                          <p className="mt-1 text-foreground/90">{record.rejection_reason}</p>
                        </div>
                      )}

                      {type === "identity" &&
                        (status === "not_started" || status === "rejected") && (
                          <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
                            <p className="text-sm font-semibold text-foreground">
                              Upload your documents
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Clear photos, JPG or PNG. ID back is optional.
                            </p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <FileField label="ID front" required inputRef={idFrontRef} />
                              <FileField label="ID back" inputRef={idBackRef} />
                              <FileField label="Selfie" inputRef={selfieRef} />
                            </div>
                            <Button
                              onClick={handleUploadId}
                              disabled={isUploading}
                              className="mt-4"
                            >
                              {isUploading ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Upload className="size-4" strokeWidth={2} />
                              )}
                              Upload documents
                            </Button>
                          </div>
                        )}

                      {type === "identity" &&
                        identityRecord?.document_paths &&
                        status === "pending_review" && (
                          <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3 text-sm text-foreground/90">
                            <Clock className="size-4 shrink-0 text-primary" strokeWidth={2} />
                            Documents uploaded — waiting on admin review.
                          </div>
                        )}

                      {type === "reference" && status === "not_started" && (
                        <Link href="/profile/edit?step=5" className="mt-4 inline-block">
                          <Button variant="outline" size="sm">
                            Add references in your profile
                            <ArrowRight className="size-3.5" strokeWidth={2} />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function FileField({
  label,
  inputRef,
  required = false,
}: {
  label: string;
  inputRef: React.Ref<HTMLInputElement>;
  required?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const chosen = fileName !== null;

  return (
    <label
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-5 text-center transition-colors",
        chosen
          ? "border-success/40 bg-success/[0.04]"
          : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04]",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-lg transition-colors",
          chosen ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
        )}
      >
        {chosen ? (
          <CheckCircle2 className="size-5" strokeWidth={2} />
        ) : (
          <Upload className="size-5" strokeWidth={2} />
        )}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <span className="max-w-full truncate text-xs text-muted-foreground">
        {fileName ?? "Click to upload"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}
