"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle as AlertTriangleIcon,
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
  neutral: "bg-muted text-muted-foreground ring-foreground/15",
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

  return (
    <DashboardShell pageTitle="Verification">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
              {isFullyVerified ? "You're Basic Verified" : "Verification"}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {isFullyVerified
                ? "Every check is cleared. Your badge is live on the shortlist and families can book you."
                : "Complete each step below. The admin team reviews manually today; once all four clear, your profile becomes matchable."}
            </p>
            <p className="mt-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {clearedCount} of 4 cleared
            </p>
          </div>
          {isFullyVerified && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-success uppercase ring-1 ring-success/40">
              <BadgeCheck className="size-3.5" strokeWidth={2.25} />
              Basic Verified
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {(["identity", "cpic", "aml", "reference"] as const).map((type) => {
              const record = recordFor(type);
              const meta = CHECK_META[type];
              const status = (record?.status ?? "not_started") as StatusKey;
              const config = STATUS_CONFIG[status];
              const Icon = meta.icon;
              const StatusIcon = config.icon;

              return (
                <section
                  key={type}
                  className={cn(
                    "rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6",
                    status === "cleared" && "border-success/40 bg-success/[0.03]",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-5">
                    <div
                      className={cn(
                        "grid size-11 shrink-0 place-items-center rounded-xl",
                        status === "cleared"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-foreground/80",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                          {meta.label}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase ring-1",
                            TONE_PILL[config.tone],
                          )}
                        >
                          <StatusIcon className="size-3" strokeWidth={2} />
                          {config.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>

                      {status === "rejected" && record?.rejection_reason && (
                        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
                          <p className="text-[11px] font-medium tracking-[0.14em] text-destructive uppercase">
                            Reason given
                          </p>
                          <p className="mt-1 text-foreground/90">{record.rejection_reason}</p>
                        </div>
                      )}

                      {type === "identity" &&
                        (status === "not_started" || status === "rejected") && (
                          <div className="mt-5 rounded-2xl border border-border/60 bg-muted/30 p-4 sm:p-5">
                            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                              Upload
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
                                <Upload className="size-4" strokeWidth={1.75} />
                              )}
                              Upload documents
                            </Button>
                          </div>
                        )}

                      {type === "identity" &&
                        identityRecord?.document_paths &&
                        status === "pending_review" && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            Documents uploaded — waiting on admin review.
                          </p>
                        )}

                      {type === "reference" && status === "not_started" && (
                        <Link
                          href="/profile/edit?step=5"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-dotted underline-offset-4 hover:text-primary/80"
                        >
                          Add references in your profile
                          <span aria-hidden>→</span>
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
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground file:transition-opacity hover:file:opacity-90"
      />
    </label>
  );
}
