"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Car,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Flower2,
  Footprints,
  Heart,
  Loader2,
  MapPin,
  MoreVertical,
  ShieldCheck,
  ShieldX,
  ShoppingBag,
  Smartphone,
  Sparkles,
  SprayCan,
  Store,
  UserRoundCheck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { HiArrowLongRight } from "react-icons/hi2";
import { AuthGuard } from "@/components/auth/auth-guard";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";
import { DashboardShell, type DashboardNavBadges } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">{title}</h1>
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
 * CardMenu — Metronic-style card-header "kebab" dropdown (the
 * three-dot toolbar button on the Highlights card). The 69%
 * "value" stays dynamic; this only adds a menu action beside it.
 * ───────────────────────────────────────────────────────────── */

function CardMenu({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; icon: LucideIcon }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.href + item.label}
              render={<Link href={item.href} />}
              // Hover/focus must NOT change the background — only the text
              // and icon recolour. Exact-modifier overrides so tailwind-merge
              // beats the component's focus:bg-accent / focus:text styles.
              className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
            >
              <Icon className="size-4 text-muted-foreground" />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────────────────────────────────────────
 * MetricTile — Metronic-style KPI tile. Solid tone-coloured icon
 * badge, oversized bold value, label + hint beneath. Local to the
 * dashboard so the shared DashboardMetric stays untouched.
 * ───────────────────────────────────────────────────────────── */

const METRIC_TILE_STYLES: Record<
  "primary" | "accent" | "success" | "neutral",
  { grad: string; ring: string; badge: string }
> = {
  primary: {
    grad: "from-primary/[0.14] via-primary/[0.04] to-transparent",
    ring: "border-primary/20",
    badge: "bg-primary text-primary-foreground",
  },
  accent: {
    grad: "from-accent/[0.14] via-accent/[0.04] to-transparent",
    ring: "border-accent/20",
    badge: "bg-accent text-accent-foreground",
  },
  success: {
    grad: "from-success/[0.14] via-success/[0.04] to-transparent",
    ring: "border-success/20",
    badge: "bg-success text-success-foreground",
  },
  neutral: {
    grad: "from-foreground/[0.08] via-foreground/[0.02] to-transparent",
    ring: "border-border/60",
    badge: "bg-foreground/80 text-background",
  },
};

