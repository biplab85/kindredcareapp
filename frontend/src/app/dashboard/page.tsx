"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Circle,
  DollarSign,
  Heart,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardMetric, DashboardShell, type DashboardNavBadges } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { ProfileCompletionRing } from "@/components/ui/profile-completion-ring";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
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
      <h1 className="text-[1.625rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
        {title}
      </h1>
      {meta && <p className="mt-2 text-sm text-muted-foreground">{meta}</p>}
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

function CaregiverDashboard() {
  const { user } = useAuthStore();
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardTitle
          title={`Welcome back, ${firstName}.`}
          meta={
            completion
              ? `Profile ${completion.percentage}% complete · ${completion.is_matchable ? "matchable" : "need 70% to match"}`
              : "Your overview and next actions."
          }
        />

        {isLoading ? (
          <LoadingRows />
        ) : (
          <>
            <StatusStrip isVerified={isVerified} />

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
                  href: "/jobs",
                  label: "Open gigs",
                  hint: "Families posting to the wider feed.",
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

function StatusStrip({ isVerified }: { isVerified: boolean }) {
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
          Offers from families will land here first. Browse the open-call feed or wait for a matched
          offer — they usually arrive with a four-hour response window.
        </p>
        <div className="mt-5">
          <Link href="/jobs">
            <Button>
              Browse open gigs
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardTitle
          title={`Welcome, ${firstName}.`}
          meta="Post a gig, run matches, and track your bookings."
        />

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
              <SectionBlock heading="Start here" sub="Post a gig and run matches.">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Describe what you need — companionship, errands, a walking partner — and the
                  matching engine ranks verified caregivers in your area.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/gigs/new">
                    <Button>
                      New gig
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
                  href: "/gigs",
                  label: "Manage your gigs",
                  hint: "All posted gigs with their matching state.",
                },
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
 * Phase 14 will layer heatmaps + trends on top.
 * ───────────────────────────────────────────────────────────── */

interface AdminAnalytics {
  users: { family: number; caregiver: number; admin: number };
  verifications: { pending_review: number; flagged: number };
  bookings: { pending_offers: number; active: number; completed_all_time: number };
  revenue_this_month: { visits: number; gmv_cents: number; commission_cents: number };
  as_of: string;
}

function AdminDashboardPlaceholder() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<{ data: AdminAnalytics }>("/api/admin/analytics");
        if (alive) setData(res.data.data);
      } catch (err) {
        console.error("[dashboard] admin analytics fetch failed", err);
        if (alive) setError("Couldn't load analytics. Refresh to try again.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const totalUsers = data ? data.users.family + data.users.caregiver + data.users.admin : 0;
  const verificationsTotal = data
    ? data.verifications.pending_review + data.verifications.flagged
    : 0;

  return (
    <DashboardShell pageTitle="Admin" navBadges={{ verification: verificationsTotal }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardTitle
          title="Platform overview"
          meta={
            data
              ? `Snapshot as of ${new Date(data.as_of).toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "Live counts and next actions."
          }
        />

        {error ? (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-5 text-sm text-destructive">
            {error}
          </div>
        ) : !data ? (
          <LoadingRows />
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardMetric
                label="Active users"
                value={totalUsers}
                hint={`${data.users.caregiver} caregivers · ${data.users.family} families`}
                icon={UsersRound}
                tone="primary"
              />
              <DashboardMetric
                label="Verifications waiting"
                value={verificationsTotal}
                hint={
                  data.verifications.flagged > 0
                    ? `${data.verifications.flagged} flagged for review`
                    : "All clear — no flags open"
                }
                icon={BadgeCheck}
                tone={verificationsTotal > 0 ? "accent" : "success"}
                href={verificationsTotal > 0 ? "/admin/verifications" : undefined}
              />
              <DashboardMetric
                label="Live bookings"
                value={data.bookings.active + data.bookings.pending_offers}
                hint={`${data.bookings.pending_offers} awaiting a caregiver · ${data.bookings.active} confirmed`}
                icon={CalendarClock}
                tone="primary"
              />
              <DashboardMetric
                label="Commission this month"
                value={formatCents(data.revenue_this_month.commission_cents)}
                hint={
                  data.revenue_this_month.visits > 0
                    ? `${data.revenue_this_month.visits} visit${data.revenue_this_month.visits === 1 ? "" : "s"} · ${formatCents(data.revenue_this_month.gmv_cents)} GMV`
                    : "No completed visits yet this month"
                }
                icon={Wallet}
                tone="success"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <SectionBlock
                heading="Verification triage"
                sub={
                  verificationsTotal > 0
                    ? `${data.verifications.pending_review} pending review · ${data.verifications.flagged} flagged`
                    : "Nothing in the queue right now."
                }
                action={
                  <Link href="/admin/verifications">
                    <Button variant="outline" size="sm">
                      Open queue
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                }
              >
                <ul className="grid gap-3 sm:grid-cols-2">
                  <QueueStat
                    label="Pending review"
                    count={data.verifications.pending_review}
                    tone="accent"
                    hint="Caregiver submitted docs — admin action required."
                  />
                  <QueueStat
                    label="Flagged"
                    count={data.verifications.flagged}
                    tone="warning"
                    hint="Auto-flagged for suspected issue. Manual call needed."
                  />
                </ul>
              </SectionBlock>

              <SectionBlock heading="Platform makeup" sub="Accounts by role.">
                <ul className="space-y-3 text-sm">
                  <RoleRow
                    label="Caregivers"
                    count={data.users.caregiver}
                    total={totalUsers}
                    tone="primary"
                  />
                  <RoleRow
                    label="Families"
                    count={data.users.family}
                    total={totalUsers}
                    tone="accent"
                  />
                  <RoleRow
                    label="Admins"
                    count={data.users.admin}
                    total={totalUsers}
                    tone="success"
                  />
                </ul>
              </SectionBlock>
            </div>

            <QuickRoutes
              routes={[
                {
                  href: "/admin/verifications",
                  label: "Verification queue",
                  hint: "Review caregiver document submissions and clear / reject.",
                },
                {
                  href: "/admin/verifications?status=flagged",
                  label: "Flagged accounts",
                  hint: "Auto-flagged items waiting on manual judgment.",
                },
                {
                  href: "/settings",
                  label: "Your settings",
                  hint: "Session and data controls for this admin account.",
                },
              ]}
            />

            <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <Circle className="size-2 fill-muted-foreground/40 text-muted-foreground/40" />
              Booking browser, dispute resolution, audit log, and geographic heatmap arrive in Phase
              14.
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function QueueStat({
  label,
  count,
  tone,
  hint,
}: {
  label: string;
  count: number;
  tone: "primary" | "accent" | "success" | "warning";
  hint: string;
}) {
  const styles: Record<typeof tone, { well: string; text: string; ring: string }> = {
    primary: { well: "bg-primary/10", text: "text-primary", ring: "ring-primary/30" },
    accent: { well: "bg-accent/10", text: "text-accent", ring: "ring-accent/30" },
    success: { well: "bg-success/10", text: "text-success", ring: "ring-success/30" },
    warning: { well: "bg-muted", text: "text-foreground/70", ring: "ring-foreground/15" },
  };
  const s = styles[tone];
  return (
    <li
      className={cn("rounded-xl border border-border/60 bg-card p-4", count === 0 && "opacity-70")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <span
          className={cn(
            "inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1",
            s.well,
            s.text,
            s.ring,
          )}
        >
          {count}
        </span>
      </div>
      <p className="mt-2 text-sm leading-snug text-muted-foreground">{hint}</p>
    </li>
  );
}

function RoleRow({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "primary" | "accent" | "success";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const bar: Record<typeof tone, string> = {
    primary: "bg-primary",
    accent: "bg-accent",
    success: "bg-success",
  };
  return (
    <li>
      <div className="flex items-baseline justify-between">
        <span className="text-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          <span className="font-semibold text-foreground">{count}</span>
          <span className="ml-1 text-[11px] text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", bar[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
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
