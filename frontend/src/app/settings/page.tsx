"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, LogOut, Shield, Trash2 } from "lucide-react";
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
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsView />
    </AuthGuard>
  );
}

function SettingsView() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.get("/api/me/data-export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kindredcare-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully.");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/api/me");
      useAuthStore.getState().clearAuth();
      toast.success("Account deleted.");
      router.push("/");
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      const res = await api.post("/api/me/logout-all");
      if (user) useAuthStore.getState().setAuth(user, res.data.token);
      toast.success("All other sessions have been revoked.");
    } catch {
      toast.error("Failed to revoke sessions.");
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <DashboardShell pageTitle="Settings">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            Your account, <span className="font-normal italic text-primary">in one place</span>.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Manage your session, export your data, or close your account.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">Your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Profile information.</p>

            <dl className="mt-5 grid gap-px overflow-hidden rounded-xl bg-border/50 ring-1 ring-border/60">
              <InfoRow label="Name" value={user?.name} />
              <InfoRow label="Email" value={user?.email} />
              <InfoRow label="Role" value={user?.role} mono />
              <InfoRow label="Phone" value={user?.phone || "not set"} mono />
            </dl>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">Sessions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Revoke other devices or sign out of this one.
            </p>

            <div className="mt-5 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
              >
                {isLoggingOutAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Shield className="size-4" strokeWidth={1.75} />
                )}
                Log out all other devices
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="size-4" strokeWidth={1.75} />
                Log out on this device
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6">
            <h2 className="text-base font-semibold tracking-tight">Data &amp; retention</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export your data as JSON, or close your account. Deletion starts a 30-day
              anonymisation; financial records are retained 7 years per CRA.
            </p>

            <div className="mt-5 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" strokeWidth={1.75} />
                )}
                Export my data
              </Button>

              <Dialog>
                <DialogTrigger
                  render={
                    <Button variant="destructive" className="w-full justify-start">
                      <Trash2 className="size-4" strokeWidth={1.75} />
                      Delete my account
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    This can&rsquo;t be undone. Personal data is scrubbed within 30 days; financial
                    records are retained for 7 years per CRA requirements.
                  </DialogDescription>
                  <div className="flex justify-end gap-2 pt-4">
                    <DialogClose render={<Button variant="outline">Cancel</Button>} />
                    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting && <Loader2 className="size-4 animate-spin" />}
                      Yes, delete my account
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | undefined | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 bg-card px-4 py-3.5">
      <dt className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-sm text-foreground capitalize"
            : "text-sm font-medium text-foreground"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
