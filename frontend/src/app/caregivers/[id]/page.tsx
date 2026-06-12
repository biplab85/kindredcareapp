"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Briefcase,
  Car,
  ChefHat,
  Clock,
  Eye,
  Flower2,
  Footprints,
  Heart,
  Languages,
  MapPin,
  MoreVertical,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  SprayCan,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from "@/lib/api";
import { type Gig, listGigsByCaregiver } from "@/lib/gigs";
import { getUserReviews, type Review } from "@/lib/reviews";
import {
  type VerificationCheck,
  VerificationBreakdown,
} from "@/components/caregiver/verification-breakdown";
import {
  type TrustComponents,
  TrustScoreBreakdown,
} from "@/components/caregiver/trust-score-breakdown";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────── */

interface CaregiverService {
  id: number;
  name: string;
  icon: string;
  pivot: { years_experience: number };
}

interface Certification {
  id: number;
  name: string;
  issuer?: string | null;
  year?: number | null;
  status: "self_reported" | "pending_review" | "verified" | "rejected" | "expired";
  has_document: boolean;
  expires_at?: string | null;
}

interface CaregiverProfile {
  bio: string;
  hourly_rate: string;
  travel_radius_km: number;
  years_of_experience: number;
  // Laravel's JSON array cast returns null for unset columns — not an
  // empty array — so all three of these can be null on the wire even
  // though the TypeScript shape used to claim string[].
  languages: string[] | null;
  interests: string[] | null;
  personality_tags: string[] | null;
  certifications: Certification[] | null;
  photo_path: string | null;
  photo_status: string;
  onboarding_complete: boolean;
  services: CaregiverService[];
}

interface CaregiverData {
  id: number;
  name: string;
  gender: string | null;
  trust_score?: number | null;
  caregiver_profile: CaregiverProfile;
}

interface TrustState {
  score: number | null;
  components: TrustComponents | null;
  isNew: boolean;
  verificationChecks: VerificationCheck[];
}

interface ReviewsState {
  list: Review[];
  count: number;
  average: number | null;
}

type LoadPhase = "loading" | "ready" | "error";

// Service-icon name → component, mirroring the marketplace catalogue so a
// caregiver's skills render with the same glyphs families saw in search.
const iconMap: Record<string, LucideIcon> = {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
};

/* ─────────────────────────────────────────────────────────────
 * Route shell
 * ───────────────────────────────────────────────────────────── */

export default function CaregiverProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <DashboardShell pageTitle="Caregiver">
        <ProfileView caregiverId={id} />
      </DashboardShell>
    </AuthGuard>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main view
 * ───────────────────────────────────────────────────────────── */

