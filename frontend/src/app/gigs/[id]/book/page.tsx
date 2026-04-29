"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { getGig, type Gig } from "@/lib/gigs";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface Recipient {
  id: number;
  name: string;
  age: number | null;
  language: string | null;
}

const NEIGHBOURHOODS = [
  { slug: "oshawa", name: "Oshawa" },
  { slug: "whitby", name: "Whitby" },
  { slug: "ajax", name: "Ajax" },
  { slug: "pickering", name: "Pickering" },
  { slug: "clarington", name: "Clarington" },
] as const;

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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([getGig(gigId), api.get<{ recipients: Recipient[] }>("/api/me/care-recipients")])
      .then(([g, r]) => {
        setGig(g);
        setRecipients(r.data.recipients);
      })
      .catch(() => setLoadError(true));
  }, [gigId]);

  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [duration, setDuration] = useState(2);
  const [neighbourhood, setNeighbourhood] = useState<string>("oshawa");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => {
    if (!gig) return { subtotal: 0, fee: 0, total: 0 };
    const subtotal = gig.hourly_rate_dollars * duration;
    const fee = subtotal * 0.075;
    return { subtotal, fee, total: subtotal + fee };
  }, [gig, duration]);

  const canSubmit =
    !!gig &&
    recipientId !== null &&
    date.length === 10 &&
    time.length >= 5 &&
    duration >= 1 &&
    address.trim().length >= 3 &&
    neighbourhood.length > 0 &&
    !submitting;

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
        address_neighbourhood: NEIGHBOURHOODS.find((n) => n.slug === neighbourhood)?.name ?? "",
        notes_from_family: notes.trim() || undefined,
      });
      toast.success(`Booking sent to ${gig.caregiver?.display_name ?? "the caregiver"}.`);
      router.push("/bookings");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't send the booking right now.";
      toast.error(message);
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
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />

      <div className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6">
        <Link
          href={`/gigs/${gig.id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to listing
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Booking slip · No. {String(gig.id).padStart(4, "0")}
          </div>
          <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl">
            Book a visit with
            <br />
            <span className="italic font-normal text-primary">
              {gig.caregiver?.display_name ?? "this caregiver"}
            </span>
            .
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground italic">
            &ldquo;{gig.title}&rdquo; · ${gig.hourly_rate_dollars.toFixed(0)}/hr
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Recipient */}
          <Section number="01" eyebrow="Who's the visit for" title="Pick a care recipient.">
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
                        onClick={() => setRecipientId(r.id)}
                        className={cn(
                          "w-full rounded-xl border-2 px-4 py-3 text-left transition-all",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border/60 bg-card hover:border-foreground/30",
                        )}
                      >
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                          {r.age ? `${r.age} yrs` : "Age not set"}
                          {r.language && ` · ${r.language}`}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Schedule */}
          <Section number="02" eyebrow="When" title="Date, time, and how long.">
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
                  className="mt-2 h-12 rounded-xl border-foreground/20 bg-background/70 text-base"
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
                  className="mt-2 h-12 rounded-xl border-foreground/20 bg-background/70 text-base"
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
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      duration === h
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-background hover:border-foreground/40",
                    )}
                  >
                    {h} hour{h > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Address */}
          <Section number="03" eyebrow="Where" title="The visit address.">
            <div className="space-y-4">
              <div>
                <Label htmlFor="address" className="text-sm">
                  Street address
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 King Street West"
                  className="mt-2 h-12 rounded-xl border-foreground/20 bg-background/70 text-base"
                />
              </div>
              <fieldset>
                <legend className="text-sm font-medium">Neighbourhood</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {NEIGHBOURHOODS.map((n) => (
                    <button
                      key={n.slug}
                      type="button"
                      onClick={() => setNeighbourhood(n.slug)}
                      className={cn(
                        "rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-all",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        neighbourhood === n.slug
                          ? "border-primary bg-primary/5"
                          : "border-border/60 bg-card hover:border-foreground/30",
                      )}
                    >
                      {n.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </Section>

          {/* Notes */}
          <Section number="04" eyebrow="A note" title="Anything the caregiver should know?">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional. Speech preferences, mobility notes, what would make a good first visit."
              rows={4}
              maxLength={500}
              className="rounded-xl border-foreground/20 bg-background/70"
            />
            <p className="mt-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {notes.length} / 500
            </p>
          </Section>

          {/* Total slip */}
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Estimate
            </p>
            <dl className="mt-3 space-y-1.5 font-mono text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  ${gig.hourly_rate_dollars.toFixed(2)} × {duration}h
                </dt>
                <dd>${totals.subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Platform fee 7.5%</dt>
                <dd>${totals.fee.toFixed(2)}</dd>
              </div>
              <div
                aria-hidden
                className="my-2 border-t border-dashed border-border/60"
                style={{ borderStyle: "dashed" }}
              />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>${totals.total.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Authorized when the caregiver accepts. Captured after the visit.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-4 border-t border-border/60 pt-6">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              className="h-12 bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  Send booking request
                  <Check className="size-4" strokeWidth={2.5} />
                </>
              )}
              <CalendarDays className="size-4" />
            </Button>
          </div>
        </form>
      </div>
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
    <section>
      <div className="mb-5 flex items-start gap-4">
        <span className="font-mono text-sm tracking-[0.22em] text-foreground/40 uppercase">
          § {number}
        </span>
        <div className="flex-1">
          <p className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {title}
          </h2>
        </div>
      </div>
      <div className="ml-0 sm:ml-12">{children}</div>
    </section>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
