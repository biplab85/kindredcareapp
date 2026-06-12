"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Check,
  CalendarDays,
  AlertTriangle,
  Wallet,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AuthGuard } from "@/components/auth/auth-guard";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";
import { useAuthStore } from "@/lib/auth";
import { DashboardShell } from "@/components/layouts";
import {
  getGig,
  listCaregiverBookedWindows,
  type AvailabilityRange,
  type BookedWindow,
  type Gig,
} from "@/lib/gigs";
import { listPaymentMethods } from "@/lib/payments";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

/** Stable empty array so the off-dates state's identity doesn't churn each render. */
const NEVER_OFF: string[] = [];

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

interface Recipient {
  id: number;
  name: string;
  street_address: string | null;
  age: number | null;
  language: string | null;
}

const DURATION_OPTIONS = [1, 2, 3, 4, 6, 8] as const;

export default function BookGigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gigId = Number(id);

  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Book a visit">
        <BookGigView gigId={gigId} />
      </DashboardShell>
    </AuthGuard>
  );
}

function BookGigView({ gigId }: { gigId: number }) {
  const router = useRouter();
  const [gig, setGig] = useState<Gig | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [bookedWindows, setBookedWindows] = useState<BookedWindow[]>([]);
  const [offDates, setOffDates] = useState<string[]>(NEVER_OFF);
  const [loadError, setLoadError] = useState(false);
  // null = unknown (still loading or stub mode); false = configured but no card; true = ready.
  const [hasCardOnFile, setHasCardOnFile] = useState<boolean | null>(null);

  // Booking-form fields. Declared up here (above the load effect) so the
  // sole-recipient autoselect can write into them via setRecipientId /
  // setAddress without the React 19 `immutability` lint rule flagging
  // out-of-order hook references.
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [duration, setDuration] = useState(2);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      getGig(gigId),
      api.get<{ recipients: Recipient[] }>("/api/me/care-recipients"),
      listPaymentMethods(),
    ])
      .then(([g, r, pm]) => {
        setGig(g);
        setRecipients(r.data.recipients);
        // Auto-select when there's exactly one recipient — the user
        // would only have one option to click anyway. Also pre-fills
        // the visit address from that recipient's saved street_address.
        if (r.data.recipients.length === 1) {
          const sole = r.data.recipients[0];
          setRecipientId(sole.id);
          if (sole.street_address) {
            setAddress(sole.street_address);
          }
        }
        // Stub mode (Stripe not configured) keeps the dev fallback open;
        // we only gate when real Stripe is wired up.
        setHasCardOnFile(
          pm.meta.stripe_configured ? Boolean(pm.meta.default_payment_method_id) : true,
        );
        // Fire-and-forget: empty windows just means we won't preempt the conflict;
        // BookingService still hard-blocks at the transaction level.
        const caregiverUserId = g.caregiver?.user_id;
        if (caregiverUserId) {
          listCaregiverBookedWindows(caregiverUserId)
            .then((snapshot) => {
              setBookedWindows(snapshot.windows);
              setOffDates(snapshot.off_dates);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => setLoadError(true));
  }, [gigId]);

  // Re-fetch the snapshot after a 422-on-submit so the page state
  // catches up (someone else likely just claimed the same slot, or the
  // caregiver just marked the date off).
  const refreshBookedWindows = () => {
    const caregiverUserId = gig?.caregiver?.user_id;
    if (!caregiverUserId) return;
    listCaregiverBookedWindows(caregiverUserId)
      .then((snapshot) => {
        setBookedWindows(snapshot.windows);
        setOffDates(snapshot.off_dates);
      })
      .catch(() => undefined);
  };

  const totals = useMemo(() => {
    if (!gig) return { subtotal: 0, fee: 0, total: 0 };
    const subtotal = gig.hourly_rate_dollars * duration;
    const fee = subtotal * 0.075;
    return { subtotal, fee, total: subtotal + fee };
  }, [gig, duration]);

  // Four flavours, in priority order (top wins):
  //  - "already-booked" (HARD block): collides with an existing pending/confirmed/in-progress booking
  //  - "date-off" (HARD block): caregiver explicitly marked this date off (Eid, vacation)
  //  - "day-off" (soft warning): caregiver works other days but not this one
  //  - "outside-window" (soft warning): caregiver works that day but not those hours
  const availabilityHint = useMemo(() => {
    if (!gig || !date || !time) return null;

    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + duration * 60 * 60 * 1000);

    // Hard block #1 — a real existing booking trumps everything else.
    const conflict = bookedWindows.find((w) => {
      const ws = new Date(w.scheduled_start);
      const we = new Date(w.scheduled_end);
      return start < we && end > ws;
    });
    if (conflict) {
      return {
        kind: "already-booked" as const,
        conflictStart: conflict.scheduled_start,
        conflictEnd: conflict.scheduled_end,
      };
    }

    // Hard block #2 — caregiver explicitly marked this date off.
    if (offDates.includes(date)) {
      return { kind: "date-off" as const, date };
    }

    const weekly = gig.caregiver?.availability?.weekly;
    if (!weekly) return null;

    const dayKey = WEEKDAY_KEYS[start.getDay()];
    const ranges = (weekly[dayKey] ?? []) as AvailabilityRange[];
    if (ranges.length === 0) {
      // Caregiver has set availability for at least one day but not this one.
      const liveDays = WEEKDAY_KEYS.filter((d) => (weekly[d]?.length ?? 0) > 0);
      if (liveDays.length === 0) return null; // legacy/empty calendar = always available
      return {
        kind: "day-off" as const,
        liveDays,
      };
    }

    const visitStart = minutes(start);
    const visitEnd = minutes(end);
    const fits = ranges.some((r) => {
      const rs = parseHHMM(r.start);
      const re = parseHHMM(r.end);
      return rs !== null && re !== null && visitStart >= rs && visitEnd <= re;
    });
    if (fits) return null;

    return {
      kind: "outside-window" as const,
      ranges,
    };
  }, [gig, date, time, duration, bookedWindows, offDates]);

  const isHardBlocked =
    availabilityHint?.kind === "already-booked" || availabilityHint?.kind === "date-off";

  // Reactive subscription so the banner + Submit gate flips the
  // moment the user verifies their email and AuthStore re-fetches.
  const isEmailUnverified = !useAuthStore((s) => s.user?.email_verified_at);

  const canSubmit =
    !!gig &&
    recipientId !== null &&
    date.length === 10 &&
    time.length >= 5 &&
    duration >= 1 &&
    address.trim().length >= 3 &&
    !submitting &&
    !isHardBlocked &&
    hasCardOnFile !== false &&
    !isEmailUnverified;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !gig) return;

    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      toast.error("Pick a start time in the future.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/bookings", {
        gig_id: gig.id,
        care_recipient_id: recipientId,
        scheduled_start: start.toISOString(),
        duration_minutes: duration * 60,
        address_full: address.trim(),
        notes_from_family: notes.trim() || undefined,
      });
      toast.success(`Booking sent to ${gig.caregiver?.display_name ?? "the caregiver"}.`);
      router.push("/bookings");
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't send the booking right now.";
      toast.error(message);
      // Lost the race: pull the latest booked windows so the conflict surfaces inline.
      if (status === 422) refreshBookedWindows();
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&rsquo;t load the booking page.
        </h1>
        <Link href="/marketplace" className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="size-4" />
            Back to marketplace
          </Button>
        </Link>
      </div>
    );
  }

  if (!gig || !recipients) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link
        href={`/gigs/${gig.id}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to listing
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">
          Book a visit with {gig.caregiver?.display_name ?? "this caregiver"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {gig.title} · ${gig.hourly_rate_dollars.toFixed(0)}/hr
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Recipient */}
        <Section number="1" eyebrow="Who's the visit for" title="Pick a care recipient.">
          {recipients.length === 0 ? (
            <div className="rounded-xl bg-muted/40 px-5 py-6 text-center text-sm text-muted-foreground">
              You haven&rsquo;t added anyone yet.{" "}
              <Link href="/care-recipients" className="font-medium text-primary hover:underline">
                Add a recipient first
              </Link>
              .
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recipients.map((r) => {
                const selected = r.id === recipientId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientId(r.id);
                        // Pre-fill the visit address from the recipient's
                        // saved address. If they don't have one on file,
                        // leave whatever's already typed alone (could be
                        // mid-edit). User can still override per booking.
                        if (r.street_address) {
                          setAddress(r.street_address);
                        }
                      }}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        selected
                          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/30"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((n) => n.charAt(0).toUpperCase())
                          .join("")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {r.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {r.age ? `${r.age} yrs` : "Age not set"}
                          {r.language && ` · ${r.language}`}
                        </span>
                      </span>
                      {selected && (
                        <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Schedule */}
        <Section number="2" eyebrow="When" title="Date, time, and how long.">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <div>
              <Label htmlFor="date" className="text-sm">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                min={todayIso()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label htmlFor="time" className="text-sm">
                Start time
              </Label>
              <Input
                id="time"
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 h-11"
              />
            </div>
          </div>
          <div className="mt-5">
            <Label className="text-sm">Duration</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDuration(h)}
                  className={cn(
                    "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    duration === h
                      ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "border-border bg-card text-foreground/70 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground",
                  )}
                >
                  {h} hour{h > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Address */}
        <Section number="3" eyebrow="Where" title="The visit address.">
          <div>
            <Label htmlFor="address" className="text-sm">
              Street address
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 King Street West, City, Province"
              className="mt-1.5 h-11"
            />
          </div>
        </Section>

        {/* Notes */}
        <Section number="4" eyebrow="A note" title="Anything the caregiver should know?">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional. Speech preferences, mobility notes, what would make a good first visit."
            rows={4}
            maxLength={500}
            className="rounded-lg"
          />
          <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">
            {notes.length} / 500
          </p>
        </Section>

        {/* Availability hint — soft warnings (day-off / outside-window) keep
              Submit enabled; "already-booked" and "date-off" are hard blocks
              (Submit disabled). */}
        {availabilityHint && (
          <div
            className={cn(
              "flex items-start gap-3.5 rounded-xl border p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]",
              isHardBlocked
                ? "border-destructive/30 bg-destructive/[0.05]"
                : "border-accent/30 bg-accent/[0.06]",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                isHardBlocked ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent",
              )}
            >
              <AlertTriangle className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              {availabilityHint.kind === "already-booked" ? (
                <>
                  <p className="text-sm font-semibold text-destructive">
                    {gig.caregiver?.display_name ?? "This caregiver"} is already booked then.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                    They&rsquo;ve got a visit from{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(availabilityHint.conflictStart)}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(availabilityHint.conflictEnd)}
                    </span>
                    . Pick a different window — that one&rsquo;s spoken for.
                  </p>
                </>
              ) : availabilityHint.kind === "date-off" ? (
                <>
                  <p className="text-sm font-semibold text-destructive">
                    {gig.caregiver?.display_name ?? "This caregiver"} is taking that day off.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                    They&rsquo;ve marked{" "}
                    <span className="font-medium">{formatLocalDate(availabilityHint.date)}</span> as
                    unavailable (vacation, holiday, or personal day). Pick another date.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-accent">
                    {gig.caregiver?.display_name ?? "This caregiver"} may not be free at that time.
                  </p>
                  {availabilityHint.kind === "day-off" ? (
                    <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                      They&rsquo;ve published hours for{" "}
                      <span className="font-medium">
                        {availabilityHint.liveDays
                          .map((d) => DAY_LABELS[d as WeekdayKey])
                          .join(", ")}
                      </span>
                      , but not the day you picked. The booking will still go through — they can
                      accept or decline.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                      Their published windows that day are{" "}
                      <span className="font-medium">
                        {availabilityHint.ranges
                          .map((r) => `${formatHHMM(r.start)} – ${formatHHMM(r.end)}`)
                          .join(" · ")}
                      </span>
                      . You can still send the request — they&rsquo;ll accept or decline.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Total slip */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
              <Wallet className="size-4" strokeWidth={2} />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Estimate</h2>
          </div>
          <div className="p-5">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  ${gig.hourly_rate_dollars.toFixed(2)} × {duration}h
                </dt>
                <dd className="font-medium tabular-nums text-foreground">
                  ${totals.subtotal.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Platform fee 7.5%</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  ${totals.fee.toFixed(2)}
                </dd>
              </div>
              <div aria-hidden className="my-1 border-t border-border/60" />
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-foreground">Total</dt>
                <dd className="text-xl font-bold tabular-nums text-foreground">
                  ${totals.total.toFixed(2)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2} />
              Authorized when the caregiver accepts. Captured after the visit.
            </p>
          </div>
        </div>

        {/* Email-verify gate — hard-block before any other check. The
              backend validator rejects too, but a callout up front
              beats a 422 surprise on submit. */}
        {isEmailUnverified && <EmailVerifyBanner context="booking" />}

        {/* Card-on-file gate — hard-block when Stripe is configured but
              the family has no default payment method. The backend
              validator will also reject, but failing the user at submit
              time is worse UX than telling them upfront. */}
        {hasCardOnFile === false && (
          <div className="flex items-start gap-3.5 rounded-xl border border-destructive/30 bg-destructive/[0.05] p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <CreditCard className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Add a card before booking.</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                We hold the visit total on your card the moment the caregiver accepts. Set one up
                once and every future booking auto-charges at check-out.
              </p>
              <Link href="/settings/payment-methods" className="mt-4 inline-block">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/5"
                >
                  Add a payment method
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="h-12 w-full cursor-pointer bg-accent text-base text-accent-foreground hover:bg-accent/90"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <CalendarDays className="size-4" />
              Send booking request
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

function Section({
  number,
  eyebrow,
  title,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(10,14,40,0.04)]">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold tabular-nums text-primary">
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_LABELS: Record<WeekdayKey, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

function minutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Convert "14:00" → "2:00 p.m." for the warning copy. */
function formatHHMM(s: string): string {
  const min = parseHHMM(s);
  if (min === null) return s;
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

/** ISO-8601 datetime → "Tue May 5, 2:00 p.m." for the conflict callout. */
function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** YYYY-MM-DD → "Tue May 5, 2026" for the date-off callout. */
function formatLocalDate(ymd: string): string {
  // Parse as a local-date noon to dodge any DST/UTC drift on the boundary.
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
