"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  Car,
  ChefHat,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Flower2,
  Footprints,
  Globe,
  Heart,
  Loader2,
  type LucideIcon,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShoppingBag,
  Smartphone,
  Sparkles,
  SprayCan,
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

// Maps a service category's `icon` string (from the API) to its lucide glyph.
const SERVICE_ICONS: Record<string, LucideIcon> = {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
};

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
        <LinkedInProfile
          user={user}
          isCaregiver={isCaregiver}
          profile={profile}
          familyProfile={user.family_profile ?? null}
          photoUrl={photoUrl}
          matchable={matchable}
          completion={completion}
        />
      </div>
    </DashboardShell>
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

/* Per-service rows — each service with its own years-of-experience value. */
function ServicesList({
  services,
}: {
  services: NonNullable<CaregiverProfileSummary["services"]>;
}) {
  if (services.length === 0) {
    return <Empty message="No services added yet." icon={Briefcase} />;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {services.map((s) => {
        const Icon = SERVICE_ICONS[s.icon ?? ""] ?? Briefcase;
        const years = s.pivot?.years_experience ?? 0;
        return (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 transition-colors hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" strokeWidth={1.875} />
              </span>
              <span className="truncate text-sm font-medium text-foreground">{s.name}</span>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums ring-1 ring-border">
              {years === 0 ? "New" : `${years} yr${years === 1 ? "" : "s"}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Cards
 * ───────────────────────────────────────────────────────────── */

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
          <span className="text-base tabular-nums">${rateNumber.toFixed(2)}</span>
          <span className="ml-1 text-sm font-normal text-muted-foreground">/hr</span>
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

/* ─────────────────────────────────────────────────────────────
 * Profile layout — LinkedIn-style. Read-only; all mutations live at
 * /profile/edit. Reuses the shared pure helpers (RateBlock,
 * CertificationsList, ChipRow, RecipientsList, Empty, StatusPill, …).
 * ───────────────────────────────────────────────────────────── */

function deriveHeadline(isCaregiver: boolean, profile: CaregiverProfileSummary | null): string {
  if (!isCaregiver) return "Arranging trusted care on KindredCare";
  const bio = profile?.bio?.trim();
  if (bio) {
    const first = bio.split(/(?<=[.!?])\s/)[0] ?? bio;
    return first.length > 120 ? `${first.slice(0, 117)}…` : first;
  }
  const services = (profile?.services ?? []).map((s) => s.name);
  if (services.length) return services.slice(0, 3).join(" · ");
  return "Caregiver on KindredCare";
}

function LinkedInProfile({
  user,
  isCaregiver,
  profile,
  familyProfile,
  photoUrl,
  matchable,
  completion,
}: {
  user: {
    name: string;
    email: string;
    phone: string | null;
    email_verified_at: string | null;
    phone_verified_at: string | null;
  };
  isCaregiver: boolean;
  profile: CaregiverProfileSummary | null;
  familyProfile: FamilyProfileSummary | null;
  photoUrl: string | null;
  matchable: boolean;
  completion: ProfileCompletionPayload | null;
}) {
  if (isCaregiver && !profile) {
    return <GetStartedCard role="caregiver" />;
  }

  const headline = deriveHeadline(isCaregiver, profile);
  const location =
    [profile?.address, profile?.postal_code].filter((v) => v && String(v).trim()).join(" · ") ||
    null;
  const rate =
    profile?.hourly_rate != null && profile.hourly_rate !== ""
      ? `$${Number(profile.hourly_rate).toFixed(0)}/hr`
      : null;
  const years =
    profile?.years_of_experience != null ? `${profile.years_of_experience} yrs experience` : null;
  const langs = normalizeStringArray(profile?.languages);
  const services = (profile?.services ?? []).map((s) => s.name);

  const facts = [
    rate,
    years,
    langs.length ? `${langs.length} language${langs.length === 1 ? "" : "s"}` : null,
    services.length ? `${services.length} service${services.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      {/* Main column */}
      <div className="space-y-5">
        {/* Intro / hero */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="relative h-32 bg-gradient-to-r from-primary/25 via-primary/10 to-accent/20 sm:h-40">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(120%_140%_at_80%_0%,oklch(1_0_0/0.35),transparent_55%)]"
            />
          </div>

          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              {/* circular avatar overlapping the cover */}
              <div className="relative -mt-14 shrink-0 sm:-mt-16">
                {photoUrl ? (
                  <div className="relative size-28 overflow-hidden rounded-full bg-muted shadow-md ring-4 ring-card sm:size-32">
                    <Image
                      src={photoUrl}
                      alt={user.name}
                      fill
                      className="object-cover"
                      sizes="128px"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="grid size-28 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-card text-3xl font-semibold tracking-tight text-foreground shadow-md ring-4 ring-card sm:size-32">
                    {initials(user.name)}
                  </div>
                )}
                {isCaregiver && matchable && (
                  <span
                    title="Verified · Matchable"
                    className="absolute right-1 bottom-1 grid size-8 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-card"
                  >
                    <BadgeCheck className="size-4" strokeWidth={2.25} />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pb-1">
                <Link href="/profile/edit">
                  <Button className="gap-2">
                    <Pencil className="size-4" strokeWidth={2.25} />
                    Edit profile
                  </Button>
                </Link>
              </div>
            </div>

            {/* identity */}
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{user.name}</h1>
                {isCaregiver && matchable && (
                  <BadgeCheck
                    className="size-5 text-primary"
                    strokeWidth={2.25}
                    aria-label="Verified"
                  />
                )}
              </div>
              {headline && (
                <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-foreground/80">
                  {headline}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" strokeWidth={2} />
                    {location}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium ring-1 ring-border">
                  {isCaregiver ? "Caregiver" : "Family · Host"}
                </span>
                {isCaregiver && <StatusPill matchable={matchable} />}
              </div>

              {facts.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground/80">
                  {facts.map((f, i) => (
                    <span key={f} className="inline-flex items-center gap-3 tabular-nums">
                      {i > 0 && (
                        <span aria-hidden className="text-border">
                          •
                        </span>
                      )}
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stacked sections — single wide column, LinkedIn-style */}
        {isCaregiver ? (
          <>
            <LiSection title="About">
              {profile?.bio ? (
                <p className="text-sm leading-relaxed text-foreground/90">{profile.bio}</p>
              ) : (
                <Empty
                  message="No bio yet — families love seeing your voice here."
                  icon={UserCircle}
                />
              )}
            </LiSection>

            <LiSection title="Services">
              <ServicesList services={profile?.services ?? []} />
            </LiSection>

            <LiSection title="Skills & languages">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Languages
                  </p>
                  <ChipRow items={langs} emptyIcon={Globe} />
                </div>
                <div className="border-t border-border/60 pt-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Personality
                  </p>
                  <ChipRow
                    items={normalizeStringArray(profile?.personality_tags)}
                    emptyIcon={Heart}
                  />
                </div>
              </div>
            </LiSection>

            <LiSection title="Rate">
              <RateBlock hourlyRate={profile?.hourly_rate ?? null} />
            </LiSection>

            <LiSection title="Licenses & certifications">
              <CertificationsList certifications={profile?.certifications ?? []} />
            </LiSection>

            <LiSection title="Recommendations">
              <RecommendationsList references={profile?.references ?? []} />
            </LiSection>
          </>
        ) : (
          <LiSection title="Care recipients">
            <RecipientsList recipients={familyProfile?.care_recipients ?? []} />
          </LiSection>
        )}
      </div>

      {/* Right rail — ancillary widgets */}
      <aside className="space-y-5 lg:sticky lg:top-24">
        {isCaregiver && completion && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Profile strength</h3>
              <span className="text-sm font-bold text-primary tabular-nums">
                {completion.percentage}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, completion.percentage))}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {completion.percentage >= 100
                ? "All-star profile — every field is in."
                : "A complete profile ranks higher in family searches."}
            </p>
            {completion.percentage < 100 && (
              <Link
                href="/profile/edit"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Improve profile
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </Link>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Contact info</h3>
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Mail className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">
                  {user.email_verified_at ? "Verified email" : "Email"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Phone className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.phone ?? <span className="text-muted-foreground/60">Not set yet</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.phone_verified_at ? "Verified phone" : "Phone"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Availability — "Open to bookings" (caregivers only) */}
        {isCaregiver && (
          <section
            className={cn(
              "rounded-2xl border p-5 shadow-sm",
              matchable
                ? "border-success/30 bg-success/[0.05]"
                : "border-accent/30 bg-accent/[0.04]",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  matchable ? "bg-success/15 text-success" : "bg-accent/15 text-accent",
                )}
              >
                <CalendarCheck className="size-5" strokeWidth={2} />
              </span>
              <p className="font-semibold text-foreground">
                {matchable ? "Open to bookings" : "Finishing setup"}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {matchable
                ? "Families can find you in the marketplace and send booking offers."
                : "Complete your profile to appear in family shortlists."}
            </p>
            <Link href={matchable ? "/me/gigs" : "/profile/edit"} className="mt-3 block">
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                {matchable ? "Manage gigs" : "Finish setup"}
                <ArrowRight className="size-4" strokeWidth={2.25} />
              </Button>
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}

function LiSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="px-5 pt-3 pb-5 sm:px-6">{children}</div>
    </section>
  );
}

function RecommendationsList({
  references,
}: {
  references: NonNullable<CaregiverProfileSummary["references"]>;
}) {
  if (references.length === 0) {
    return <Empty message="No recommendations yet." icon={Star} />;
  }
  return (
    <div className="space-y-3">
      {references.map((r, i) => (
        <div
          key={`${r.name}-${i}`}
          className="flex gap-3 rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials(r.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{r.name}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success ring-1 ring-success/30">
                <CheckCircle2 className="size-3" strokeWidth={2.5} />
                Reference
              </span>
            </div>
            {r.relationship ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{r.relationship}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
