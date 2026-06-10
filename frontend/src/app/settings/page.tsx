"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Database,
  Download,
  Landmark,
  Loader2,
  LogOut,
  Pencil,
  Shield,
  Trash2,
  UserRound,
  type LucideIcon,
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
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
      <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
            Settings
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Manage your account, sessions, and data.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          {/* ─── Account ─── */}
          <Section icon={UserRound} title="Your account" description="Your profile information.">
            <dl className="divide-y divide-border/60">
              <InfoRow label="Name" value={user?.name} />
              <InfoRow label="Email" value={user?.email} />
              <InfoRow label="Role" value={user?.role} badge />
              <InfoRow label="Phone" value={user?.phone || "Not set"} />
            </dl>
            <div className="mt-5 border-t border-border pt-4">
              <Link href="/profile/edit">
                <Button variant="outline" size="sm">
                  <Pencil className="size-3.5" />
                  Edit profile
                </Button>
              </Link>
            </div>
          </Section>

          {/* ─── Money ─── */}
          {user?.role === "family" && (
            <MoneyLinkCard
              icon={CreditCard}
              title="Payment methods"
              description="The card we charge when a visit ends. You can change it anytime."
              href="/settings/payment-methods"
            />
          )}

          {user?.role === "caregiver" && (
            <MoneyLinkCard
              icon={Landmark}
              title="Payouts"
              description="Where your earnings land. Connect your bank through Stripe."
              href="/settings/payouts"
            />
          )}

          {/* ─── Sessions ─── */}
          <Section
            icon={Shield}
            title="Sessions"
            description="Revoke other devices or sign out of this one."
          >
            <div className="space-y-2.5">
              <ActionRow
                icon={Shield}
                title="Log out all other devices"
                description="Revoke access on every other signed-in device."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogoutAll}
                    disabled={isLoggingOutAll}
                  >
                    {isLoggingOutAll ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Log out
                  </Button>
                }
              />
              <ActionRow
                icon={LogOut}
                title="Log out on this device"
                description="Sign out of this browser."
                action={
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Log out
                  </Button>
                }
              />
            </div>
          </Section>

          {/* ─── Data & retention ─── */}
          <Section
            icon={Database}
            title="Data & retention"
            description="Export your data or close your account."
          >
            <div className="space-y-2.5">
              <ActionRow
                icon={Download}
                title="Export my data"
                description="Download everything we hold about you as a JSON file."
                action={
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Export
                  </Button>
                }
              />
              <ActionRow
                tone="destructive"
                icon={Trash2}
                title="Delete my account"
                description="Personal data is scrubbed within 30 days; financial records are kept 7 years (CRA)."
                action={
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogTitle>Delete your account?</DialogTitle>
                      <DialogDescription>
                        This can&rsquo;t be undone. Personal data is scrubbed within 30 days;
                        financial records are retained for 7 years per CRA requirements.
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
                }
              />
            </div>
          </Section>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Building blocks
 * ───────────────────────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: React.ReactNode;
  tone?: "default" | "destructive";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-colors",
        tone === "destructive"
          ? "border-destructive/30 bg-destructive/[0.03]"
          : "border-border hover:bg-muted/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground/70",
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              tone === "destructive" ? "text-destructive" : "text-foreground",
            )}
          >
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function MoneyLinkCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-6"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        strokeWidth={2}
      />
    </Link>
  );
}

function InfoRow({
  label,
  value,
  badge = false,
}: {
  label: string;
  value: string | undefined | null;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize ring-1 ring-primary/20">
            {value ?? "—"}
          </span>
        ) : (
          <span className="text-sm font-medium text-foreground">{value ?? "—"}</span>
        )}
      </dd>
    </div>
  );
}
