"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  User,
  DollarSign,
  Clock,
  Image as ImageIcon,
  Loader2,
  Pencil,
  XCircle,
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { getGig, cancelGig, type Gig } from "@/lib/gigs";
import { cn } from "@/lib/utils";

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

export default function GigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Gig detail">
        <GigDetail id={Number(id)} />
      </DashboardShell>
    </AuthGuard>
  );
}

function GigDetail({ id }: { id: number }) {
  const router = useRouter();
  const [gig, setGig] = useState<Gig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    // State mutations only fire inside the promise callbacks so React 19's
    // set-state-in-effect rule stays satisfied.
    let alive = true;
    getGig(id)
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

  const handleCancel = async () => {
    if (!gig) return;
    if (!confirm("Cancel this gig?")) return;
    setCancelling(true);
    try {
      const updated = await cancelGig(gig.id);
      setGig(updated);
      toast.success("Gig cancelled.");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not cancel the gig.";
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  if (loadError) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn&rsquo;t find that gig.</h1>
        <p className="mt-2 text-muted-foreground">
          It may have been removed, or you may not have access to it.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/gigs")}>
          Back to your gigs
        </Button>
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
  const timeLine = `${start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;
  const durationHours = Math.round((end.getTime() - start.getTime()) / 3_600_000);

  const canEdit = gig.status === "open";
  const canCancel = gig.status === "open" || gig.status === "matched";

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
    prefLines.push(gig.preferences.gender === "female" ? "Female caregiver" : "Male caregiver");
  }
  if (gig.preferences.language) prefLines.push(`Speaks ${gig.preferences.language}`);
  const rateLine =
    gig.preferences.rate_max != null
      ? `Up to $${gig.preferences.rate_max}/hour`
      : "Accepts caregiver rate";

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <Link
        href="/gigs"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All your gigs
      </Link>

      {/* Header */}
      <header className="border-b border-border/60 pb-8">
        <div className="flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" />
          {gig.is_recurring ? "Recurring notice" : "One-time notice"}
          <span className="flex-1" />
          <StatusBadge status={gig.status} />
        </div>

        <div className="mt-6 flex items-start gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-8" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              Seeking
            </p>
            <h1 className="mt-1 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {gig.service_category?.name ?? "Gig"}
            </h1>
            {gig.service_category && (
              <p className="mt-2 text-muted-foreground">{gig.service_category.description}</p>
            )}
          </div>
        </div>
      </header>

      {/* Two-column: left body / right meta */}
      <div className="mt-10 grid gap-12 lg:grid-cols-[2fr_1fr]">
        {/* Body */}
        <div>
          <section>
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
              In our own words
            </p>
            <blockquote className="mt-3 border-l-2 border-accent/60 pl-5 text-lg leading-relaxed italic text-foreground/90">
              &ldquo;{gig.description}&rdquo;
            </blockquote>
          </section>

          {gig.photo_url && (
            <section className="mt-10">
              <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                <ImageIcon className="mr-1 inline size-3" />
                Attached
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gig.photo_url}
                alt="Attached reference"
                className="max-h-96 w-auto rounded-xl object-contain ring-1 ring-border/60"
              />
            </section>
          )}

          {/* Next steps callout */}
          <section className="mt-12 rounded-2xl bg-primary/[0.05] p-6 ring-1 ring-primary/20">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">
                  {gig.posting_mode === "open"
                    ? "Broadcasting in the feed."
                    : "Your shortlist is ready."}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {gig.posting_mode === "open"
                    ? "This notice is visible to every verified caregiver in the area who offers this service. The first qualifying claim becomes the match."
                    : "We’ve ranked the verified caregivers who fit — have a look and pick who you’d like to book."}
                </p>
                {gig.posting_mode === "matched" && gig.status === "open" && (
                  <Link
                    href={`/gigs/${gig.id}/matches`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    See the shortlist
                    <ArrowRight className="size-4" strokeWidth={2.25} />
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Meta sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <dl className="space-y-6 rounded-2xl bg-card p-6 ring-1 ring-border/60">
            <MetaRow
              icon={CalendarDays}
              label="When"
              primary={dateLine}
              secondary={`${timeLine} (${durationHours}h)`}
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
              primary={gig.location_address}
              secondary={gig.care_recipient ? `For ${gig.care_recipient.name}` : null}
            />
            {prefLines.length > 0 && (
              <MetaRow icon={User} label="Preferences" primary={prefLines.join(" · ")} />
            )}
            <MetaRow icon={DollarSign} label="Pay" primary={rateLine} />
          </dl>

          {/* Actions */}
          <div className="mt-5 space-y-2">
            {canEdit && (
              <Link href={`/gigs/${gig.id}/edit`}>
                <Button variant="outline" className="w-full" size="lg">
                  <Pencil className="size-4" />
                  Edit gig
                </Button>
              </Link>
            )}
            {canCancel && (
              <Button
                variant="ghost"
                size="lg"
                disabled={cancelling}
                onClick={handleCancel}
                className="w-full text-destructive hover:text-destructive"
              >
                {cancelling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                Cancel gig
              </Button>
            )}
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

function StatusBadge({ status }: { status: Gig["status"] }) {
  const styles: Record<Gig["status"], string> = {
    open: "bg-primary/10 text-primary ring-primary/30",
    matched: "bg-info/10 text-info ring-info/30",
    booked: "bg-success/10 text-success ring-success/30",
    completed: "bg-muted text-foreground/70 ring-foreground/20",
    cancelled: "bg-destructive/10 text-destructive ring-destructive/25",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase ring-1",
        styles[status],
      )}
    >
      {status}
    </Badge>
  );
}
