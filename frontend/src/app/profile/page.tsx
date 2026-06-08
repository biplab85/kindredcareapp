"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Eye,
  EyeOff,
  Globe,
  Heart,
  Loader2,
  Mail,
  MapPin,
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
 * the view doesn't fight the editor for screen real estate, and the
 * editor doesn't have to render dual modes.
 *
 * Matchability is signaled as a single status pill (MATCHABLE / SETUP
 * NEEDED) rather than a percentage ring. Numbers belong on the editor
 * where they're actionable; on the view they're just noise.
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
  // AuthGuard, so we don't need to refetch it here. The earlier version
  // called fetchUser() in parallel — but fetchUser's catch wipes auth on
  // any non-2xx response, which logged out users on transient errors.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<MeResponse>("/api/me");
        if (alive && res.data.profile_completion) {
          setCompletion(res.data.profile_completion);
        }
      } catch {
        // Failures here just leave completion null — the status pill
        // falls back to "SETUP NEEDED" and the cards still render.
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
  const photoUrl = isCaregiver ? resolvePhotoUrl(user.caregiver_profile?.photo_path) : null;
  const matchable = isCaregiver ? (completion?.is_matchable ?? false) : true;

  return (
    <DashboardShell pageTitle="Profile">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        {/* ─── Editorial header ─── */}
        <div className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-foreground/30" />
          § 01 · Your profile
        </div>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            {photoUrl ? (
              <div className="relative size-20 overflow-hidden rounded-2xl bg-muted ring-2 ring-foreground/10 sm:size-24">
                <Image src={photoUrl} alt={user.name} fill className="object-cover" sizes="96px" />
              </div>
            ) : (
              <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card text-xl font-semibold tracking-tight text-foreground ring-2 ring-foreground/10 sm:size-24 sm:text-2xl">
                {initials(user.name)}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-3xl leading-[1.05] font-semibold tracking-tight sm:text-4xl">
                <span className="text-foreground">{firstName(user.name)} </span>
                <span className="italic text-primary">{lastName(user.name) || "Profile"}</span>
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
                  {isCaregiver ? "Caregiver" : "Family · Host"}
                </span>
                <span className="h-3 w-px bg-border" aria-hidden />
                {isCaregiver ? (
                  <StatusPill matchable={matchable} />
                ) : (
                  <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                    Booking on KindredCare
                  </span>
                )}
              </div>
            </div>
          </div>

          <Link href="/profile/edit" className="shrink-0">
            <Button className="h-11 gap-2 px-5">
              <Sparkles className="size-4" strokeWidth={2.25} />
              Edit profile
              <ArrowRight className="size-4" strokeWidth={2.25} />
            </Button>
          </Link>
        </header>

        <div className="mt-10 grid gap-5 sm:gap-6">
          <ContactCard user={user} />
          {isCaregiver ? (
            <CaregiverSections profile={user.caregiver_profile ?? null} />
          ) : (
            <FamilySections profile={user.family_profile ?? null} />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Status pill (replaces ProfileCompletionRing)
 * ───────────────────────────────────────────────────────────── */

function StatusPill({ matchable }: { matchable: boolean }) {
  if (matchable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.18em] text-success uppercase ring-1 ring-success/30">
        <CheckCircle2 className="size-3" strokeWidth={2.5} />
        Matchable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase ring-1 ring-foreground/15">
      Setup needed
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared chrome
 * ───────────────────────────────────────────────────────────── */

function Eyebrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
      <span className="h-px w-6 bg-foreground/30" />
      {label}
    </div>
  );
}

function Card({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] ring-1 ring-foreground/[0.02] sm:p-6">
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className="grid size-9 place-items-center rounded-xl bg-muted/60 text-foreground/80">
            <Icon className="size-4" strokeWidth={1.75} />
          </div>
        ) : null}
        <div>
          <Eyebrow label={eyebrow} />
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  verified,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  verified?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-dashed border-border/60 py-3 last:border-b-0">
      <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {isEmpty ? (
          <span className="text-sm text-muted-foreground/70 italic">not set yet</span>
        ) : (
          <span
            className={cn("text-sm text-foreground", mono && "font-mono text-[13px] tracking-wide")}
          >
            {value}
          </span>
        )}
        {verified && !isEmpty ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-success uppercase ring-1 ring-success/30">
            <CheckCircle2 className="size-3" strokeWidth={2.5} />
            Verified
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground/80 italic">{message}</p>;
}

function ChipRow({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Empty message="Nothing added yet." />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground"
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
    <Card eyebrow="§ 02 · Contact" title="How we reach you" icon={Mail}>
      <Row label="Name" value={user.name} />
      <Row label="Email" value={user.email} mono verified={user.email_verified_at !== null} />
      <Row label="Phone" value={user.phone} mono verified={user.phone_verified_at !== null} />
    </Card>
  );
}

function CaregiverSections({ profile }: { profile: CaregiverProfileSummary | null }) {
  if (!profile) {
    return (
      <Card eyebrow="§ 03 · Profile setup" title="Get started" icon={Sparkles}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You haven&rsquo;t started your caregiver profile yet. Head to the editor to introduce
          yourself to families.
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

  return (
    <>
      <Card eyebrow="§ 03 · Location" title="Where you work" icon={MapPin}>
        <Row label="Address" value={profile.address ?? null} />
        <Row label="Postal code" value={profile.postal_code ?? null} mono />
        <Row
          label="Travel radius"
          value={profile.travel_radius_km ? `${profile.travel_radius_km} km` : null}
          mono
        />
      </Card>

      <Card eyebrow="§ 04 · About you" title="Bio & experience" icon={UserCircle}>
        <div className="space-y-4">
          <div>
            <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Bio
            </span>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {profile.bio ?? (
                <span className="text-muted-foreground/70 italic">
                  No bio yet — families love seeing your voice come through here.
                </span>
              )}
            </p>
          </div>
          <Row label="Years of experience" value={profile.years_of_experience ?? null} mono />
        </div>
      </Card>

      <Card eyebrow="§ 05 · Rate" title="What you charge" icon={DollarSign}>
        <RateBlock hourlyRate={profile.hourly_rate ?? null} />
      </Card>

      <Card eyebrow="§ 06 · Languages" title="Conversation" icon={Globe}>
        <ChipRow items={normalizeStringArray(profile.languages)} />
      </Card>

      <Card eyebrow="§ 07 · Services" title="What you offer" icon={Briefcase}>
        <ChipRow items={(profile.services ?? []).map((s) => s.name)} />
      </Card>

      <Card eyebrow="§ 08 · Personality" title="Vibes" icon={Heart}>
        <ChipRow items={normalizeStringArray(profile.personality_tags)} />
      </Card>

      <Card eyebrow="§ 09 · Certifications" title="Training on file" icon={ClipboardCheck}>
        <CertificationsList certifications={profile.certifications ?? []} />
      </Card>

      <Card eyebrow="§ 10 · References" title="Vouches" icon={Star}>
        <ReferencesList references={profile.references ?? []} />
      </Card>
    </>
  );
}

function RateBlock({ hourlyRate }: { hourlyRate: string | number | null }) {
  const rateNumber = (() => {
    if (hourlyRate === null || hourlyRate === undefined || hourlyRate === "") return null;
    const n = typeof hourlyRate === "number" ? hourlyRate : Number(hourlyRate);
    return Number.isFinite(n) ? n : null;
  })();

  if (rateNumber === null) {
    return <Empty message="Hourly rate not set yet." />;
  }

  const familyPays = rateNumber * 1.075;

  return (
    <div className="flex flex-wrap items-end gap-6">
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Your hourly rate
        </div>
        <div className="mt-1 font-semibold text-foreground">
          <span className="text-4xl tracking-tight italic">${rateNumber.toFixed(2)}</span>
          <span className="ml-1 text-base font-normal text-muted-foreground">/ hour</span>
        </div>
      </div>
      <div className="space-y-1 border-l border-dashed border-border/60 pl-6">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          You keep <span className="text-foreground/90">${rateNumber.toFixed(2)}</span>
        </p>
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Family pays <span className="text-foreground/90">${familyPays.toFixed(2)}</span>
        </p>
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/70 uppercase">
          7.5% fee added on top
        </p>
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
    return <Empty message="No certifications added yet." />;
  }
  return (
    <div className="divide-y divide-dashed divide-border/60">
      {certifications.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="flex flex-wrap items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{c.name}</p>
            {c.issuer ? <p className="text-xs text-muted-foreground">{c.issuer}</p> : null}
          </div>
          {c.year ? (
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
              {c.year}
            </span>
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
    return <Empty message="No references on file yet." />;
  }

  return (
    <div className="space-y-3">
      {references.map((r, i) => {
        const isOpen = !!revealed[i];
        return (
          <div
            key={`${r.name}-${i}`}
            className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                {r.relationship ? (
                  <p className="text-xs text-muted-foreground italic">{r.relationship}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setRevealed((prev) => ({ ...prev, [i]: !isOpen }))}
                className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:text-foreground"
              >
                {isOpen ? (
                  <>
                    <EyeOff className="size-3" strokeWidth={2.5} />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="size-3" strokeWidth={2.5} />
                    Show contact
                  </>
                )}
              </button>
            </div>
            {isOpen ? (
              <div className="mt-3 space-y-1.5 font-mono text-xs text-foreground/90">
                {r.email ? (
                  <p>
                    <span className="text-muted-foreground">email · </span>
                    {r.email}
                  </p>
                ) : null}
                {r.phone ? (
                  <p>
                    <span className="text-muted-foreground">phone · </span>
                    {r.phone}
                  </p>
                ) : null}
                {!r.email && !r.phone ? (
                  <p className="text-muted-foreground italic">No contact info on file.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FamilySections({ profile }: { profile: FamilyProfileSummary | null }) {
  if (!profile) {
    return (
      <Card eyebrow="§ 03 · Profile setup" title="Get started" icon={Sparkles}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You haven&rsquo;t started your family profile yet. Head to the editor to tell us who
          you&rsquo;re booking care for.
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

  return (
    <Card eyebrow="§ 03 · Care recipients" title="Who you book for" icon={Users}>
      <RecipientsList recipients={profile.care_recipients ?? []} />
    </Card>
  );
}

function RecipientsList({ recipients }: { recipients: CareRecipientSummary[] }) {
  if (recipients.length === 0) {
    return <Empty message="No care recipients added yet." />;
  }
  return (
    <div className="space-y-3">
      {recipients.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{r.name}</p>
            <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
              {[r.age ? `${r.age} yrs` : null, r.language || null, r.postal_code || null]
                .filter(Boolean)
                .join(" · ") || "Details not set yet"}
            </p>
            {r.street_address ? (
              <p className="mt-2 text-xs text-muted-foreground italic">{r.street_address}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function firstName(name: string): string {
  return (name.split(/\s+/)[0] ?? "").trim();
}

function lastName(name: string): string {
  return name.split(/\s+/).slice(1).join(" ").trim();
}

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
