"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Clock,
  Sparkles,
  DollarSign,
  User,
  Loader2,
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { fetchCaregiverGig, type CaregiverGig } from "@/lib/caregiver-feed";

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

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Gig detail">
        <JobDetail id={Number(id)} />
      </DashboardShell>
    </AuthGuard>
  );
}

function JobDetail({ id }: { id: number }) {
  const [gig, setGig] = useState<CaregiverGig | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCaregiverGig(id)
      .then((data) => {
        if (!alive) return;
        setGig(data);
        setLoadError(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loadError) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&rsquo;t find that notice.
        </h1>
        <p className="mt-2 text-muted-foreground">
          It may have been taken down, or it&rsquo;s for a service you don&rsquo;t offer.
        </p>
        <Link href="/jobs" className="mt-6 inline-block">
          <Button variant="outline">Back to the noticeboard</Button>
        </Link>
      </section>
    );
  }

  if (!gig) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const Icon = gig.service_category ? (iconMap[gig.service_category.icon] ?? Heart) : Heart;
  const start = new Date(gig.scheduled_start);
  const end = new Date(gig.scheduled_end);
  const dateLine = start.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLine = `${start.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;
  const duration = Math.round((end.getTime() - start.getTime()) / 3_600_000);

  const recurringSummary =
    gig.is_recurring && gig.recurrence_pattern
      ? {
          days: gig.recurrence_pattern.days.map((d) => WEEKDAY_LABELS[d] ?? d).join(" · "),
          endDate: gig.recurrence_pattern.end_date
            ? new Date(gig.recurrence_pattern.end_date).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : null,
        }
      : null;

  const prefLines: string[] = [];
  if (gig.preferences.gender && gig.preferences.gender !== "any") {
    prefLines.push(
      gig.preferences.gender === "female"
        ? "Female caregiver preferred"
        : "Male caregiver preferred",
    );
  }
  if (gig.preferences.language) prefLines.push(`Speaks ${gig.preferences.language}`);
  const rateLine =
    gig.preferences.rate_max != null
      ? `Rate capped at $${gig.preferences.rate_max}/hour`
      : "No rate cap";

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
      <Link
        href="/jobs"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to the noticeboard
      </Link>

      <header className="border-b border-border/60 pb-8">
        <div className="flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" />
          {gig.is_recurring ? "A recurring notice" : "A one-time notice"}
        </div>

        <div className="mt-6 flex items-start gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-8" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              Family is seeking
            </p>
            <h1 className="mt-1 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {gig.service_category?.name ?? "Help"}
            </h1>
            {gig.service_category && (
              <p className="mt-2 text-muted-foreground">{gig.service_category.description}</p>
            )}
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[2fr_1fr]">
        {/* Body */}
        <div>
          <section>
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              In the family&rsquo;s words
            </p>
            <blockquote className="mt-3 border-l-2 border-accent/60 pl-5 text-lg leading-relaxed italic text-foreground/90">
              &ldquo;{gig.description}&rdquo;
            </blockquote>
          </section>

          <section className="mt-10 rounded-2xl bg-success/[0.06] p-6 ring-1 ring-success/25">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">You&rsquo;re a fit.</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  This notice is for a service you offer. Applications open when our matching engine
                  goes live in the next phase — you&rsquo;ll be notified.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              A note on privacy
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You&rsquo;re seeing the neighbourhood only. The full street address is shared once a
              booking is accepted by both sides — protecting the family and keeping visits
              GPS-verified.
            </p>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <dl className="space-y-6 rounded-2xl bg-card p-6 ring-1 ring-border/60">
            <MetaRow
              icon={CalendarDays}
              label="When"
              primary={dateLine}
              secondary={`${timeLine} (${duration}h)`}
            />
            {recurringSummary && (
              <MetaRow
                icon={Clock}
                label="Repeats"
                primary={`Every ${recurringSummary.days}`}
                secondary={recurringSummary.endDate ? `Until ${recurringSummary.endDate}` : null}
              />
            )}
            <MetaRow
              icon={MapPin}
              label="Where"
              primary={gig.neighbourhood.label}
              secondary="Full address shared when booked"
            />
            {prefLines.length > 0 && (
              <MetaRow icon={User} label="Preferences" primary={prefLines.join(" · ")} />
            )}
            <MetaRow icon={DollarSign} label="Pay" primary={rateLine} />
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <Button size="lg" disabled className="w-full">
              <Sparkles className="size-4" />
              Apply — coming soon
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Applications unlock with the matching engine (Phase 6).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string | null;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted text-foreground/70">
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div>
        <dt className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm leading-snug text-foreground">{primary}</dd>
        {secondary && <p className="mt-0.5 text-xs text-muted-foreground italic">{secondary}</p>}
      </div>
    </div>
  );
}