// Distinct corner texture for the Quick-routes cards — a faint dot-grid.
const QUICK_ROUTE_TEXTURE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='150'><defs><pattern id='kc-dots' width='15' height='15' patternUnits='userSpaceOnUse'><circle cx='2.5' cy='2.5' r='1.4' fill='%230A0E28' fill-opacity='0.06'/></pattern></defs><rect width='220' height='150' fill='url(%23kc-dots)'/></svg>\")";

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "neutral";
  href?: string;
}) {
  const s = METRIC_TILE_STYLES[tone];

  const card = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border bg-card p-5 shadow-[0_1px_3px_rgba(10,14,40,0.06)] transition-all",
        s.ring,
        href && "hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(10,14,40,0.22)]",
      )}
    >
      {/* light tonal wash */}
      <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br", s.grad)} />

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", s.badge)}>
            <Icon className="size-5" strokeWidth={2} />
          </span>
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-[1.75rem]">
            {value}
          </p>
          {href && (
            <ArrowUpRight
              className="ml-auto size-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
              strokeWidth={1.75}
            />
          )}
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground/80">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }
  return card;
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
      <div className="max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
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
              <MetricTile
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
              <MetricTile
                label="Confirmed visits"
                value={stats.upcomingConfirmed}
                hint="On the schedule."
                icon={CalendarClock}
                tone="primary"
                href="/caregiver/schedule"
              />
              <MetricTile
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
                  icon: Store,
                  tone: "primary",
                },
                {
                  href: "/bookings",
                  label: "All bookings",
                  hint: "Upcoming, active, and past — with accept / decline controls.",
                  icon: ClipboardCheck,
                  tone: "accent",
                },
                {
                  href: "/caregiver/schedule",
                  label: "Your week",
                  hint: "See visits inked vs. pencilled across the days ahead.",
                  icon: CalendarDays,
                  tone: "success",
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
            Our admin team is checking your ID and selfie. Most reviews land within a business day;
            you&rsquo;ll get an email when it&rsquo;s done.
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

  // Identity is cleared but the other admin-side checks (CPIC, AML,
  // references) aren't done yet. The caregiver has done their part —
  // no upload-CTA nag; just inform that remaining checks are running.
  if (identityStatus === "cleared") {
    return (
      <aside className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-success/30 bg-success/[0.05] px-5 py-4 text-sm">
        <div className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
          <ShieldCheck className="size-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Identity confirmed.</p>
          <p className="text-muted-foreground">
            Background check and references are still running on the admin side. You&rsquo;ll appear
            in family shortlists once every check is cleared.
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

// Best-effort service-category → icon, matched on the slug so a missing icon
// field never breaks the card. A lookup table (rather than a component-returning
// function) keeps the call site clear of react-hooks/static-components.
// Companionship + anything unknown falls through to Heart.
const CATEGORY_ICONS: ReadonlyArray<readonly [readonly string[], LucideIcon]> = [
  [["tech"], Smartphone],
  [["errand", "shop"], ShoppingBag],
  [["walk"], Footprints],
  [["garden"], Flower2],
  [["cook", "meal"], ChefHat],
  [["transport", "drive", "ride"], Car],
  [["clean", "housekeep"], SprayCan],
];

function NextVisitBlock({
  booking,
  pending,
}: {
  booking: Booking | undefined;
  pending: Booking | undefined;
}) {
  if (!booking && !pending) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-xs">
        {/* card-header */}
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5">
          <h3 className="text-base font-semibold leading-none tracking-tight">Up next</h3>
          <CardMenu
            label="Up next options"
            items={[{ href: "/me/gigs", label: "Manage my gigs", icon: Briefcase }]}
          />
        </div>
        {/* card-content */}
        <div className="grow p-5">
          <div className="flex flex-col items-center px-2 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <CalendarClock className="size-6" strokeWidth={1.75} />
            </span>
            <p className="mt-4 text-base font-semibold text-foreground">Nothing on the books yet</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Offers from families land here with a four-hour response window. Keep your gigs
              published so you stay findable in the marketplace.
            </p>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/80">
              <span>Publish a gig</span>
              <HiArrowLongRight
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/50"
              />
              <span>families book</span>
              <HiArrowLongRight
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/50"
              />
              <span>offers appear here</span>
            </p>
            <div className="mt-5">
              <Button
                render={<Link href="/me/gigs" />}
                nativeButton={false}
                className="cursor-pointer"
              >
                Manage my gigs
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const active = booking ?? pending;
  if (!active) return null;

  const isPending = !booking;
  const start = new Date(active.scheduled_start);
  const day = start.getDate();
  const month = start.toLocaleDateString("en-CA", { month: "short" }).toUpperCase();
  const dateLine = start.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLine = start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  const slug = active.gig?.service_category?.slug ?? "";
  const Icon = CATEGORY_ICONS.find(([keys]) => keys.some((k) => slug.includes(k)))?.[1] ?? Heart;
  const title = active.gig?.service_category?.name ?? "Visit";

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-xs">
      {/* card-header */}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5">
        <h3 className="text-base font-semibold leading-none tracking-tight">
          {isPending ? "Awaiting your reply" : "Up next"}
        </h3>
        <div className="flex items-center gap-2">
          <StatusChip status={active.status} />
          <CardMenu
            label="Up next options"
            items={[{ href: "/me/gigs", label: "Manage my gigs", icon: Briefcase }]}
          />
        </div>
      </div>

      {/* card-content */}
      <div className="grow p-5">
        {/* Hero — tear-off calendar token + service title + when */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
          <div className="flex items-start gap-4">
            {/* tear-off calendar token */}
            <div className="flex w-[4.25rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_6px_18px_-8px_rgba(10,14,40,0.35)]">
              <span className="bg-primary py-1 text-center text-[10px] font-semibold tracking-[0.2em] text-primary-foreground uppercase">
                {month}
              </span>
              <span className="py-2 text-center text-[1.75rem] leading-none font-bold tabular-nums text-foreground">
                {day}
              </span>
            </div>
            {/* title + meta */}
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <p className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </p>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
                <span className="tabular-nums">{dateLine}</span>
                <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
                <span className="tabular-nums">{timeLine}</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums ring-1 ring-primary/15">
                  {relativeWhen(start)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2.5">
          <VisitFact
            icon={Clock}
            tone="primary"
            label="Length"
            value={formatHours(active.duration_minutes)}
          />
          <VisitFact
            icon={MapPin}
            tone="neutral"
            label="Area"
            value={active.address_neighbourhood}
          />
          <VisitFact
            icon={Wallet}
            tone="success"
            label="Payout"
            value={formatCents(active.caregiver_payout_cents)}
          />
        </dl>

        <div className="mt-4">
          <VisitTimeline current={visitStepIndex(active.status)} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            render={<Link href={`/bookings/${active.id}`} />}
            nativeButton={false}
            className="cursor-pointer"
          >
            {isPending ? "Review & respond" : "Open details"}
            <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            render={<Link href="/caregiver/schedule" />}
            nativeButton={false}
            className="cursor-pointer"
          >
            See schedule
          </Button>
        </div>
      </div>
    </div>
  );
}

const VISIT_STEPS = ["Offered", "Confirmed", "Check-in", "Done"] as const;

function visitStepIndex(status: Booking["status"]): number {
  switch (status) {
    case "pending_caregiver":
      return 0;
    case "confirmed":
      return 1;
    case "in_progress":
      return 2;
    case "completed":
      return 3;
    default:
      return 0;
  }
}

function relativeWhen(date: Date): string {
  const ms = date.getTime() - new Date().getTime();
  const past = ms < 0;
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let phrase: string;
  if (mins < 60) phrase = `${Math.max(1, mins)} min`;
  else if (hours < 24) phrase = `${hours} hr${hours === 1 ? "" : "s"}`;
  else if (days === 1) return past ? "yesterday" : "tomorrow";
  else phrase = `${days} days`;
  return past ? `${phrase} ago` : `in ${phrase}`;
}

const VISIT_FACT_TONES: Record<
  "primary" | "neutral" | "success",
  { card: string; chip: string }
> = {
  primary: { card: "border-primary/15 bg-primary/[0.06]", chip: "bg-primary/15 text-primary ring-primary/20" },
  neutral: { card: "border-border/70 bg-muted/60", chip: "bg-foreground/10 text-foreground/70 ring-foreground/10" },
  success: { card: "border-success/20 bg-success/[0.07]", chip: "bg-success/15 text-success ring-success/25" },
};

function VisitFact({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "neutral" | "success";
}) {
  const s = VISIT_FACT_TONES[tone];
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border p-3", s.card)}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", s.chip)}>
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
      </div>
    </div>
  );
}

function VisitTimeline({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {VISIT_STEPS.map((step, i) => {
        const reached = i <= current;
        const isLast = i === VISIT_STEPS.length - 1;
        return (
          <li key={step} className={cn("flex items-center", !isLast && "flex-1")}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  reached ? "bg-primary" : "bg-muted-foreground/25",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide uppercase",
                  i === current
                    ? "text-foreground"
                    : reached
                      ? "text-primary"
                      : "text-muted-foreground/60",
                )}
              >
                {step}
              </span>
            </span>
            {!isLast && (
              <span
                className={cn("mx-2 h-px flex-1", i < current ? "bg-primary/40" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
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

const COMPLETION_PAGE_SIZE = 4;

function ProfileCompletionBlock({ completion }: { completion: ProfileCompletion | null }) {
  // Hook stays above the early return so the order is stable across renders.
  const [page, setPage] = useState(0);
  if (!completion) return null;
  const pct = completion.percentage;
  const isComplete = pct >= 100;

  // Paginate the missing-items table, 4 rows per page. safePage clamps the
  // stored page in case the list shrank since the last render.
  const totalPages = Math.max(1, Math.ceil(completion.missing.length / COMPLETION_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * COMPLETION_PAGE_SIZE;
  const pageItems = completion.missing.slice(pageStart, pageStart + COMPLETION_PAGE_SIZE);
  // Only pad to a full page when there's more than one page — a single
  // short page shouldn't grow empty rows it doesn't need.
  const fillerRows = totalPages > 1 ? COMPLETION_PAGE_SIZE - pageItems.length : 0;

  // Mirror ProfileCompletionRing's getColor thresholds so the linear bar
  // shows the same tone the (now hidden) ring would at any percentage:
  // ≥70 success, ≥40 warning (amber), <40 accent.
  const barFill = pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-accent";
  const barText = pct >= 70 ? "text-success" : pct >= 40 ? "text-warning" : "text-accent";
  const boostTone =
    pct >= 70
      ? "bg-success/10 text-success"
      : pct >= 40
        ? "bg-warning/10 text-warning"
        : "bg-accent/10 text-accent";

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-xs">
      {/* card-header */}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5">
        <h3 className="text-base font-semibold leading-none tracking-tight">
          {isComplete ? "Profile complete" : `${pct}% complete`}
        </h3>
        <div className="flex items-center gap-2">
          {completion.is_matchable ? (
            <span className="inline-flex rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-success uppercase ring-1 ring-success/30">
              Matchable
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase ring-1 ring-foreground/15">
              Need 70% to match
            </span>
          )}
          <CardMenu
            label="Profile options"
            items={[{ href: "/onboarding", label: "Complete your profile", icon: UserRoundCheck }]}
          />
        </div>
      </div>

      {/* card-content */}
      <div className="grow p-5">
        {/* Circular ring kept in the tree but hidden from display — the
            linear bar below now carries the same dynamic percentage. */}
        <div className="hidden">
          <ProfileCompletionRing percentage={pct} size="md" showLabel={false} />
        </div>

        {/* Linear progress bar — same dynamic value & tone as the ring */}
        <div className="mb-5">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Profile strength
            </span>
            <span className={cn("text-sm font-bold tabular-nums", barText)}>{pct}%</span>
          </div>
          <div
            aria-hidden
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="presentation"
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", barFill)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {isComplete ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every field is in. Families see your full card in the shortlist.
          </p>
        ) : (
          // Metronic demo1 "Teams" card table — muted uppercase column
          // headers, divider rows, bold primary label, trailing value.
          <div className="overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="pb-2.5 pr-3 pl-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Profile item
                  </th>
                  <th className="pb-2.5 px-3 text-right text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Boost
                  </th>
                  <th className="w-8 pb-2.5 pr-1" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item, i) => {
                  const href = STEP_BY_FIELD[item.field] ?? "/onboarding";
                  return (
                    <tr
                      key={item.field}
                      className="group border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="py-2.5 pr-3 pl-1">
                        <Link href={href} className="flex items-center gap-2.5">
                          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {pageStart + i + 1}
                          </span>
                          <span className="font-medium text-foreground/85 group-hover:text-foreground">
                            {item.label}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            boostTone,
                          )}
                        >
                          +{item.weight}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-1 text-right">
                        <Link href={href} aria-label={`Complete: ${item.label}`}>
                          <ArrowUpRight className="size-4 text-muted-foreground/40 group-hover:text-foreground" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {/* Filler rows hold a constant 4-row height across pages so
                    the card never resizes (and its grid-row neighbour, the
                    "Up next" card, stops jumping) when paginating. */}
                {fillerRows > 0 &&
                  Array.from({ length: fillerRows }).map((_, i) => (
                    <tr
                      key={`filler-${i}`}
                      aria-hidden
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-2.5 pr-3 pl-1">
                        <span className="flex items-center gap-2.5">
                          <span className="size-6" />
                          <span className="text-sm">&nbsp;</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5" />
                      <td className="py-2.5 pr-1" />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* card-footer — pager pinned to the bottom of the card, always at
          the bottom regardless of how many rows the current page holds. */}
      {!isComplete && totalPages > 1 && (
        <div className="flex items-center justify-end gap-1 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label="Previous page"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`Page ${i + 1}`}
              aria-current={i === safePage ? "page" : undefined}
              className={cn(
                "grid size-7 cursor-pointer place-items-center rounded-md text-[12px] font-semibold tabular-nums transition-colors",
                i === safePage
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            aria-label="Next page"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Quick routes row — shared between caregiver + family
 * ───────────────────────────────────────────────────────────── */

type QuickRouteTone = "primary" | "accent" | "success";

interface QuickRoute {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: QuickRouteTone;
}

// Quick routes reuse the KPI MetricTile treatment — a tonal gradient wash,
// corner swoosh and a solid colour-coded icon badge — pared down to a simple
// icon + title nav target. Three tones give three distinct gradients, matching
// the "Pending offers / Earned this month" tiles above.
function QuickRoutes({ routes }: { routes: QuickRoute[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Quick routes</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {routes.map((route) => {
          const Icon = route.icon;
          const s = METRIC_TILE_STYLES[route.tone];
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "group relative h-full overflow-hidden rounded-xl border bg-card p-5 shadow-[0_1px_3px_rgba(10,14,40,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(10,14,40,0.28)]",
                s.ring,
              )}
            >
              {/* tonal gradient wash */}
              <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br", s.grad)} />
              {/* decorative corner texture — dot-grid, distinct from the
                  metric tiles' concentric-arc swoosh */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: QUICK_ROUTE_TEXTURE,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right top",
                }}
              />

              <div className="relative">
                <div className="flex items-center gap-3">
                  <span
                    className={cn("grid size-10 shrink-0 place-items-center rounded-xl", s.badge)}
                  >
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    {route.label}
                  </p>
                  <ArrowUpRight className="ml-auto size-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{route.hint}</p>
              </div>
            </Link>
          );
        })}
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
      <div className="max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
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
              <MetricTile
                label="Offers sent"
                value={stats.openOffers}
                hint="Waiting on a caregiver."
                icon={Sparkles}
                tone="accent"
                href={stats.openOffers > 0 ? "/bookings" : undefined}
              />
              <MetricTile
                label="Confirmed visits"
                value={stats.confirmed}
                hint="On the books."
                icon={CalendarClock}
                tone="primary"
                href="/bookings"
              />
              <MetricTile
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
                  icon: CalendarCheck,
                  tone: "primary",
                },
                {
                  href: "/care-recipients",
                  label: "Care recipients",
                  hint: "Profiles for the people you're arranging care for.",
                  icon: UsersRound,
                  tone: "accent",
                },
                {
                  href: "/settings/payment-methods",
                  label: "Payment methods",
                  hint: "The card we charge after a visit ends.",
                  icon: CreditCard,
                  tone: "success",
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

const ACTIVITY_PAGE_SIZE = 4;

function RecentActivity({ bookings, role }: { bookings: Booking[]; role: "caregiver" | "family" }) {
  // Hook stays above the early return so the order is stable across renders.
  const [page, setPage] = useState(0);

  const recent = useMemo(() => {
    return [...bookings]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 12);
  }, [bookings]);

  // Paginate 4 rows per page, mirroring the profile-completion card. safePage
  // clamps the stored page in case the list shrank since the last render.
  const totalPages = Math.max(1, Math.ceil(recent.length / ACTIVITY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * ACTIVITY_PAGE_SIZE;
  const pageItems = recent.slice(pageStart, pageStart + ACTIVITY_PAGE_SIZE);
  // Pad to a full 4-row page (only when there's more than one page) so the
  // card never resizes as you flip between pages.
  const fillerRows = totalPages > 1 ? ACTIVITY_PAGE_SIZE - pageItems.length : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* card-header */}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5">
        <h3 className="text-base font-semibold leading-none tracking-tight">Recent activity</h3>
        {recent.length > 0 && (
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
          >
            All bookings
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing to show yet — {role === "caregiver" ? "offers and visits" : "bookings"} will
            appear here as soon as they&rsquo;re in motion.
          </p>
        </div>
      ) : (
        // Table view — same structure as the My-gigs list page (full-bleed
        // table, muted header row, zebra striping, trailing action column).
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th className="py-3 pr-4 pl-5 text-[11px] font-semibold tracking-wide text-foreground capitalize sm:pl-6">
                    {role === "caregiver" ? "Visit" : "Caregiver"}
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground capitalize">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold tracking-wide text-foreground capitalize whitespace-nowrap">
                    When
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold tracking-wide text-foreground capitalize">
                    Amount
                  </th>
                  <th className="py-3 pr-5 pl-4 sm:pr-6" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((booking) => (
                  <ActivityRow key={booking.id} booking={booking} role={role} />
                ))}
                {/* Filler rows hold a constant 4-row height across pages so the
                    card never resizes when paginating. */}
                {fillerRows > 0 &&
                  Array.from({ length: fillerRows }).map((_, i) => (
                    <tr
                      key={`filler-${i}`}
                      aria-hidden
                      className="border-b border-border/60 even:bg-muted/30 last:border-0"
                    >
                      <td className="py-3 pr-4 pl-5 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <span className="size-9 shrink-0" />
                          <span className="text-sm">&nbsp;</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3" />
                      <td className="py-3 pr-5 pl-4 sm:pr-6" />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* card-footer — pager, same treatment as the profile-completion card */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-1 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  aria-label={`Page ${i + 1}`}
                  aria-current={i === safePage ? "page" : undefined}
                  className={cn(
                    "grid size-7 cursor-pointer place-items-center rounded-md text-[12px] font-semibold tabular-nums transition-colors",
                    i === safePage
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage === totalPages - 1}
                aria-label="Next page"
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityRow({ booking, role }: { booking: Booking; role: "caregiver" | "family" }) {
  const tone = activityTone(booking.status);
  const title =
    role === "caregiver"
      ? (booking.gig?.service_category?.name ?? "Visit")
      : (booking.caregiver?.name ?? "Caregiver");
  const whenLine = new Date(booking.scheduled_start).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const amount = formatCents(
    role === "caregiver" ? booking.caregiver_payout_cents : booking.subtotal_cents,
  );

  return (
    <tr className="group border-b border-border/60 transition-colors even:bg-muted/30 last:border-0 hover:bg-muted/60">
      {/* Activity — status avatar + title, with the area as a subtitle */}
      <td className="py-3 pr-4 pl-5 sm:pl-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold tracking-tight",
              tone.well,
              tone.text,
            )}
          >
            {activityLetter(booking.status)}
          </span>
          <div className="min-w-0">
            <Link
              href={`/bookings/${booking.id}`}
              className="block truncate text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
            >
              {title}
            </Link>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {booking.address_neighbourhood}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-middle">
        <StatusChip status={booking.status} />
      </td>

      {/* When */}
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        <span className="text-sm text-muted-foreground tabular-nums">{whenLine}</span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
        <span className="text-sm font-semibold text-foreground tabular-nums">{amount}</span>
      </td>

      {/* Action — 3-dot kebab dropdown, same pattern as the My-gigs table */}
      <td className="py-3 pr-5 pl-4 text-right align-middle sm:pr-6">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Activity actions"
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-40">
              <DropdownMenuItem
                render={<Link href={`/bookings/${booking.id}`} />}
                className="cursor-pointer gap-2 focus:bg-transparent focus:text-primary not-data-[variant=destructive]:focus:**:text-primary"
              >
                <Eye className="size-4" />
                View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
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
        <div className="max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
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
        Dashboard
      </h1>

      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Live counts across the platform, ranked by what an admin most often opens. Numbers refresh
        on every page load.
      </p>

      {asOf && (
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
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
        "rounded-xl border p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]",
        emphasized && "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/15",
        !emphasized && tone === "alarm" && "border-accent/40 bg-accent/[0.04]",
        !emphasized && tone === "good" && "border-success/40 bg-success/[0.04]",
        !emphasized && !tone && "border-border/60 bg-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg",
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
            "text-[11px] font-medium tracking-wide uppercase",
            emphasized && "text-primary",
            !emphasized && tone === "alarm" && "text-accent",
            !emphasized && tone === "good" && "text-success",
            !emphasized && !tone && "text-muted-foreground",
          )}
        >
          {label}
        </p>
      </div>
      <p className="mt-3 text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-[2rem]">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">{hint}</p>
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
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <Sparkles className="size-3.5" strokeWidth={2} />
        Quality pulse
      </div>

      {/* Average rating row */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Average rating
          </p>
          {avgRating !== null ? (
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                {avgRating.toFixed(2)}
              </p>
              <p className="text-[12px] text-muted-foreground tabular-nums">
                {data.ratings.count} review{data.ratings.count === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No public reviews yet.</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Trust avg
          </p>
          {ts.average !== null ? (
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{ts.average}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {ranked} ranked · {ts.new} new
          </p>
        </div>
      </div>

      {/* Trust Score histogram */}
      <div className="mt-6 border-t border-border/60 pt-4">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Trust Score distribution
        </p>

        {ranked === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            All caregivers are still on their first three reviews.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ts.buckets.map((b) => (
              <li key={b.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-medium tracking-wide text-foreground/70 uppercase">
                    {b.label}
                  </span>
                  <span className="text-[12px] tabular-nums text-foreground/60">{b.count}</span>
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
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <UsersRound className="size-3.5" strokeWidth={2} />
        Platform makeup
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

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Bookings, all-time
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
          {data.bookings.completed_all_time}
        </p>
        <p className="text-[11px] text-muted-foreground">completed visits</p>
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
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{count}</span>
          <span className="ml-1 text-[11px] text-muted-foreground">{pct}%</span>
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
        "rounded-2xl border p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] sm:p-6",
        total === 0 ? "border-success/40 bg-success/[0.04]" : "border-accent/30 bg-accent/[0.03]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <BadgeCheck className="size-3.5" strokeWidth={2} />
            Verification triage
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            {total === 0 ? "Inbox zero." : "Caregivers waiting on a decision."}
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
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums">{count}</p>
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
      <div className="mb-4 flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Jump to
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-[0_8px_24px_-12px_rgba(10,14,40,0.14)]"
            >
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{l.label}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{l.hint}</p>
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
