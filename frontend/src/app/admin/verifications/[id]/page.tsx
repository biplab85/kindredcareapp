"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Shield,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AdminLayout } from "@/components/layouts/admin-layout";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface VerificationDetail {
  id: number;
  check_type: string;
  status: string;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  updated_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    gender: string | null;
    caregiver_profile: {
      bio: string;
      hourly_rate: string;
      years_of_experience: number;
      services: { name: string }[];
    } | null;
  };
  reviewer: { name: string } | null;
}

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  pending_review: "bg-warning/10 text-warning-foreground",
  cleared: "bg-success text-success-foreground",
  flagged: "bg-warning text-warning-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export default function AdminVerificationDetailPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <AdminLayout>
        <DetailContent />
      </AdminLayout>
    </AuthGuard>
  );
}

function DetailContent() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<VerificationDetail | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/api/admin/verifications/${params.id}`);
        setData(res.data.verification);
        setDocumentUrls(res.data.document_urls || {});
        setAdminNotes(res.data.verification.admin_notes || "");
      } catch {
        toast.error("Verification not found.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/admin/verifications/${params.id}/approve`, {
        admin_notes: adminNotes,
      });
      toast.success("Verification approved!");
      router.push("/admin/verifications");
    } catch {
      toast.error("Failed to approve.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/api/admin/verifications/${params.id}/reject`, {
        rejection_reason: rejectionReason,
        admin_notes: adminNotes,
      });
      toast.success("Verification rejected.");
      router.push("/admin/verifications");
    } catch {
      toast.error("Failed to reject.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Verification not found.</p>
      </div>
    );
  }

  const profile = data.user.caregiver_profile;
  const canAct = data.status === "pending_review" || data.status === "not_started";

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/verifications"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to queue
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verification Review</h1>
          <p className="text-sm text-muted-foreground">
            {data.user.name} · {data.check_type.toUpperCase()}
          </p>
        </div>
        <Badge className={cn("text-sm", statusColors[data.status] || "bg-muted")}>
          {data.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Caregiver info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" /> Caregiver
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{data.user.name}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{data.user.email}</span>
            </div>
            {data.user.gender && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender</span>
                  <span className="font-medium capitalize">
                    {data.user.gender.replace("_", " ")}
                  </span>
                </div>
              </>
            )}
            {profile && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="font-medium">{profile.years_of_experience} years</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium">${profile.hourly_rate}/hr</span>
                </div>
                {profile.services.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-muted-foreground">Services</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {profile.services.map((s) => (
                          <Badge key={s.name} variant="secondary" className="text-xs">
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" /> Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(documentUrls).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(documentUrls).map(([key, url]) => (
                  <div key={key}>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                      {key.replace("_", " ")}
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-primary hover:bg-muted/50"
                    >
                      View Document →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review history */}
      {data.reviewer && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4 text-primary" /> Review History
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Reviewed by <strong>{data.reviewer.name}</strong> on{" "}
              {data.reviewed_at ? new Date(data.reviewed_at).toLocaleString() : "N/A"}
            </p>
            {data.admin_notes && (
              <p className="mt-1 text-muted-foreground">Notes: {data.admin_notes}</p>
            )}
            {data.rejection_reason && (
              <p className="mt-1 text-destructive">Rejection: {data.rejection_reason}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {canAct && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-primary" /> Decision
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes about this review..."
                rows={2}
              />
            </div>

            {showReject && (
              <div className="space-y-1.5 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <Label className="text-destructive">Rejection Reason (required)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this verification is being rejected..."
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="bg-success text-success-foreground hover:bg-success/80"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 size-4" />
                )}
                Approve
              </Button>

              {showReject ? (
                <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                  Confirm Rejection
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => setShowReject(true)}>
                  <XCircle className="mr-1 size-4" /> Reject
                </Button>
              )}

              {showReject && (
                <Button variant="outline" onClick={() => setShowReject(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
