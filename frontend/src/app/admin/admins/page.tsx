"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Loader2,
  Pencil,
  Plus,
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
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <Header />

        <Controls onCreate={() => setShowCreate(true)} onRefresh={() => void reload()} />

        <ResultMeta total={admins.length} state={state} />

        <div className="mt-6 space-y-6">
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header>
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Admins
        <span className="text-foreground/30">— § 45</span>
      </div>

      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">The roster</span> behind the desk.
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Add new admins, rename existing ones, or deactivate when someone leaves the team. New
        accounts get a randomized password — they claim it via the password-reset flow. TOTP
        enforcement ships with Phase 15 hardening.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Controls
 * ───────────────────────────────────────────────────────────── */

function Controls({ onCreate, onRefresh }: { onCreate: () => void; onRefresh: () => void }) {
  return (
    <section
      aria-label="Actions"
      className="mt-8 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={onCreate} size="sm">
          <UserPlus className="size-3.5" strokeWidth={2} />
          New admin
        </Button>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="size-3.5" strokeWidth={2} />
          Refresh
        </Button>
      </div>
    </section>
  );
}

function ResultMeta({ total, state }: { total: number; state: LoadState }) {
  return (
    <div className="mt-8 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-8 bg-foreground/30" />
      <span>
        {state === "loading" ? (
          "Loading…"
        ) : (
          <>
            <span className="font-mono tabular-nums text-foreground/80">{total}</span>{" "}
            {total === 1 ? "admin" : "admins"}
          </>
        )}
      </span>
      <span className="text-foreground/30">— § 46</span>
    </div>
  );
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
    <section className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-primary/15 text-primary">
          <Plus className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-primary uppercase">
            New admin
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">
            <span className="font-normal italic">Add a teammate</span> to the desk.
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
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
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
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary/50"
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button onClick={onCancel} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={busy} size="sm">
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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
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

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5",
        isSuspended && "border-foreground/20 bg-foreground/[0.03] opacity-80",
        isDeleted && "border-foreground/20 bg-foreground/[0.05] opacity-60",
        !isSuspended && !isDeleted && "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {isEditing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" id={`name-${admin.id}`}>
                <input
                  id={`name-${admin.id}`}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <Field label="Email" id={`email-${admin.id}`}>
                <input
                  id={`email-${admin.id}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary/50"
                />
              </Field>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-semibold tracking-tight sm:text-lg">{admin.name}</h3>
                {isMe && (
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/[0.06] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-primary uppercase">
                    You
                  </span>
                )}
                {isSuspended && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
                    <ShieldOff className="size-2.5" strokeWidth={2.25} />
                    Deactivated
                  </span>
                )}
                {isDeleted && (
                  <span className="inline-flex items-center rounded-full border border-foreground/25 bg-foreground/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-foreground/70 uppercase">
                    Deleted
                  </span>
                )}
                {admin.two_factor_enabled && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/[0.07] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-success uppercase">
                    <BadgeCheck className="size-2.5" strokeWidth={2.25} />
                    2FA
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] tracking-[0.05em] text-muted-foreground tabular-nums">
                {admin.email}
                {admin.created_at &&
                  ` · joined ${new Date(admin.created_at).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`}
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isEditing ? (
            <>
              <Button onClick={onCancelEdit} variant="outline" size="sm" disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={busy} size="sm">
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
                <Button onClick={onEdit} variant="outline" size="sm">
                  <Pencil className="size-3.5" strokeWidth={2} />
                  Edit
                </Button>
              )}
              {!isDeleted && !isSuspended && !isMe && (
                <Button onClick={onDeactivate} disabled={busy} variant="destructive" size="sm">
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
        <li
          key={i}
          className="h-[88px] animate-pulse rounded-2xl border border-border/60 bg-card/60"
        />
      ))}
    </ul>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-accent/40 bg-accent/[0.04] p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
          <AlertCircle className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight">Couldn&apos;t load the roster.</h3>
          <div className="mt-4">
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="size-3.5" strokeWidth={2} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
