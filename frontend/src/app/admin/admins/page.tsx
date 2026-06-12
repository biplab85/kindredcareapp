"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type AdminAccount,
  createAdmin,
  deactivateAdmin,
  listAdmins,
  updateAdmin,
} from "@/lib/admin-admins";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function AdminAccountsPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <DashboardShell pageTitle="Admin accounts">
        <AdminsView />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

type LoadState = "loading" | "ready" | "error";

const INPUT_CLASS =
  "h-[38px] w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/50";

function AdminsView() {
  const { user: me } = useAuthStore();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setState("loading");
    try {
      const list = await listAdmins();
      setAdmins(list);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listAdmins();
        if (!alive) return;
        setAdmins(list);
        setState("ready");
      } catch {
        if (!alive) return;
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="max-w-4xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Header + actions */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
            Admin accounts
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add new admins, rename existing ones, or deactivate when someone leaves the team. New
            accounts get a randomized password — they claim it via the password-reset flow. TOTP
            enforcement ships with Phase 15 hardening.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => setShowCreate(true)}
            size="sm"
            className="cursor-pointer"
            disabled={showCreate}
          >
            <UserPlus className="size-3.5" strokeWidth={2} />
            New admin
          </Button>
          <Button
            onClick={() => void reload()}
            variant="outline"
            size="sm"
            className="cursor-pointer"
          >
            <RefreshCw
              className={cn("size-3.5", state === "loading" && "animate-spin")}
              strokeWidth={2}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <ResultMeta total={admins.length} state={state} />
      </div>

      <div className="space-y-3">
        {showCreate && (
          <CreateForm
            onCancel={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              void reload();
            }}
          />
        )}

        {state === "loading" && <LoadingView />}
        {state === "error" && <ErrorCard onRetry={() => void reload()} />}
        {state !== "error" && (
          <ul className="space-y-3">
            {admins.map((a) => (
              <li key={a.id}>
                <AdminCard
                  admin={a}
                  isMe={a.id === me?.id}
                  isEditing={editingId === a.id}
                  onEdit={() => setEditingId(a.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onMutated={() => {
                    setEditingId(null);
                    void reload();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultMeta({ total, state }: { total: number; state: LoadState }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {state === "loading" ? (
        <span className="text-muted-foreground">Loading…</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-muted-foreground">{total === 1 ? "admin" : "admins"}</span>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Field + helpers
 * ───────────────────────────────────────────────────────────── */

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────
 * Create form
 * ───────────────────────────────────────────────────────────── */

function CreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (name.trim().length === 0 || email.trim().length === 0) {
      toast.error("Name and email are required.");
      return;
    }
    setBusy(true);
    try {
      await createAdmin({ name: name.trim(), email: email.trim() });
      toast.success(
        `Admin created. Have ${name.split(" ")[0]} use "Forgot password" to claim their account.`,
      );
      onCreated();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 422 ? "Email already in use." : "Couldn't create admin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/[0.03] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <UserPlus className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
            New admin
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
            Add a teammate to the desk.
          </h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" id="new-name">
              <input
                id="new-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Jordan Lee"
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Email" id="new-email">
              <input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder="jordan@kindredcare.ca"
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button onClick={onCancel} variant="outline" size="sm" className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={busy} size="sm" className="cursor-pointer">
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <UserPlus className="size-3.5" strokeWidth={2} />
              )}
              Create admin
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Admin card (with inline edit + deactivate)
 * ───────────────────────────────────────────────────────────── */

function AdminCard({
  admin,
  isMe,
  isEditing,
  onEdit,
  onCancelEdit,
  onMutated,
}: {
  admin: AdminAccount;
  isMe: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onMutated: () => void;
}) {
  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    try {
      const payload: { name?: string; email?: string } = {};
      if (name.trim() !== admin.name) payload.name = name.trim();
      if (email.trim() !== admin.email) payload.email = email.trim();
      if (Object.keys(payload).length === 0) {
        toast.message("No changes.");
        onCancelEdit();
        return;
      }
      await updateAdmin(admin.id, payload);
      toast.success(`${admin.name} updated.`);
      onMutated();
    } catch {
      toast.error("Couldn't save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    setBusy(true);
    try {
      await deactivateAdmin(admin.id);
      toast.success(`${admin.name} deactivated.`);
      onMutated();
    } catch {
      toast.error("Couldn't deactivate.");
    } finally {
      setBusy(false);
    }
  }

  const isSuspended = admin.status === "suspended";
  const isDeleted = admin.status === "deleted";
  const dimmed = isSuspended || isDeleted;

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-5",
        dimmed ? "border-border bg-muted/20" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {isEditing ? (
          <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
            <Field label="Name" id={`name-${admin.id}`}>
              <input
                id={`name-${admin.id}`}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Email" id={`email-${admin.id}`}>
              <input
                id={`email-${admin.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold",
                dimmed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {initialsOf(admin.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  {admin.name}
                </h3>
                {isMe && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    You
                  </span>
                )}
                {isSuspended && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
                    <ShieldOff className="size-3" strokeWidth={2.25} />
                    Deactivated
                  </span>
                )}
                {isDeleted && (
                  <span className="inline-flex items-center rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
                    Deleted
                  </span>
                )}
                {admin.two_factor_enabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                    <BadgeCheck className="size-3" strokeWidth={2.25} />
                    2FA
                  </span>
                )}
              </div>
              <p className="mt-1 inline-flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
                <Mail className="size-3.5 text-muted-foreground/70" strokeWidth={2} />
                {admin.email}
                {admin.created_at && (
                  <span className="text-muted-foreground/70 tabular-nums">
                    {" · "}joined{" "}
                    {new Date(admin.created_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {isEditing ? (
            <>
              <Button
                onClick={onCancelEdit}
                variant="outline"
                size="sm"
                disabled={busy}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button onClick={onSave} disabled={busy} size="sm" className="cursor-pointer">
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <ShieldCheck className="size-3.5" strokeWidth={2} />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              {!isDeleted && !isSuspended && (
                <Button onClick={onEdit} variant="outline" size="sm" className="cursor-pointer">
                  <Pencil className="size-3.5" strokeWidth={2} />
                  Edit
                </Button>
              )}
              {!isDeleted && !isSuspended && !isMe && (
                <Button
                  onClick={onDeactivate}
                  disabled={busy}
                  variant="destructive"
                  size="sm"
                  className="cursor-pointer"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <UserX className="size-3.5" strokeWidth={2} />
                  )}
                  Deactivate
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Loading / error
 * ───────────────────────────────────────────────────────────── */

function LoadingView() {
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-accent/40 bg-accent/[0.04] px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <AlertCircle className="size-7" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
        Couldn&apos;t load the roster.
      </h3>
      <Button onClick={onRetry} size="sm" className="mt-4 cursor-pointer">
        <RefreshCw className="size-3.5" strokeWidth={2} />
        Retry
      </Button>
    </div>
  );
}
