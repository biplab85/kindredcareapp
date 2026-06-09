"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Briefcase,
  Clock,
  Languages,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import api from "@/lib/api";
import { getUserReviews, type Review } from "@/lib/reviews";
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
  languages: string[];
  interests: string[];
  personality_tags: string[];
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

interface ReviewsState {
  list: Review[];
  count: number;
  average: number | null;
}

type LoadPhase = "loading" | "ready" | "error";

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
    <div className="relative">
      {/* Paper wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        {phase === "loading" && <LoadingScreen />}
        {phase === "error" && <ErrorScreen />}
        {phase === "ready" && caregiver && (
          <ProfileBody caregiver={caregiver} isVerified={isVerified} reviews={reviews} />
        )}
      </div>
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
}: {
  caregiver: CaregiverData;
  isVerified: boolean;
  reviews: ReviewsState;
}) {
  const { caregiver_profile: profile } = caregiver;
  const firstName = caregiver.name.split(/\s+/)[0] ?? caregiver.name;

  return (
    <>
      <ProfileHeader caregiver={caregiver} isVerified={isVerified} reviewCount={reviews.count} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div className="space-y-6">
          <TrustBlock caregiver={caregiver} reviews={reviews} />
          {profile.bio && <AboutBlock bio={profile.bio} firstName={firstName} />}
          {profile.services.length > 0 && <ServicesBlock services={profile.services} />}
          {profile.certifications && profile.certifications.length > 0 && (
            <CertificationsBlock certifications={profile.certifications} />
          )}
          <ReviewsBlock reviews={reviews} firstName={firstName} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <FactsBlock caregiver={caregiver} profile={profile} />
          {profile.languages.length > 0 && <LanguagesBlock languages={profile.languages} />}
          {(profile.interests.length > 0 || profile.personality_tags.length > 0) && (
            <FlavourBlock interests={profile.interests} personality={profile.personality_tags} />
          )}
        </aside>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Header
 * ───────────────────────────────────────────────────────────── */

function ProfileHeader({
  caregiver,
  isVerified,
  reviewCount,
}: {
  caregiver: CaregiverData;
  isVerified: boolean;
  reviewCount: number;
}) {
  const isNew = reviewCount < 3;
  const firstName = caregiver.name.split(/\s+/)[0] ?? caregiver.name;

  return (
    <header>
      <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Caregiver profile
        <span className="text-foreground/30">— § 01</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
          Meet <span className="font-normal italic text-primary">{firstName}.</span>
        </h1>
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
          #{String(caregiver.id).padStart(5, "0")}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-success uppercase">
            <BadgeCheck className="size-3.5" strokeWidth={2.25} />
            Basic verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Unverified
          </span>
        )}
        {isNew && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-accent uppercase">
            <Sparkles className="size-3.5" strokeWidth={2.25} />
            New
          </span>
        )}
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Trust Score — headline card
 * ───────────────────────────────────────────────────────────── */

