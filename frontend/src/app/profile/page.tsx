"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  Globe,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Sparkles,
  Star,
  UserCircle,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  type CaregiverProfileSummary,
  type CareRecipientSummary,
  type FamilyProfileSummary,
  useAuthStore,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

/**
 * /profile is the read-only view of who you are on KindredCare. All
 * mutations live at /profile/edit — keeping the surfaces separate means
 * the view doesn't fight the editor for screen real estate.
 */
export default function ProfilePage() {
  return (
    <AuthGuard roles={["caregiver", "family"]}>
      <ProfileView />
    </AuthGuard>
  );
}

interface ProfileCompletionPayload {
  percentage: number;
  is_matchable: boolean;
}

interface MeResponse {
  user: {
    id: number;
    role: "family" | "caregiver" | "admin";
    name: string;
    email: string;
    phone: string | null;
    email_verified_at: string | null;
    phone_verified_at: string | null;
    caregiver_profile?: CaregiverProfileSummary | null;
    family_profile?: FamilyProfileSummary | null;
  };
  profile_completion?: ProfileCompletionPayload;
  is_fully_verified?: boolean;
}

function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const [completion, setCompletion] = useState<ProfileCompletionPayload | null>(null);

  // Just fetch the completion payload. The user object is already loaded by
  // AuthGuard, so we don't refetch it here.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<MeResponse>("/api/me");
        if (alive && res.data.profile_completion) {
          setCompletion(res.data.profile_completion);
        }
      } catch {
        // Failures leave completion null — the status falls back to "Setup
        // needed" and the cards still render.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!user) {
    return (
      <DashboardShell pageTitle="Profile">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  const isCaregiver = user.role === "caregiver";
  const profile = isCaregiver ? (user.caregiver_profile ?? null) : null;
  const photoUrl = isCaregiver ? resolvePhotoUrl(profile?.photo_path) : null;
  const matchable = isCaregiver ? (completion?.is_matchable ?? false) : true;

  return (
    <DashboardShell pageTitle="Profile">
      <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <ProfileHero
          user={user}
          isCaregiver={isCaregiver}
          profile={profile}
          photoUrl={photoUrl}
          matchable={matchable}
          completion={completion}
        />

        <div className="mt-6">
          {isCaregiver ? (
            <CaregiverLayout user={user} profile={profile} />
          ) : (
            <FamilyLayout user={user} profile={user.family_profile ?? null} />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Hero
 * ───────────────────────────────────────────────────────────── */

function ProfileHero({
  user,
  isCaregiver,
  profile,
  photoUrl,
  matchable,
  completion,
}: {
  user: { name: string };
  isCaregiver: boolean;
  profile: CaregiverProfileSummary | null;
  photoUrl: string | null;
  matchable: boolean;
  completion: ProfileCompletionPayload | null;
}) {
  const rate =
    profile?.hourly_rate != null && profile.hourly_rate !== ""
      ? `$${Number(profile.hourly_rate).toFixed(0)}`
      : "—";
  const years = profile?.years_of_experience != null ? `${profile.years_of_experience}` : "—";
  const languageCount = normalizeStringArray(profile?.languages).length;
  const serviceCount = (profile?.services ?? []).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Cover band */}
      <div className="relative h-24 bg-gradient-to-r from-primary/20 via-primary/8 to-accent/15 sm:h-28">
        <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_80%_0%,oklch(1_0_0/0.35),transparent_55%)]" />
      </div>

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            {/* Avatar overlapping the cover */}
            <div className="relative -mt-12 shrink-0 sm:-mt-14">
              {photoUrl ? (
                <div className="relative size-24 overflow-hidden rounded-2xl bg-muted shadow-md ring-4 ring-card">
                  <Image
                    src={photoUrl}
                    alt={user.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="grid size-24 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-card text-2xl font-semibold tracking-tight text-foreground shadow-md ring-4 ring-card">
                  {initials(user.name)}
                </div>
              )}
              {isCaregiver && matchable && (
                <span
                  title="Matchable"
                  className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-card"
                >
                  <BadgeCheck className="size-4" strokeWidth={2.25} />
                </span>
              )}
            </div>

            <div className="min-w-0 pb-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {user.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                  {isCaregiver ? "Caregiver" : "Family · Host"}
                </span>
                {isCaregiver ? (
                  <StatusPill matchable={matchable} />
                ) : (
                  <span className="text-xs text-muted-foreground">Booking on KindredCare</span>
                )}
              </div>
            </div>
          </div>

          <Link href="/profile/edit" className="shrink-0">
            <Button className="gap-2">
              <Pencil className="size-4" strokeWidth={2.25} />
              Edit profile
              <ArrowRight className="size-4" strokeWidth={2.25} />
            </Button>
          </Link>
        </div>

        {/* Profile strength */}
        {isCaregiver && completion && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Profile strength</span>
              <span className="font-semibold text-foreground tabular-nums">
                {completion.percentage}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, completion.percentage))}%` }}
              />
            </div>
          </div>
        )}

        {/* Stat tiles */}
        {isCaregiver && profile && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={DollarSign}
              label="Hourly rate"
              value={rate}
              suffix={rate !== "—" ? "/hr" : ""}
              tone="emerald"
            />
            <StatTile
              icon={Briefcase}
              label="Experience"
              value={years}
              suffix={years !== "—" ? "yrs" : ""}
              tone="sky"
            />
            <StatTile icon={Globe} label="Languages" value={String(languageCount)} tone="violet" />
            <StatTile icon={Heart} label="Services" value={String(serviceCount)} tone="amber" />
          </div>
        )}
      </div>
    </div>
  );
}

const STAT_TONES: Record<"emerald" | "sky" | "violet" | "amber", { wrap: string; icon: string }> = {
  emerald: {
    wrap: "from-emerald-50 ring-emerald-200/70",
    icon: "bg-emerald-500/15 text-emerald-600",
  },
  sky: { wrap: "from-sky-50 ring-sky-200/70", icon: "bg-sky-500/15 text-sky-600" },
  violet: { wrap: "from-violet-50 ring-violet-200/70", icon: "bg-violet-500/15 text-violet-600" },
  amber: { wrap: "from-amber-50 ring-amber-200/70", icon: "bg-amber-500/15 text-amber-600" },
};

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  suffix?: string;
  tone: keyof typeof STAT_TONES;
}) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={cn(
        "rounded-xl border border-transparent bg-gradient-to-br to-card p-3 ring-1 transition-shadow hover:shadow-sm",
        t.wrap,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", t.icon)}>
          <Icon className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      <p className="mt-2 text-lg font-bold tracking-tight text-foreground tabular-nums">
        {value}
        {suffix ? (
          <span className="ml-0.5 text-xs font-medium text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}

function StatusPill({ matchable }: { matchable: boolean }) {
  if (matchable) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success ring-1 ring-success/30">
        <CheckCircle2 className="size-3" strokeWidth={2.5} />
        Matchable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
      Setup needed
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared chrome
 * ───────────────────────────────────────────────────────────── */

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        {Icon ? (
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" strokeWidth={2} />
          </div>
        ) : null}
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  verified,
  copyable,
}: {
  label: string;
  value: React.ReactNode;
  verified?: boolean;
  copyable?: string;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {isEmpty ? (
          <span className="text-sm text-muted-foreground/60">Not set yet</span>
        ) : (
          <span className="text-sm font-medium text-foreground">{value}</span>
        )}
        {verified && !isEmpty ? <VerifiedBadge /> : null}
        {copyable && !isEmpty ? <CopyButton value={copyable} /> : null}
      </div>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success ring-1 ring-success/30">
      <CheckCircle2 className="size-3" strokeWidth={2.5} />
      Verified
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    try {
      navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — quietly no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <Check className="size-3.5 text-success" strokeWidth={2.5} />
      ) : (
        <Copy className="size-3.5" strokeWidth={2} />
      )}
    </button>
  );
}

function Empty({
  message,
  icon: Icon,
}: {
  message: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-muted to-card text-muted-foreground/70 ring-1 ring-border">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href="/profile/edit"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
      >
        Add from Edit profile
        <ArrowRight className="size-3.5" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

function ChipRow({
  items,
  emptyIcon,
}: {
  items: string[];
  emptyIcon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  if (items.length === 0) {
    return <Empty message="Nothing added yet." icon={emptyIcon} />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Cards
 * ───────────────────────────────────────────────────────────── */

function ContactCard({
  user,
}: {
  user: {
    name: string;
    email: string;
    phone: string | null;
    email_verified_at: string | null;
    phone_verified_at: string | null;
  };
}) {
  return (
    <Card title="Contact" icon={Mail}>
      <Row label="Name" value={user.name} />
      <Row
        label="Email"
        value={user.email}
        verified={user.email_verified_at !== null}
        copyable={user.email}
      />
      <Row
        label="Phone"
        value={user.phone}
        verified={user.phone_verified_at !== null}
        copyable={user.phone ?? undefined}
      />
    </Card>
  );
}

function GetStartedCard({ role }: { role: "caregiver" | "family" }) {
  return (
    <Card title="Get started" icon={Sparkles}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {role === "caregiver"
          ? "You haven’t started your caregiver profile yet. Head to the editor to introduce yourself to families."
          : "You haven’t started your family profile yet. Head to the editor to tell us who you’re booking care for."}
      </p>
      <Link href="/profile/edit" className="mt-4 inline-block">
        <Button>
          Start editing
          <ArrowRight className="size-4" strokeWidth={2.25} />
        </Button>
      </Link>
    </Card>
  );
}

function CaregiverLayout({
  user,
  profile,
}: {
  user: {
    name: string;
    email: string;
    phone: string | null;
    email_verified_at: string | null;
    phone_verified_at: string | null;
  };
  profile: CaregiverProfileSummary | null;
}) {
  if (!profile) {
    return <GetStartedCard role="caregiver" />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
      {/* Main column */}
      <div className="space-y-5 lg:col-span-2">
        <ContactCard user={user} />

        <Card title="Location" icon={MapPin}>
          <Row label="Address" value={profile.address ?? null} />
          <Row label="Postal code" value={profile.postal_code ?? null} />
          <Row
            label="Travel radius"
            value={profile.travel_radius_km ? `${profile.travel_radius_km} km` : null}
          />
        </Card>

        <Card title="Bio & experience" icon={UserCircle}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Bio
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {profile.bio ?? (
                  <span className="text-muted-foreground/70">
                    No bio yet — families love seeing your voice come through here.
                  </span>
                )}
              </p>
            </div>
            <div className="border-t border-border/60 pt-3">
              <Row label="Years of experience" value={profile.years_of_experience ?? null} />
            </div>
          </div>
        </Card>

        <Card title="Rate" icon={DollarSign}>
          <RateBlock hourlyRate={profile.hourly_rate ?? null} />
        </Card>

        <Card title="Certifications" icon={ClipboardCheck}>
          <CertificationsList certifications={profile.certifications ?? []} />
        </Card>

        <Card title="References" icon={Star}>
          <ReferencesList references={profile.references ?? []} />
        </Card>
      </div>

      {/* Sidebar */}
      <aside className="space-y-5 lg:sticky lg:top-24">
        <Card title="Languages" icon={Globe}>
          <ChipRow items={normalizeStringArray(profile.languages)} emptyIcon={Globe} />
        </Card>

        <Card title="Services" icon={Briefcase}>
          <ChipRow items={(profile.services ?? []).map((s) => s.name)} emptyIcon={Briefcase} />
        </Card>

        <Card title="Personality" icon={Heart}>
          <ChipRow items={normalizeStringArray(profile.personality_tags)} emptyIcon={Heart} />
        </Card>
      </aside>
    </div>
  );
}

function RateBlock({ hourlyRate }: { hourlyRate: string | number | null }) {
  const rateNumber = (() => {
    if (hourlyRate === null || hourlyRate === undefined || hourlyRate === "") return null;
    const n = typeof hourlyRate === "number" ? hourlyRate : Number(hourlyRate);
    return Number.isFinite(n) ? n : null;
  })();

  if (rateNumber === null) {
    return <Empty message="Hourly rate not set yet." icon={DollarSign} />;
  }

  const familyPays = rateNumber * 1.075;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Featured rate */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/12 to-primary/[0.02] p-5 ring-1 ring-primary/15">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-primary/15 blur-2xl"
        />
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <DollarSign className="size-3.5" strokeWidth={2.5} />
          Your hourly rate
        </div>
        <p className="mt-2 font-bold tracking-tight text-foreground">
          <span className="text-4xl tabular-nums">${rateNumber.toFixed(2)}</span>
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ hour</span>
        </p>
      </div>

      {/* Breakdown */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 first:pt-0">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-success" strokeWidth={2.5} />
            You keep
          </span>
          <span className="text-sm font-bold text-success tabular-nums">
            ${rateNumber.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2">
          <span className="text-sm text-muted-foreground">Family pays</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            ${familyPays.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-sm text-muted-foreground">Platform fee</span>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">+7.5%</span>
        </div>
      </div>
    </div>
  );
}

function CertificationsList({
  certifications,
}: {
  certifications: NonNullable<CaregiverProfileSummary["certifications"]>;
}) {
  if (certifications.length === 0) {
    return <Empty message="No certifications added yet." icon={ClipboardCheck} />;
  }

  // Verified first, then pending, then rejected/self-reported.
  const rank: Record<
    NonNullable<CaregiverProfileSummary["certifications"]>[number]["status"],
    number
  > = {
    verified: 0,
    pending_review: 1,
    rejected: 2,
    self_reported: 3,
    expired: 4,
  };
  const sorted = [...certifications].sort((a, b) => rank[a.status] - rank[b.status]);

  return (
    <div className="space-y-2">
      {sorted.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              {c.name}
              <CertStatusPill status={c.status} />
            </p>
            {c.issuer ? <p className="mt-0.5 text-xs text-muted-foreground">{c.issuer}</p> : null}
          </div>
          {c.year ? (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{c.year}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReferencesList({
  references,
}: {
  references: NonNullable<CaregiverProfileSummary["references"]>;
}) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  if (references.length === 0) {
    return <Empty message="No references on file yet." icon={Star} />;
  }

  return (
    <div className="space-y-3">
      {references.map((r, i) => {
        const isOpen = !!revealed[i];
        return (
          <div
            key={`${r.name}-${i}`}
            className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                {r.relationship ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.relationship}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setRevealed((prev) => ({ ...prev, [i]: !isOpen }))}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {isOpen ? (
                  <>
                    <EyeOff className="size-3.5" strokeWidth={2.25} />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5" strokeWidth={2.25} />
                    Show contact
                  </>
                )}
              </button>
            </div>
            {isOpen ? (
              <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs text-foreground/90">
                {r.email ? (
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Email</span>
                    {r.email}
                  </p>
                ) : null}
                {r.phone ? (
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Phone</span>
                    {r.phone}
                  </p>
                ) : null}
                {!r.email && !r.phone ? (
                  <p className="text-muted-foreground">No contact info on file.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FamilyLayout({
  user,
  profile,
}: {
  user: {
    name: string;
    email: string;
    phone: string | null;
    email_verified_at: string | null;
    phone_verified_at: string | null;
  };
  profile: FamilyProfileSummary | null;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
      <div className="space-y-5 lg:col-span-2">
        <ContactCard user={user} />
        <Card title="Care recipients" icon={Users}>
          <RecipientsList recipients={profile?.care_recipients ?? []} />
        </Card>
      </div>
      <aside className="space-y-5">{!profile ? <GetStartedCard role="family" /> : null}</aside>
    </div>
  );
}

function RecipientsList({ recipients }: { recipients: CareRecipientSummary[] }) {
  if (recipients.length === 0) {
    return <Empty message="No care recipients added yet." icon={Users} />;
  }
  return (
    <div className="space-y-3">
      {recipients.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
        >
          <p className="text-sm font-semibold text-foreground">{r.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[r.age ? `${r.age} yrs` : null, r.language || null, r.postal_code || null]
              .filter(Boolean)
              .join(" · ") || "Details not set yet"}
          </p>
          {r.street_address ? (
            <p className="mt-2 text-xs text-muted-foreground">{r.street_address}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

function normalizeStringArray(input: string[] | null | undefined): string[] {
  if (!input) return [];
  return input.map((s) => String(s)).filter((s) => s.trim().length > 0);
}

function resolvePhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}/storage/${path.replace(/^\/+/, "")}`;
}

function CertStatusPill({
  status,
}: {
  status: NonNullable<CaregiverProfileSummary["certifications"]>[number]["status"];
}) {
  const map: Record<typeof status, { label: string; cls: string }> = {
    verified: { label: "Verified", cls: "bg-success/10 text-success ring-success/30" },
    pending_review: { label: "Pending", cls: "bg-primary/10 text-primary ring-primary/30" },
    rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive ring-destructive/30" },
    self_reported: { label: "Self-reported", cls: "bg-muted text-muted-foreground ring-border" },
    expired: { label: "Expired", cls: "bg-accent/10 text-accent ring-accent/30" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}
