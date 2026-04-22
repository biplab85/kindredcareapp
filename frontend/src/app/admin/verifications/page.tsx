"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface VerificationItem {
  id: number;
  check_type: string;
  status: string;
  updated_at: string;
  user: { id: number; name: string; email: string; role: string };
}

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  pending_review: "bg-warning/10 text-warning-foreground",
  cleared: "bg-success text-success-foreground",
  flagged: "bg-warning text-warning-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

const TABS = [
  { key: "pending_review", label: "Pending" },
  { key: "not_started", label: "Not Started" },
  { key: "cleared", label: "Cleared" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminVerificationsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Verifications">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <VerificationsContent />
        </div>
      </DashboardShell>
    </AuthGuard>
  );
}

function VerificationsContent() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending_review");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loadTrigger, setLoadTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/admin/verifications?status=${activeTab}`)
      .then((res) => {
        if (!cancelled) {
          setItems(res.data.data);
          setTotal(res.data.total);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to load verifications.");
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadTrigger]);

  const reload = () => setLoadTrigger((p) => p + 1);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/admin/verifications/${id}/approve`, { admin_notes: "" });
      toast.success("Verification approved.");
      reload();
    } catch {
      toast.error("Failed to approve.");
    }
  };

  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    try {
      await api.post(`/api/admin/verifications/${id}/reject`, {
        rejection_reason: rejectReason,
      });
      toast.success("Verification rejected.");
      setRejectingId(null);
      setRejectReason("");
      reload();
    } catch {
      toast.error("Failed to reject.");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Verification Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review caregiver documents and approve or reject verifications.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
        <span className="ml-2 flex items-center text-sm text-muted-foreground">{total} total</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ShieldCheck className="mb-4 size-12 text-muted-foreground/30" />
            <p className="font-medium">No verifications in this category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/verifications/${item.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {item.user.name}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {item.check_type}
                    </Badge>
                    <Badge className={cn("text-xs", statusColors[item.status] || "bg-muted")}>
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.user.email} · Updated {new Date(item.updated_at).toLocaleDateString()}
                  </p>

                  {rejectingId === item.id && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        className="h-9 text-sm"
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <Button size="sm" variant="destructive" onClick={() => handleReject(item.id)}>
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Link href={`/admin/verifications/${item.id}`}>
                    <Button variant="outline" size="icon-sm">
                      <Eye className="size-4" />
                    </Button>
                  </Link>
                  {(item.status === "pending_review" || item.status === "not_started") && (
                    <>
                      <Button
                        size="icon-sm"
                        className="bg-success text-success-foreground hover:bg-success/80"
                        onClick={() => handleApprove(item.id)}
                      >
                        <CheckCircle2 className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        onClick={() => setRejectingId(item.id)}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