function TrustBlock({ caregiver, reviews }: { caregiver: CaregiverData; reviews: ReviewsState }) {
  const score = caregiver.trust_score ?? null;
  const average = reviews.average;
  const hasScore = score !== null && score !== undefined;

  return (
    <section
      aria-label="Trust score"
      className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.05] via-card to-card p-6 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/[0.05] blur-3xl"
      />

      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-primary/40" />
        Trust score — § 02
      </div>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {hasScore ? (
            <>
              <p className="font-mono text-6xl leading-none font-semibold tabular-nums text-foreground sm:text-7xl">
                {score}
                <span className="ml-1 text-2xl text-muted-foreground">/100</span>
              </p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Composite of verification, reviews, reliability, and tenure.{" "}
                <span className="italic">Higher is more trusted.</span>
              </p>
            </>
          ) : average !== null ? (
            <>
              <div className="flex items-baseline gap-2">
                <p className="font-mono text-6xl leading-none font-semibold tabular-nums text-foreground sm:text-7xl">
                  {average.toFixed(1)}
                </p>
                <span className="text-2xl text-muted-foreground">/5</span>
              </div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Average across <span className="font-mono tabular-nums">{reviews.count}</span>{" "}
                review
                {reviews.count === 1 ? "" : "s"}.{" "}
                <span className="italic">Trust Score lands once we have more data.</span>
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-6xl leading-none font-semibold tabular-nums text-muted-foreground/50 sm:text-7xl">
                —
              </p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                No Trust Score yet.{" "}
                <span className="italic">Comes together after the first few visits.</span>
              </p>
            </>
          )}
        </div>

        {hasScore && average !== null && (
          <div className="border-t border-dashed border-primary/20 pt-4 sm:border-0 sm:border-l-2 sm:pt-0 sm:pl-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Star average
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-mono text-2xl font-semibold tabular-nums">{average.toFixed(1)}</p>
              <StaticStars value={average} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
              Over {reviews.count} review{reviews.count === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * About
 * ───────────────────────────────────────────────────────────── */

function AboutBlock({ bio, firstName }: { bio: string; firstName: string }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        In {firstName}&rsquo;s words — § 03
      </div>
      <blockquote className="mt-5 border-l-2 border-primary/30 pl-5 text-base leading-relaxed text-foreground/90 italic">
        &ldquo;{bio}&rdquo;
      </blockquote>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Services
 * ───────────────────────────────────────────────────────────── */

function ServicesBlock({ services }: { services: CaregiverService[] }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        Services offered — § 04
      </div>

      <ul className="mt-5 divide-y divide-dashed divide-border/50">
        {services.map((svc, i) => (
          <li
            key={svc.id}
            className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-base font-medium tracking-tight">{svc.name}</span>
            </div>
            {svc.pivot.years_experience > 0 && (
              <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
                {svc.pivot.years_experience} yr
                {svc.pivot.years_experience === 1 ? "" : "s"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
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
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <Award className="size-3.5" />
        Certifications — § 05
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-success uppercase">
          <span className="h-px w-6 bg-success/50" />
          Verified by KindredCare
        </div>
        <ul className="mt-3 space-y-2">
          {verified.map((cert) => (
            <li
              key={cert.id}
              className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/[0.05] px-4 py-3"
            >
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.25} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight">{cert.name}</p>
                <p className="mt-0.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
                  {[cert.issuer, cert.year].filter(Boolean).join(" · ") || "Reviewed by admin"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Reviews — ticket-stub rows
 * ───────────────────────────────────────────────────────────── */

function ReviewsBlock({ reviews, firstName }: { reviews: ReviewsState; firstName: string }) {
  const isNew = reviews.count < 3;

  return (
    <section aria-label="Reviews">
      <div className="mb-5 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Reviews
        {reviews.count > 0 && (
          <span className="font-mono tabular-nums text-foreground/60">· {reviews.count}</span>
        )}
        <span className="text-foreground/30">— § 06</span>
      </div>

      {reviews.list.length === 0 ? (
        <EmptyReviews />
      ) : (
        <ul className="space-y-4">
          {reviews.list.map((review, i) => (
            <li key={review.id}>
              <ReviewStub
                review={review}
                index={i}
                isFreshCaregiver={isNew}
                raterPlaceholder={firstName}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewStub({
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

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-border">
      {/* Perforated left edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 bottom-4 left-3 w-px bg-[radial-gradient(circle_at_50%_6px,theme(colors.foreground/0.25)_1px,transparent_1.5px)] bg-[length:100%_12px]"
      />

      <div className="px-5 py-5 pl-9 sm:px-6 sm:pl-11">
        <div className="flex items-center justify-between gap-3">
          <StaticStars value={review.stars} />
          <p className="font-mono text-[10px] tracking-[0.14em] tabular-nums text-muted-foreground uppercase">
            {date.toLocaleDateString("en-CA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <p className="text-sm font-semibold tracking-tight">{raterName}</p>
          {showsNewBadge && (
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-accent uppercase">
              New
            </span>
          )}
        </div>

        {review.body && (
          <blockquote className="mt-3 border-l-2 border-primary/25 pl-4 text-sm leading-relaxed text-foreground/85 italic">
            &ldquo;{review.body}&rdquo;
          </blockquote>
        )}
      </div>
    </article>
  );
}

function EmptyReviews() {
  return (
    <section
      aria-label="No reviews yet"
      className="rounded-3xl border-2 border-dashed border-border/60 bg-card/40 p-8 text-center sm:p-12"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Star className="size-6" strokeWidth={1.75} />
      </span>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        <span className="italic text-foreground">No reviews yet</span>
        &nbsp;— they&rsquo;ll appear here after the first visit.
      </p>
    </section>
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
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        Fast facts
      </div>

      <dl className="mt-5 space-y-4">
        <Fact
          icon={<Briefcase className="size-3.5" strokeWidth={2} />}
          label="Rate"
          value={`$${profile.hourly_rate} / hour`}
        />
        {profile.years_of_experience > 0 && (
          <Fact
            icon={<Clock className="size-3.5" strokeWidth={2} />}
            label="Experience"
            value={`${profile.years_of_experience} year${profile.years_of_experience === 1 ? "" : "s"}`}
          />
        )}
        <Fact
          icon={<MapPin className="size-3.5" strokeWidth={2} />}
          label="Travels"
          value={`Up to ${profile.travel_radius_km} km`}
        />
        {caregiver.gender && caregiver.gender !== "prefer_not_to_say" && (
          <Fact icon={null} label="Gender" value={caregiver.gender.replace(/_/g, " ")} capitalize />
        )}
      </dl>
    </section>
  );
}

function Fact({
  icon,
  label,
  value,
  capitalize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/50 pb-3 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          "text-right font-mono text-sm tabular-nums text-foreground",
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
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <Languages className="size-3.5" />
        Languages
      </div>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {languages.map((lang) => (
          <li
            key={lang}
            className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-mono text-[10px] tracking-[0.16em] text-foreground/80 uppercase"
          >
            {lang}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlavourBlock({ interests, personality }: { interests: string[]; personality: string[] }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <Sparkles className="size-3.5" />
        Interests &amp; personality
      </div>

      {interests.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Loves
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
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
        <div className="mt-5">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Vibe
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {personality.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border/60 px-3 py-1 text-xs italic text-foreground/80"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Stars — readonly, accent-red filled for earned, muted for rest
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
      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-14 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <div className="h-52 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
          <div className="h-32 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
          <div className="h-64 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
        </div>
        <div className="space-y-6">
          <div className="h-56 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
          <div className="h-40 animate-pulse rounded-3xl bg-muted/40 ring-1 ring-border/50" />
        </div>
      </div>
    </>
  );
}

function ErrorScreen() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="flex items-center justify-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Not found
      </div>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">
        <span className="font-normal italic text-accent">This caregiver</span> isn&rsquo;t here.
      </h1>
      <p className="mt-3 text-muted-foreground">
        They may have paused their profile, or the link is out of date.
      </p>
      <Link href="/" className="mt-6 inline-block">
        <Button variant="outline">
          <ArrowLeft className="size-4" />
          Back home
        </Button>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ───────────────────────────────────────────────────────────── */

function shortenName(name: string | null): string {
  if (!name) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}