function ProfileView({ caregiverId }: { caregiverId: string }) {
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [caregiver, setCaregiver] = useState<CaregiverData | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [trust, setTrust] = useState<TrustState>({
    score: null,
    components: null,
    isNew: true,
    verificationChecks: [],
  });
  const [reviews, setReviews] = useState<ReviewsState>({
    list: [],
    count: 0,
    average: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/api/caregivers/${caregiverId}`);
        if (!alive) return;
        const data: CaregiverData = res.data.caregiver;
        setCaregiver(data);
        setIsVerified(res.data.is_verified ?? false);
        // The trust score, component breakdown, and per-check verification
        // status come back at the TOP LEVEL of the response, not nested on
        // the caregiver record. The hero used to read `caregiver.trust_score`
        // which was always undefined — surfacing them here fixes that.
        setTrust({
          score: res.data.trust_score ?? null,
          components: res.data.trust_components ?? null,
          isNew: res.data.trust_is_new ?? true,
          verificationChecks: res.data.verification_checks ?? [],
        });

        try {
          const reviewsRes = await getUserReviews(data.id);
          if (!alive) return;
          setReviews({
            list: reviewsRes.data,
            count: reviewsRes.meta.count,
            average: reviewsRes.meta.average_stars,
          });
        } catch {
          if (!alive) return;
        }
        setPhase("ready");
      } catch {
        if (!alive) return;
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [caregiverId]);

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href="/marketplace"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to marketplace
      </Link>

      {phase === "loading" && <LoadingScreen />}
      {phase === "error" && <ErrorScreen />}
      {phase === "ready" && caregiver && (
        <ProfileBody
          caregiver={caregiver}
          isVerified={isVerified}
          reviews={reviews}
          trust={trust}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Profile body
 * ───────────────────────────────────────────────────────────── */

function ProfileBody({
  caregiver,
  isVerified,
  reviews,
  trust,
}: {
  caregiver: CaregiverData;
  isVerified: boolean;
  reviews: ReviewsState;
  trust: TrustState;
}) {
  const { caregiver_profile: profile } = caregiver;
  const firstName = caregiver.name.split(/\s+/)[0] ?? caregiver.name;

  return (
    <>
      <ProfileHero
        caregiver={caregiver}
        profile={profile}
        isVerified={isVerified}
        reviews={reviews}
        trustScore={trust.score}
        trustIsNew={trust.isNew}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          {/* Background-check breakdown — placed high in the main column so
              families see exactly what was screened before reading the bio,
              services, or reviews. Falls back gracefully if the API didn't
              return any records (e.g. a profile that pre-dates the wiring). */}
          {trust.verificationChecks.length > 0 && (
            <VerificationBreakdown checks={trust.verificationChecks} variant="card" />
          )}
          {profile.bio && <AboutBlock bio={profile.bio} firstName={firstName} />}
          <GigsBlock caregiverUserId={caregiver.id} firstName={firstName} />
          {profile.services.length > 0 && <ServicesBlock services={profile.services} />}
          {profile.certifications && profile.certifications.length > 0 && (
            <CertificationsBlock certifications={profile.certifications} />
          )}
          <ReviewsBlock reviews={reviews} firstName={firstName} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <FactsBlock caregiver={caregiver} profile={profile} />
          {/* Trust score component breakdown sits in the sidebar next to the
              composite stat tile in the hero — answers "why this score" for
              families who care to look. Hidden if the backend didn't return
              components (shouldn't happen for fully-onboarded caregivers). */}
          {trust.components && (
            <TrustComponentsCard components={trust.components} isNew={trust.isNew} />
          )}
          {(profile.languages?.length ?? 0) > 0 && (
            <LanguagesBlock languages={profile.languages ?? []} />
          )}
          {((profile.interests?.length ?? 0) > 0 ||
            (profile.personality_tags?.length ?? 0) > 0) && (
            <FlavourBlock
              interests={profile.interests ?? []}
              personality={profile.personality_tags ?? []}
            />
          )}
        </aside>
      </div>
    </>
  );
}

function TrustComponentsCard({
  components,
  isNew,
}: {
  components: TrustComponents;
  isNew: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex min-h-14 items-center gap-2 border-b border-border px-5">
        <ShieldCheck className="size-4 text-primary" strokeWidth={2} />
        <h2 className="text-base font-semibold tracking-tight">Trust score breakdown</h2>
      </div>
      <div className="px-5 py-4">
        {isNew && (
          <p className="mb-3 rounded-lg bg-accent/5 px-3 py-2 text-[11px] leading-relaxed text-accent ring-1 ring-accent/15">
            New caregiver — review and reliability scores stay neutral until at least three visits
            have been completed.
          </p>
        )}
        <TrustScoreBreakdown components={components} />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Hero — cover, avatar, identity, and the key-stat strip
 * ───────────────────────────────────────────────────────────── */

function ProfileHero({
  caregiver,
  profile,
  isVerified,
  reviews,
  trustScore,
  trustIsNew,
}: {
  caregiver: CaregiverData;
  profile: CaregiverProfile;
  isVerified: boolean;
  reviews: ReviewsState;
  trustScore: number | null;
  trustIsNew: boolean;
}) {
  // For "new" caregivers (fewer than 3 reviews) we suppress the composite
  // trust score because review-component neutrality artificially inflates
  // it. Verification still scores meaningfully on its own and stays visible
  // in the sidebar breakdown card.
  const isNew = trustIsNew;
  const hasScore = trustScore !== null && !isNew;
  const score = trustScore;
  const average = reviews.average;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      {/* Cover band */}
      <div className="relative h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/10 sm:h-28">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(10,14,40,0.05) 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-[60px] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <CaregiverAvatar
              name={caregiver.name}
              photoPath={profile.photo_path}
              photoStatus={profile.photo_status}
            />

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {caregiver.name}
                </h1>
                {isVerified && (
                  <span title="Basic verified">
                    <BadgeCheck className="size-5 text-success" strokeWidth={2.25} />
                  </span>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="size-3.5" strokeWidth={2} />
                  Caregiver
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" strokeWidth={2} />
                  Travels up to {profile.travel_radius_km} km
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-success ring-1 ring-success/20">
                    <ShieldCheck className="size-3.5" strokeWidth={2.25} />
                    Basic verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground ring-1 ring-border">
                    Unverified
                  </span>
                )}
                {isNew && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent ring-1 ring-accent/20">
                    <Sparkles className="size-3.5" strokeWidth={2.25} />
                    New
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <Button render={<a href="#services" />} nativeButton={false} className="cursor-pointer">
              See services
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border/60 pt-5 sm:grid-cols-4">
          <StatTile
            icon={ShieldCheck}
            tone="primary"
            label="Trust score"
            value={hasScore ? `${score}` : "—"}
            suffix={hasScore ? "/100" : undefined}
          />
          <StatTile
            icon={Star}
            tone="accent"
            label={
              average !== null
                ? `${reviews.count} review${reviews.count === 1 ? "" : "s"}`
                : "Rating"
            }
            value={average !== null ? average.toFixed(1) : "New"}
            suffix={average !== null ? "/5" : undefined}
          />
          <StatTile
            icon={Clock}
            tone="neutral"
            label="Experience"
            value={`${profile.years_of_experience}`}
            suffix={`yr${profile.years_of_experience === 1 ? "" : "s"}`}
          />
          <StatTile
            icon={Briefcase}
            tone="success"
            label="Hourly rate"
            value={`$${profile.hourly_rate}`}
            suffix="/hr"
          />
        </dl>
      </div>
    </section>
  );
}

function CaregiverAvatar({
  name,
  photoPath,
  photoStatus,
}: {
  name: string;
  photoPath: string | null;
  photoStatus: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = photoStatus === "approved" ? resolvePhotoUrl(photoPath) : null;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="-mt-14 shrink-0 sm:-mt-16">
      {url && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={name}
          onError={() => setFailed(true)}
          className="size-24 rounded-2xl object-cover ring-4 ring-card shadow-md sm:size-28"
        />
      ) : (
        <span className="grid size-24 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold tracking-wide text-primary ring-4 ring-card shadow-md sm:size-28">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}

const STAT_TONES: Record<"primary" | "accent" | "neutral" | "success", string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  neutral: "bg-foreground/8 text-foreground/70",
  success: "bg-success/10 text-success",
};

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  suffix,
}: {
  icon: LucideIcon;
  tone: "primary" | "accent" | "neutral" | "success";
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", STAT_TONES[tone])}>
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-0.5 leading-none">
          <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
          {suffix && <span className="text-xs font-medium text-muted-foreground">{suffix}</span>}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Card primitive — shared header + body for content sections
 * ───────────────────────────────────────────────────────────── */

function Card({
  icon: Icon,
  title,
  action,
  children,
  id,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]"
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <Icon className="size-4 text-primary" strokeWidth={2} />
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * About
 * ───────────────────────────────────────────────────────────── */

function AboutBlock({ bio, firstName }: { bio: string; firstName: string }) {
  return (
    <Card icon={Heart} title={`About ${firstName}`}>
      <p className="text-sm leading-relaxed text-foreground/85">{bio}</p>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Skills & experience
 * ───────────────────────────────────────────────────────────── */

function ServicesBlock({ services }: { services: CaregiverService[] }) {
  return (
    <Card icon={Sparkles} title="Skills & experience">
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {services.map((svc) => {
          const Icon = iconMap[svc.icon] ?? Heart;
          return (
            <li
              key={svc.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{svc.name}</p>
                {svc.pivot.years_experience > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {svc.pivot.years_experience} yr
                    {svc.pivot.years_experience === 1 ? "" : "s"} experience
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Gigs — every published listing this caregiver has on offer.
 * The conversion point: family lands here, sees available
 * services, picks one to book.
 * ───────────────────────────────────────────────────────────── */

function GigsBlock({ caregiverUserId, firstName }: { caregiverUserId: number; firstName: string }) {
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listGigsByCaregiver(caregiverUserId);
        if (alive) {
          setGigs(list);
          setPhase("ready");
        }
      } catch {
        if (alive) setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [caregiverUserId]);

  if (phase === "loading") return null;
  if (phase === "error" || !gigs || gigs.length === 0) return null;

  return (
    <Card
      id="services"
      icon={Briefcase}
      title={`${firstName}'s services`}
      action={
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
          {gigs.length} {gigs.length === 1 ? "listing" : "listings"}
        </span>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Each listing is a separate service {firstName} offers. Pick one to book.
      </p>

      {/* Listings as a compact reference table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground uppercase">
                  Service
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground uppercase">
                  Listing
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold tracking-wide text-foreground uppercase">
                  Rate
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {gigs.map((gig) => {
                const Icon = gig.service_category?.icon
                  ? (iconMap[gig.service_category.icon] ?? Heart)
                  : Heart;
                return (
                  <tr
                    key={gig.id}
                    className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" strokeWidth={2} />
                        </span>
                        <span className="font-medium text-foreground">
                          {gig.service_category?.name ?? "Service"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/gigs/${gig.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {gig.title}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {gig.description}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                      <span className="font-bold tabular-nums text-foreground">
                        ${gig.hourly_rate_dollars.toFixed(0)}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">/hr</span>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${gig.title}`}
                          className="inline-grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-auto min-w-36">
                          <DropdownMenuItem
                            render={<Link href={`/gigs/${gig.id}`} />}
                            className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
                          >
                            <Eye className="size-4 text-muted-foreground" />
                            View gig
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Certifications
 * ───────────────────────────────────────────────────────────── */

function CertificationsBlock({ certifications }: { certifications: Certification[] }) {
  // Backend now filters to verified-only on /api/caregivers/{id}, but
  // belt-and-suspenders: filter again so a future API change doesn't
  // silently leak pending/rejected/self_reported onto the public card.
  const verified = certifications.filter((c) => c.status === "verified");

  if (verified.length === 0) return null;

  return (
    <Card
      icon={Award}
      title="Certifications"
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-success ring-1 ring-success/20">
          <ShieldCheck className="size-3.5" strokeWidth={2.25} />
          Verified by KindredCare
        </span>
      }
    >
      <ul className="space-y-2.5">
        {verified.map((cert) => (
          <li
            key={cert.id}
            className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/[0.05] px-4 py-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <ShieldCheck className="size-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-foreground">{cert.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Reviewed by admin"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Reviews
 * ───────────────────────────────────────────────────────────── */

function ReviewsBlock({ reviews, firstName }: { reviews: ReviewsState; firstName: string }) {
  const isNew = reviews.count < 3;

  return (
    <Card
      icon={Star}
      title="Reviews"
      action={
        reviews.average !== null ? (
          <div className="inline-flex items-center gap-2">
            <StaticStars value={reviews.average} />
            <span className="text-sm font-bold tabular-nums text-foreground">
              {reviews.average.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">({reviews.count})</span>
          </div>
        ) : undefined
      }
    >
      {reviews.list.length === 0 ? (
        <EmptyReviews />
      ) : (
        <ul className="space-y-3">
          {reviews.list.map((review, i) => (
            <li key={review.id}>
              <ReviewCard
                review={review}
                index={i}
                isFreshCaregiver={isNew}
                raterPlaceholder={firstName}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReviewCard({
  review,
  index,
  isFreshCaregiver,
}: {
  review: Review;
  index: number;
  isFreshCaregiver: boolean;
  raterPlaceholder: string;
}) {
  const date = new Date(review.visible_at ?? review.submitted_at);
  const raterName = shortenName(review.rater.name);
  const showsNewBadge = isFreshCaregiver && index === 0;
  const initials = raterName
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");

  return (
    <article className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{raterName}</p>
            {showsNewBadge && (
              <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
                New
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {date.toLocaleDateString("en-CA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <StaticStars value={review.stars} />
      </div>

      {review.body && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/85">{review.body}</p>
      )}
    </article>
  );
}

function EmptyReviews() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Star className="size-6" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground">No reviews yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        They&rsquo;ll appear here after the first visit.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sidebar facts
 * ───────────────────────────────────────────────────────────── */

function FactsBlock({
  caregiver,
  profile,
}: {
  caregiver: CaregiverData;
  profile: CaregiverProfile;
}) {
  return (
    <Card icon={Briefcase} title="Fast facts">
      <dl className="space-y-1">
        <Fact icon={Briefcase} label="Rate" value={`$${profile.hourly_rate} /hr`} />
        {profile.years_of_experience > 0 && (
          <Fact
            icon={Clock}
            label="Experience"
            value={`${profile.years_of_experience} year${profile.years_of_experience === 1 ? "" : "s"}`}
          />
        )}
        <Fact icon={MapPin} label="Travels" value={`Up to ${profile.travel_radius_km} km`} />
        {caregiver.gender && caregiver.gender !== "prefer_not_to_say" && (
          <Fact icon={null} label="Gender" value={caregiver.gender.replace(/_/g, " ")} capitalize />
        )}
      </dl>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: LucideIcon | null;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <dt className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-4 text-muted-foreground/70" strokeWidth={2} />}
        {label}
      </dt>
      <dd
        className={cn(
          "text-right text-sm font-semibold text-foreground",
          capitalize && "capitalize",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sidebar: languages + interests
 * ───────────────────────────────────────────────────────────── */

function LanguagesBlock({ languages }: { languages: string[] }) {
  return (
    <Card icon={Languages} title="Languages">
      <ul className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <li
            key={lang}
            className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/80 capitalize"
          >
            {lang}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FlavourBlock({ interests, personality }: { interests: string[]; personality: string[] }) {
  return (
    <Card icon={Sparkles} title="Interests & personality">
      {interests.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Loves
          </p>
          <ul className="flex flex-wrap gap-2">
            {interests.map((item) => (
              <li
                key={item}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {personality.length > 0 && (
        <div className={interests.length > 0 ? "mt-4" : ""}>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Vibe
          </p>
          <ul className="flex flex-wrap gap-2">
            {personality.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/80"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Stars — readonly, accent-filled for earned, muted for rest
 * ───────────────────────────────────────────────────────────── */

function StaticStars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rounded;
        return (
          <Star
            key={n}
            className={cn(
              "size-4",
              filled ? "fill-accent stroke-accent" : "fill-transparent stroke-border",
            )}
            strokeWidth={1.5}
          />
        );
      })}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * States
 * ───────────────────────────────────────────────────────────── */

function LoadingScreen() {
  return (
    <>
      <div className="h-48 animate-pulse rounded-2xl bg-muted/50 ring-1 ring-border/50" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-xl bg-muted/40 ring-1 ring-border/50" />
          <div className="h-64 animate-pulse rounded-xl bg-muted/40 ring-1 ring-border/50" />
        </div>
        <div className="space-y-6">
          <div className="h-56 animate-pulse rounded-xl bg-muted/40 ring-1 ring-border/50" />
          <div className="h-40 animate-pulse rounded-xl bg-muted/40 ring-1 ring-border/50" />
        </div>
      </div>
    </>
  );
}

function ErrorScreen() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <Heart className="size-7" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">This caregiver isn&rsquo;t here.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        They may have paused their profile, or the link is out of date.
      </p>
      <Link href="/marketplace" className="mt-6 inline-block">
        <Button variant="outline" className="cursor-pointer">
          <ArrowLeft className="size-4" />
          Back to marketplace
        </Button>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ───────────────────────────────────────────────────────────── */

function resolvePhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}/storage/${path.replace(/^\/+/, "")}`;
}

function shortenName(name: string | null): string {
  if (!name) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}
