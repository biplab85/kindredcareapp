"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  FileSearch,
  AlertTriangle as AlertTriangleIcon,
  UserCheck,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CaregiverLayout } from "@/components/layouts/caregiver-layout";
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

const checkMeta: Record<string, { icon: typeof ShieldCheck; label: string; description: string }> =
  {
    identity: {
      icon: ShieldCheck,
      label: "Identity Verification",
      description: "Upload your government-issued ID and a selfie",
    },
    cpic: {
      icon: FileSearch,
      label: "Criminal Record Check (CPIC)",
      description: "Admin will review your background",
    },
    aml: {
      icon: AlertTriangleIcon,
      label: "AML / Sanctions Screening",
      description: "Admin will review for sanctions compliance",
    },
    reference: {
      icon: UserCheck,
      label: "Reference Check",
      description: "Your references will be contacted",
    },
  };

const statusConfig: Record<string, { badge: string; color: string; icon: typeof Clock }> = {
  not_started: { badge: "Not Started", color: "bg-muted text-muted-foreground", icon: Clock },
  pending_review: {
    badge: "Pending Review",
    color: "bg-warning/10 text-warning-foreground",
    icon: Clock,
  },
  cleared: { badge: "Cleared", color: "bg-success text-success-foreground", icon: CheckCircle2 },
  flagged: {
    badge: "Flagged",
    color: "bg-warning text-warning-foreground",
    icon: AlertTriangleIcon,
  },
  rejected: { badge: "Rejected", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

export default function VerificationPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <CaregiverLayout isVerified={false}>
        <VerificationContent />
      </CaregiverLayout>
    </AuthGuard>
  );
}

function VerificationContent() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [isFullyVerified, setIsFullyVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  const loadStatus = async () => {
    try {
      const res = await api.get("/api/verification/status");
      setRecords(res.data.records);
      setIsFullyVerified(res.data.is_fully_verified);
    } catch {
      toast.error("Failed to load verification status.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadStatus();
  }, []);

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
      loadStatus();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const getRecord = (type: string) => records.find((r) => r.check_type === type);
  const identityRecord = getRecord("identity");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Verification</h1>
        <p className="text-sm text-muted-foreground">
          Complete these checks to earn your &quot;Basic Verified&quot; badge and start receiving
          bookings.
        </p>
      </div>

      {isFullyVerified && (
        <Card className="mb-6 border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-4 p-6">
            <PartyPopper className="size-10 text-success" />
            <div>
              <h3 className="text-lg font-semibold text-success">You&apos;re Verified!</h3>
              <p className="text-sm text-muted-foreground">
                All checks are cleared. Your &quot;Basic Verified&quot; badge is now visible to
                families.
              </p>
            </div>
            <Badge className="ml-auto bg-success text-success-foreground">
              <ShieldCheck className="mr-1 size-3" /> Basic Verified
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {["identity", "cpic", "aml", "reference"].map((type) => {
          const record = getRecord(type);
          const meta = checkMeta[type];
          const status = record?.status || "not_started";
          const config = statusConfig[status];
          const Icon = meta.icon;
          const StatusIcon = config.icon;

          return (
            <Card key={type} className={cn(status === "cleared" && "border-success/20")}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl",
                      status === "cleared"
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{meta.label}</h4>
                      <Badge className={cn("text-xs", config.color)}>
                        <StatusIcon className="mr-1 size-3" />
                        {config.badge}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>

                    {status === "rejected" && record?.rejection_reason && (
                      <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                        <p className="text-sm text-destructive">
                          <strong>Reason:</strong> {record.rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Identity upload form */}
                    {type === "identity" && (status === "not_started" || status === "rejected") && (
                      <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                              ID Front *
                            </label>
                            <input
                              ref={idFrontRef}
                              type="file"
                              accept="image/*"
                              className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                              ID Back (optional)
                            </label>
                            <input
                              ref={idBackRef}
                              type="file"
                              accept="image/*"
                              className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                              Selfie
                            </label>
                            <input
                              ref={selfieRef}
                              type="file"
                              accept="image/*"
                              className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
                            />
                          </div>
                        </div>
                        <Button onClick={handleUploadId} disabled={isUploading} size="sm">
                          {isUploading ? (
                            <Loader2 className="mr-1 size-3 animate-spin" />
                          ) : (
                            <Upload className="mr-1 size-3" />
                          )}
                          Upload Documents
                        </Button>
                      </div>
                    )}

                    {type === "identity" &&
                      identityRecord?.document_paths &&
                      status === "pending_review" && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Documents uploaded. Waiting for admin review.
                        </p>
                      )}

                    {type === "reference" && status === "not_started" && (
                      <Link
                        href="/onboarding?step=5"
                        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                      >
                        Add references in your profile →
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
