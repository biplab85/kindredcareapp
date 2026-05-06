"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  DollarSign,
  Heart,
  Loader2,
  MapPin,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";
import { DashboardMetric, DashboardShell, type DashboardNavBadges } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { ProfileCompletionRing } from "@/components/ui/profile-completion-ring";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { type Analytics, getAdminAnalytics } from "@/lib/admin-analytics";
import {
  type Booking,
  formatCents,
  formatHours,
  listBookings,
  statusLabel,
  statusTone,
} from "@/lib/bookings";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * Route shell — role-aware router. The outer AuthGuard lives
 * outside DashboardShell so the mount order stays predictable
 * (auth → shell → page body).
 * ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardRouter />
    </AuthGuard>
  );
}

function DashboardRouter() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user.role === "caregiver") return <CaregiverDashboard />;
  if (user.role === "family") return <FamilyDashboard />;
  return <AdminDashboardPlaceholder />;
}

/* ─────────────────────────────────────────────────────────────
 * Shared typography + block primitives used by both dashboards
 * ───────────────────────────────────────────────────────────── */

function DashboardTitle({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">{title}</h1>
      {meta && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{meta}</p>}
    </div>
  );
}

function SectionBlock({
  heading,
  sub,
  action,
  children,
  className,
}: {
  heading?: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const hasHeader = heading || sub || action;
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6",
        className,
      )}
    >
      {hasHeader && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {heading && (
              <h2 className="text-base font-semibold tracking-tight text-foreground">{heading}</h2>
            )}
            {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * CAREGIVER DASHBOARD
 * ───────────────────────────────────────────────────────────── */

interface ProfileCompletion {
  percentage: number;
  is_matchable: boolean;
  missing: { field: string; label: string; weight: number }[];
}

const STEP_BY_FIELD: Record<string, string> = {
  bio: "/onboarding?step=1",
  photo: "/onboarding?step=1",
  date_of_birth: "/onboarding?step=1",
  gender: "/onboarding?step=1",
  address: "/onboarding?step=1",
  services: "/onboarding?step=2",
  service_experience: "/onboarding?step=2",
  years_of_experience: "/onboarding?step=2",
  languages: "/onboarding?step=3",
  certifications: "/onboarding?step=3",
  hourly_rate: "/onboarding?step=4",
  availability: "/onboarding?step=4",
  emergency_contact: "/onboarding?step=5",
  references: "/onboarding?step=5",
  personality_tags: "/onboarding?step=3",
  interests: "/onboarding?step=3",
};

type IdentityStatus = "not_started" | "pending_review" | "cleared" | "rejected" | "incomplete";

function CaregiverDashboard() {
  const { user } = useAuthStore();
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>("not_started");
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  // Fetches in parallel but each settles independently — one failure
  // doesn't nuke the whole dashboard. The alive flag keeps late promises
  // from writing to an unmounted component.
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const meRes = await api.get("/api/me");
        if (!alive) return;
        setCompletion(meRes.data?.profile_completion ?? null);
        setIsVerified(Boolean(meRes.data?.is_fully_verified));
        // verification_summary is an array of {check_type, status}.
        // Pull out the identity row so the strip can show the
        // in-between "pending admin review" state.
        const summary: Array<{ check_type: string; status: IdentityStatus }> =
          meRes.data?.verification_summary ?? [];
        const identity = summary.find((s) => s.check_type === "identity");
        if (identity) setIdentityStatus(identity.status);
      } catch (err) {
        console.error("[dashboard] /api/me failed", err);
        if (alive) setIsVerified(false);
      }
    })();

    (async () => {
      try {
        const [upcoming, past] = await Promise.all([
          listBookings("upcoming"),
          listBookings("past"),
        ]);
        if (alive) setBookings([...upcoming, ...past]);
      } catch (err) {
        console.error("[dashboard] bookings fetch failed", err);
        if (alive) setBookings([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const pendingOffers = list.filter(
      (b) => b.status === "pending_caregiver" && !b.is_expired,
    ).length;
    const upcomingConfirmed = list.filter((b) => b.status === "confirmed").length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCents = list
      .filter(
        (b) =>
          b.status === "completed" &&
          b.cancelled_at === null &&
          new Date(b.scheduled_start) >= monthStart,
      )
      .reduce((sum, b) => sum + b.caregiver_payout_cents, 0);

    const nextVisit = list
      .filter((b) => b.status === "confirmed" && new Date(b.scheduled_start) >= now)
      .sort(
        (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      )[0];

    const pendingList = list
      .filter((b) => b.status === "pending_caregiver" && !b.is_expired)
      .sort(
        (a, b) =>
          new Date(a.response_deadline_at).getTime() - new Date(b.response_deadline_at).getTime(),
      );

    return { pendingOffers, upcomingConfirmed, monthCents, nextVisit, pendingList };
  }, [bookings]);

  const isLoading = isVerified === null || bookings === null;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const navBadges: DashboardNavBadges = {
    bookings: stats.pendingOffers,
    verification: isVerified ? 0 : 1,
  };

  return (
    <DashboardShell pageTitle="Dashboard" navBadges={navBadges}>
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <DashboardTitle
          title={`Welcome back, ${firstName}.`}
          meta={
            completion
              ? `Profile ${completion.percentage}% complete · ${completion.is_matchable ? "matchable" : "need 70% to match"}`
              : "Your overview and next actions."
          }
        />

        <div className="mt-6">
          <EmailVerifyBanner context="gig" />
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : (
          <>
            <StatusStrip isVerified={isVerified} identityStatus={identityStatus} />

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <DashboardMetric
                label="Pending offers"
                value={stats.pendingOffers}
                hint={
                  stats.pendingOffers > 0
                    ? "Response windows are ticking."
                    : "Nothing waiting on you."
                }
                icon={Sparkles}
                tone="accent"
                href={stats.pendingOffers > 0 ? "/bookings?tab=upcoming" : undefined}
              />
              <DashboardMetric
                label="Confirmed visits"
                value={stats.upcomingConfirmed}
                hint="On the schedule."
                icon={CalendarClock}
                tone="primary"
                href="/caregiver/schedule"
              />
              <DashboardMetric
                label="Earned this month"
                value={formatCents(stats.monthCents)}
                hint="After the 7.5% platform fee."
                icon={DollarSign}
                tone="success"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <NextVisitBlock booking={stats.nextVisit} pending={stats.pendingList[0]} />
              <ProfileCompletionBlock completion={completion} />
            </div>

            <div className="mt-6">
              <RecentActivity bookings={bookings ?? []} role="caregiver" />
            </div>

            <QuickRoutes
              routes={[
                {
                  href: "/me/gigs",
                  label: "My gigs",
                  hint: "Service listings families can find in the marketplace.",
                },
                {
                  href: "/bookings",
                  label: "All bookings",
                  hint: "Upcoming, active, and past — with accept / decline controls.",
                },
                {
                  href: "/caregiver/schedule",
                  label: "Your week",
                  hint: "See visits inked vs. pencilled across the days ahead.",
                },
              ]}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Caregiver — status strip
 * ───────────────────────────────────────────────────────────── */

function StatusStrip({
  isVerified,
  identityStatus,
}: {
  isVerified: boolean;
  identityStatus: IdentityStatus;
}) {
  if (isVerified) {
    return (
      <aside className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-success/30 bg-success/[0.05] px-5 py-4 text-sm">
        <div className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
          <ShieldCheck className="size-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">You&rsquo;re Basic Verified.</p>
          <p className="text-muted-foreground">
            Families can see your profile in the shortlist and send you offers.
          </p>
        </div>
        <Link
          href="/verification"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-success hover:text-success/80"
        >
          View status
          <ChevronRight className="size-3.5" />
        </Link>
      </aside>
    );
  }

  // Identity docs submitted, waiting on admin to approve. Distinct from
  // "haven't uploaded yet" so caregivers don't get nagged to do something
  // they've already done.
  if (identityStatus === "pending_review") {
    return (
      <aside className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[0.04] px-5 py-4 text-sm">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Loader2 className="size-5 animate-spin" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Documents submitted — pending review.</p>
          <p className="text-muted-foreground">
            Our admin team is checking your ID and selfie. Most reviews land within a business
            day; you&rsquo;ll get an email when it&rsquo;s done.
          </p>
        </div>
        <Link
          href="/verification"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
        >
          View status
          <ChevronRight className="size-3.5" />
        </Link>
      </aside>
    );
  }

  // Admin rejected — caregiver needs to act. Same destructive tone as a
  // hard error, but with a clear "try again" CTA.
  if (identityStatus === "rejected") {
    return (
      <aside className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/[0.04] px-5 py-4 text-sm">
        <div className="grid size-10 place-items-center rounded-xl bg-destructive/15 text-destructive">
          <ShieldX className="size-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Verification needs another look.</p>
          <p className="text-muted-foreground">
            Admin couldn&rsquo;t approve your last submission. Open the verification page for the
            specific reason and re-upload.
          </p>
        </div>
        <Link href="/verification">
          <Button size="sm" variant="destructive">
            Re-submit documents
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </aside>
    );
  }

  // Default — haven't uploaded anything yet (or only some checks done).
  return (
    <aside className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent/[0.05] px-5 py-4 text-sm">
      <div className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
        <BadgeCheck className="size-5" strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground">Verification still in progress.</p>
        <p className="text-muted-foreground">
          Upload ID + selfie so the admin team can clear your account. You won&rsquo;t appear in
          family shortlists until every check is cleared.
        </p>
      </div>
      <Link href="/verification">
        <Button size="sm" variant="default">
          Finish verification
          <ArrowRight className="size-3.5" />
        </Button>
      </Link>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Caregiver — next-visit block
 * ───────────────────────────────────────────────────────────── */

function NextVisitBlock({
  booking,
  pending,
}: {
  booking: Booking | undefined;
  pending: Booking | undefined;
}) {
  if (!booking && !pending) {
    return (
      <SectionBlock heading="Up next" sub="Nothing on the books yet.">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Offers from families will land here when they book one of your gigs — they usually arrive
          with a four-hour response window. Make sure your gigs are published so you&rsquo;re
          findable in the marketplace.
        </p>
        <div className="mt-5">
          <Link href="/me/gigs">
            <Button>
              Manage my gigs
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </SectionBlock>
    );
  }

  const active = booking ?? pending;
  if (!active) return null;

  const isPending = !booking;
  const start = new Date(active.scheduled_start);
  const dateLine = start.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLine = start.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <SectionBlock
      heading={isPending ? "Awaiting your reply" : "Up next"}
      sub={dateLine + " · " + timeLine}
      action={<StatusChip status={active.status} />}
    >
      <div className="space-y-3">
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {active.gig?.service_category?.name ?? "Visit"}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" strokeWidth={1.75} />
            {active.address_full ?? active.address_neighbourhood}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" strokeWidth={1.75} />
            {formatHours(active.duration_minutes)}
          </span>
        </div>

        <p className="text-sm">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatCents(active.caregiver_payout_cents)}
          </span>
          <span className="text-muted-foreground"> after fee</span>
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/bookings/${active.id}`}>
          <Button>
            {isPending ? "Review & respond" : "Open details"}
            <ArrowRight className="size-4" />
          </Button>
        </Link>
        <Link href="/caregiver/schedule">
          <Button variant="outline">See schedule</Button>
        </Link>
      </div>
    </SectionBlock>
  );
}

function StatusChip({ status }: { status: Booking["status"] }) {
  const tone = statusTone(status);
  const cls: Record<ReturnType<typeof statusTone>, string> = {
    pending: "bg-accent/10 text-accent ring-accent/30",
    positive: "bg-success/10 text-success ring-success/30",
    warning: "bg-muted text-foreground/70 ring-foreground/15",
    neutral: "bg-muted text-foreground/70 ring-foreground/15",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase ring-1",
        cls[tone],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Caregiver — profile completion block
 * ───────────────────────────────────────────────────────────── */

function ProfileCompletionBlock({ completion }: { completion: ProfileCompletion | null }) {
  if (!completion) return null;
  const pct = completion.percentage;
  const isComplete = pct >= 100;

  return (
    <SectionBlock
      heading={isComplete ? "Profile complete" : `${pct}% complete`}
      sub="Your profile at a glance."
      action={
        completion.is_matchable ? (
          <span className="inline-flex rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-success uppercase ring-1 ring-success/30">
            Matchable
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase ring-1 ring-foreground/15">
            Need 70% to match
          </span>
        )
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProfileCompletionRing percentage={pct} size="md" showLabel={false} />
        <div className="min-w-0 flex-1">
          {isComplete ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every field is in. Families see your full card in the shortlist.
            </p>
          ) : (
            <ul className="space-y-1">
              {completion.missing.slice(0, 4).map((item) => (
                <li key={item.field}>
                  <Link
                    href={STEP_BY_FIELD[item.field] ?? "/onboarding"}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="flex-1 text-foreground/80 group-hover:text-foreground">
                      {item.label}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      +{item.weight}%
                    </span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground/40 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
              {completion.missing.length > 4 && (
                <li className="px-2 pt-1 text-[11px] text-muted-foreground">
                  +{completion.missing.length - 4} more
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </SectionBlock>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Quick routes row — shared between caregiver + family
 * ───────────────────────────────────────────────────────────── */

function QuickRoutes({ routes }: { routes: { href: string; label: string; hint: string }[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Quick routes</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-[0_8px_24px_-12px_rgba(10,14,40,0.14)]"
          >
            <div className="flex items-start justify-between">
              <p className="text-base font-semibold tracking-tight text-foreground">
                {route.label}
              </p>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <p className="text-sm leading-snug text-muted-foreground">{route.hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * FAMILY DASHBOARD
 * ───────────────────────────────────────────────────────────── */

function FamilyDashboard() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [upcoming, past] = await Promise.all([
          listBookings("upcoming"),
          listBookings("past"),
        ]);
        if (alive) setBookings([...upcoming, ...past]);
      } catch (err) {
        console.error("[dashboard] bookings fetch failed", err);
        if (alive) setBookings([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const openOffers = list.filter((b) => b.status === "pending_caregiver" && !b.is_expired).length;
    const confirmed = list.filter((b) => b.status === "confirmed").length;
    const completed = list.filter((b) => b.status === "completed").length;

    const nextVisit = list
      .filter(
        (b) =>
          (b.status === "confirmed" || b.status === "pending_caregiver") &&
          new Date(b.scheduled_start) >= new Date(),
      )
      .sort(
        (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      )[0];

    return { openOffers, confirmed, completed, nextVisit };
  }, [bookings]);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const isLoading = bookings === null;

  const navBadges: DashboardNavBadges = { bookings: stats.openOffers };

  return (
    <DashboardShell pageTitle="Dashboard" navBadges={navBadges}>
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <DashboardTitle
          title={`Welcome, ${firstName}.`}
          meta="Browse the marketplace, book a visit, and track it through to completion."
        />

        <div className="mt-6">
          <EmailVerifyBanner context="booking" />
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <DashboardMetric
                label="Offers sent"
                value={stats.openOffers}
                hint="Waiting on a caregiver."
                icon={Sparkles}
                tone="accent"
                href={stats.openOffers > 0 ? "/bookings" : undefined}
              />
              <DashboardMetric
                label="Confirmed visits"
                value={stats.confirmed}
                hint="On the books."
                icon={CalendarClock}
                tone="primary"
                href="/bookings"
              />
              <DashboardMetric
                label="Completed"
                value={stats.completed}
                hint="Visits in the record."
                icon={Heart}
                tone="success"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <FamilyNextVisitBlock booking={stats.nextVisit} />
              <SectionBlock heading="Start here" sub="Browse the marketplace and book a gig.">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Verified caregivers post their service — companionship, errands, a walking partner
                  — at their own rate. Pick one that fits and book a visit.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/marketplace">
                    <Button>
                      Browse marketplace
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                  <Link href="/services">
                    <Button variant="outline">Browse services</Button>
                  </Link>
                </div>
              </SectionBlock>
            </div>

            <div className="mt-6">
              <RecentActivity bookings={bookings ?? []} role="family" />
            </div>

            <QuickRoutes
              routes={[
                {
                  href: "/bookings",
                  label: "Live bookings",
                  hint: "Track offers as they go out and come back.",
                },
                {
                  href: "/care-recipients",
                  label: "Care recipients",
                  hint: "Profiles for the people you're arranging care for.",
                },
                {
                  href: "/settings/payment-methods",
                  label: "Payment methods",
                  hint: "The card we charge after a visit ends.",
                },
              ]}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function FamilyNextVisitBlock({ booking }: { booking: Booking | undefined }) {
  if (!booking) {
    return (
      <SectionBlock heading="Up next" sub="Nothing on the calendar.">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Once a caregiver accepts an offer, the next scheduled visit will appear here with the
          address, rate and cancellation window.
        </p>
      </SectionBlock>
    );
  }

  const start = new Date(booking.scheduled_start);
  const dateLine = start.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLine = start.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <SectionBlock
      heading="Up next"
      sub={dateLine + " · " + timeLine}
      action={<StatusChip status={booking.status} />}
    >
      <p className="text-lg font-semibold tracking-tight text-foreground">
        {booking.caregiver?.name ?? booking.gig?.service_category?.name ?? "Visit"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" strokeWidth={1.75} />
          {booking.address_full ?? booking.address_neighbourhood}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5" strokeWidth={1.75} />
          {formatHours(booking.duration_minutes)}
        </span>
      </div>
      <p className="mt-3 text-sm">
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatCents(booking.subtotal_cents)}
        </span>
        <span className="text-muted-foreground"> total</span>
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/bookings/${booking.id}`}>
          <Button>
            Open booking
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </SectionBlock>
  );
}

/* ─────────────────────────────────────────────────────────────
 * RECENT ACTIVITY — shared between caregiver + family
 * Renders the last 5 bookings across every status so the feed
 * shows what just happened (accepts, declines, confirmations,
 * completions, cancels). Falls back to an empty state when
 * there's no history yet.
 * ───────────────────────────────────────────────────────────── */

function RecentActivity({ bookings, role }: { bookings: Booking[]; role: "caregiver" | "family" }) {
  const recent = useMemo(() => {
    return [...bookings]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [bookings]);

  return (
    <SectionBlock
      heading="Recent activity"
      sub={recent.length > 0 ? "Your last five booking updates." : undefined}
      action={
        recent.length > 0 ? (
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
          >
            All bookings
            <ChevronRight className="size-3.5" />
          </Link>
        ) : undefined
      }
    >
      {recent.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nothing to show yet — {role === "caregiver" ? "offers and visits" : "bookings"} will
          appear here as soon as they&rsquo;re in motion.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {recent.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold tracking-tight",
                    activityTone(booking.status).well,
                    activityTone(booking.status).text,
                  )}
                >
                  {activityLetter(booking.status)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {role === "caregiver"
                      ? (booking.gig?.service_category?.name ?? "Visit")
                      : (booking.caregiver?.name ?? "Caregiver")}
                    <span className="ml-2 font-normal text-muted-foreground">
                      · {statusLabel(booking.status)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {new Date(booking.scheduled_start).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {booking.address_neighbourhood}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right font-mono text-sm tabular-nums sm:block">
                  <span className="font-semibold">
                    {formatCents(
                      role === "caregiver"
                        ? booking.caregiver_payout_cents
                        : booking.subtotal_cents,
                    )}
                  </span>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                  strokeWidth={1.75}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionBlock>
  );
}

function activityLetter(status: Booking["status"]): string {
  switch (status) {
    case "pending_caregiver":
      return "P";
    case "confirmed":
      return "C";
    case "in_progress":
      return "▶";
    case "completed":
      return "✓";
    case "declined":
    case "expired":
      return "×";
    case "cancelled_by_family":
    case "cancelled_by_caregiver":
      return "⌀";
    case "no_show":
      return "!";
  }
}

function activityTone(status: Booking["status"]): { well: string; text: string } {
  const tone = statusTone(status);
  if (tone === "positive") return { well: "bg-success/10", text: "text-success" };
  if (tone === "pending") return { well: "bg-accent/10", text: "text-accent" };
  return { well: "bg-muted", text: "text-muted-foreground" };
}

/* ─────────────────────────────────────────────────────────────
 * ADMIN DASHBOARD — live analytics + quick triage callouts.
 * Editorial paper-wash aesthetic matching the rest of /admin/*.
 * ───────────────────────────────────────────────────────────── */

function AdminDashboardPlaceholder() {
  return <AdminDashboard />;
}

function AdminDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await getAdminAnalytics();
        if (!alive) return;
        setData(next);
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

  const verificationsTotal = data
    ? data.verifications.pending_review + data.verifications.flagged
    : 0;

  return (
    <DashboardShell pageTitle="Admin" navBadges={{ verification: verificationsTotal }}>
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

        <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
          <AdminHeader asOf={data?.as_of ?? null} />

          {state === "loading" && <AdminLoading />}
          {state === "error" && (
            <p className="mt-8 rounded-2xl border border-accent/30 bg-accent/[0.04] p-5 text-sm text-accent">
              Couldn&apos;t load analytics. Refresh to try again.
            </p>
          )}
          {state === "ready" && data && (
            <div className="mt-8 space-y-10">
              <AdminStatGrid data={data} />

              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <QualityPulse data={data} />
                <PlatformMakeup data={data} />
              </div>

              <VerificationTriage data={data} />

              <AdminQuickLinks />
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function AdminHeader({ asOf }: { asOf: string | null }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
        <span className="font-normal italic text-primary">The pulse,</span> at a glance.
      </h1>

      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Live counts across the platform, ranked by what an admin most often opens. Numbers refresh
        every page load — the stamp below is the moment this snapshot was taken.
      </p>

      {asOf && (
        <p className="mt-2 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
          As of{" "}
          {new Date(asOf).toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
    </header>
  );
}

function AdminStatGrid({ data }: { data: Analytics }) {
  const totalUsers = data.users.family + data.users.caregiver + data.users.admin;
  const verificationsTotal = data.verifications.pending_review + data.verifications.flagged;
  const liveBookings = data.bookings.active + data.bookings.pending_offers;

  return (
    <section aria-label="Headline metrics">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <AdminStat
          label="Active users"
          value={String(totalUsers)}
          hint={`${data.users.caregiver} caregivers · ${data.users.family} families`}
          icon={<UsersRound className="size-3.5" strokeWidth={2} />}
        />
        <AdminStat
          label="Verifications"
          value={String(verificationsTotal)}
          hint={
            data.verifications.flagged > 0 ? `${data.verifications.flagged} flagged` : "All clear"
          }
          icon={<BadgeCheck className="size-3.5" strokeWidth={2} />}
          tone={verificationsTotal > 0 ? "alarm" : "good"}
        />
        <AdminStat
          label="Live bookings"
          value={String(liveBookings)}
          hint={`${data.bookings.pending_offers} pending · ${data.bookings.active} confirmed`}
          icon={<CalendarClock className="size-3.5" strokeWidth={2} />}
        />
        <AdminStat
          label="Commission MTD"
          value={formatCents(data.revenue_this_month.commission_cents)}
          hint={
            data.revenue_this_month.visits > 0
              ? `${data.revenue_this_month.visits} visit${data.revenue_this_month.visits === 1 ? "" : "s"} · ${formatCents(data.revenue_this_month.gmv_cents)} GMV`
              : "No completed visits yet"
          }
          icon={<Wallet className="size-3.5" strokeWidth={2} />}
          emphasized
        />
      </div>
    </section>
  );
}

function AdminStat({
  label,
  value,
  hint,
  icon,
  emphasized,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  emphasized?: boolean;
  tone?: "alarm" | "good";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        emphasized && "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/15",
        !emphasized && tone === "alarm" && "border-accent/40 bg-accent/[0.04]",
        !emphasized && tone === "good" && "border-success/40 bg-success/[0.04]",
        !emphasized && !tone && "border-border/60 bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-md",
            emphasized && "bg-primary/15 text-primary",
            !emphasized && tone === "alarm" && "bg-accent/15 text-accent",
            !emphasized && tone === "good" && "bg-success/15 text-success",
            !emphasized && !tone && "bg-muted/60 text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <p
          className={cn(
            "font-mono text-[10px] tracking-[0.22em] uppercase",
            emphasized && "text-primary",
            !emphasized && tone === "alarm" && "text-accent",
            !emphasized && tone === "good" && "text-success",
            !emphasized && !tone && "text-muted-foreground",
          )}
        >
          {label}
        </p>
      </div>
      <p className="mt-3 font-mono text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function QualityPulse({ data }: { data: Analytics }) {
  const ts = data.trust_score;
  const tsTotal = ts.total;
  const ranked = tsTotal - ts.new;
  const peakBucket = Math.max(1, ...ts.buckets.map((b) => b.count));
  const avgRating = data.ratings.average_stars;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <Sparkles className="size-3.5" strokeWidth={2} />
        Quality pulse
        <span className="text-foreground/30">— § 20</span>
      </div>

      {/* Average rating row */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Average rating
          </p>
          {avgRating !== null ? (
            <div className="mt-1 flex items-baseline gap-3">
              <p className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
                {avgRating.toFixed(2)}
              </p>
              <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase tabular-nums">
                {data.ratings.count} review{data.ratings.count === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">No public reviews yet.</p>
          )}
        </div>

        <div className="text-right">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Trust avg
          </p>
          {ts.average !== null ? (
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{ts.average}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">—</p>
          )}
          <p className="mt-1 font-mono text-[10px] text-muted-foreground tabular-nums">
            {ranked} ranked · {ts.new} new
          </p>
        </div>
      </div>

      {/* Trust Score histogram */}
      <div className="mt-6 border-t border-dashed border-border/60 pt-4">
        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Trust Score distribution
        </p>

        {ranked === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground italic">
            All caregivers are still on their first three reviews.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ts.buckets.map((b) => (
              <li key={b.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-foreground/70 uppercase">
                    {b.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-foreground/60">
                    {b.count}
                  </span>
                </div>
                <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      b.min >= 81 && "bg-success",
                      b.min >= 61 && b.min < 81 && "bg-primary",
                      b.min >= 41 && b.min < 61 && "bg-foreground/40",
                      b.min < 41 && "bg-accent/70",
                    )}
                    style={{ width: `${(b.count / peakBucket) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PlatformMakeup({ data }: { data: Analytics }) {
  const total = data.users.family + data.users.caregiver + data.users.admin;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <UsersRound className="size-3.5" strokeWidth={2} />
        Platform makeup
        <span className="text-foreground/30">— § 21</span>
      </div>

      <ul className="space-y-3">
        <RoleBar
          label="Caregivers"
          count={data.users.caregiver}
          total={total}
          barClass="bg-success"
        />
        <RoleBar label="Families" count={data.users.family} total={total} barClass="bg-primary" />
        <RoleBar
          label="Admins"
          count={data.users.admin}
          total={total}
          barClass="bg-foreground/60"
        />
      </ul>

      <div className="mt-5 border-t border-dashed border-border/60 pt-4">
        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Bookings, all-time
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
          {data.bookings.completed_all_time}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground tabular-nums">completed visits</p>
      </div>
    </section>
  );
}

function RoleBar({
  label,
  count,
  total,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          <span className="font-semibold">{count}</span>
          <span className="ml-1 text-[10px] text-muted-foreground">{pct}%</span>
        </span>
      </div>
      <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function VerificationTriage({ data }: { data: Analytics }) {
  const total = data.verifications.pending_review + data.verifications.flagged;

  return (
    <section
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        total === 0 ? "border-success/40 bg-success/[0.04]" : "border-accent/30 bg-accent/[0.03]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <BadgeCheck className="size-3.5" strokeWidth={2} />
            Verification triage
            <span className="text-foreground/30">— § 22</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            {total === 0 ? (
              <>
                Inbox <span className="font-normal italic text-success">zero.</span>
              </>
            ) : (
              <>
                <span className="font-normal italic">Caregivers waiting</span> on a decision.
              </>
            )}
          </h3>
        </div>

        <Link href="/admin/verifications">
          <Button variant="outline" size="sm">
            Open queue
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TriageStat
          label="Pending review"
          count={data.verifications.pending_review}
          hint="Submitted; admin action required."
          tone="warn"
        />
        <TriageStat
          label="Flagged"
          count={data.verifications.flagged}
          hint="Auto-flagged; needs human judgment."
          tone="alarm"
        />
      </div>
    </section>
  );
}

function TriageStat({
  label,
  count,
  hint,
  tone,
}: {
  label: string;
  count: number;
  hint: string;
  tone: "warn" | "alarm";
}) {
  const empty = count === 0;
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        empty && "opacity-60",
        !empty && tone === "alarm" && "border-accent/40 bg-accent/[0.05]",
        !empty && tone === "warn" && "border-foreground/15",
        empty && "border-border/60",
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="font-mono text-2xl font-semibold tabular-nums">{count}</p>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function AdminQuickLinks() {
  const links = [
    { href: "/admin/users", label: "Users", hint: "Search · suspend · reactivate" },
    { href: "/admin/bookings", label: "Bookings", hint: "Filter · refund · resolve disputes" },
    {
      href: "/admin/verifications",
      label: "Verifications",
      hint: "Approve · reject · investigate",
    },
    { href: "/admin/safety", label: "Safety", hint: "Panic alerts · incidents" },
    { href: "/admin/alerts", label: "Alerts", hint: "Everything urgent in one feed" },
    { href: "/admin/audit", label: "Audit log", hint: "Who did what, when" },
    { href: "/admin/revenue", label: "Revenue", hint: "Trends · category breakdown · refunds" },
  ];

  return (
    <section>
      <div className="mb-4 flex items-center gap-3 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-8 bg-foreground/30" />
        Jump to
        <span className="text-foreground/30">— § 23</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-foreground/30"
            >
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{l.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{l.hint}</p>
              </div>
              <ArrowUpRight
                className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                strokeWidth={2}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdminLoading() {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card/60"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
        <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Shared loading state
 * ───────────────────────────────────────────────────────────── */

function LoadingRows() {
  return (
    <div className="mt-6 space-y-4">
      <div className="h-16 animate-pulse rounded-2xl border border-border/60 bg-muted/60" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-border/60 bg-muted/60"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="h-44 animate-pulse rounded-2xl border border-border/60 bg-muted/60" />
        <div className="h-44 animate-pulse rounded-2xl border border-border/60 bg-muted/60" />
      </div>
    </div>
  );
}

// Silence unused export while icon variants evolve.
export type { LucideIcon };
