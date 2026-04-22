"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  Loader2,
  X,
  Upload,
  Pencil,
  CalendarDays,
  RefreshCw,
  Sparkles,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StepIndicator } from "@/components/ui/step-indicator";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { fetchServiceCategories, type ServiceCategory } from "@/lib/service-categories";
import { createGig, type PostingMode } from "@/lib/gigs";
import { cn } from "@/lib/utils";
import { GigPreview } from "./_components/gig-preview";

/* ─────────────────────────────────────────────────────────────
 * Reference data
 * ───────────────────────────────────────────────────────────── */

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

const NEIGHBOURHOODS = [
  { slug: "oshawa", name: "Oshawa", latitude: 43.8975, longitude: -78.8658 },
  { slug: "whitby", name: "Whitby", latitude: 43.8975, longitude: -78.9428 },
  { slug: "ajax", name: "Ajax", latitude: 43.8509, longitude: -79.0204 },
  { slug: "pickering", name: "Pickering", latitude: 43.8384, longitude: -79.0868 },
  {
    slug: "clarington",
    name: "Clarington (Bowmanville)",
    latitude: 43.9121,
    longitude: -78.6878,
  },
] as const;

const WEEKDAYS = [
  { slug: "mon", short: "M", full: "Monday" },
  { slug: "tue", short: "T", full: "Tuesday" },
  { slug: "wed", short: "W", full: "Wednesday" },
  { slug: "thu", short: "T", full: "Thursday" },
  { slug: "fri", short: "F", full: "Friday" },
  { slug: "sat", short: "S", full: "Saturday" },
  { slug: "sun", short: "S", full: "Sunday" },
] as const;

type WeekdaySlug = (typeof WEEKDAYS)[number]["slug"];

const DURATION_OPTIONS = [1, 2, 3, 4, 6, 8] as const;

const LANGUAGES = [
  "English",
  "French",
  "Hindi",
  "Punjabi",
  "Tagalog",
  "Mandarin",
  "Cantonese",
  "Tamil",
  "Arabic",
  "Urdu",
  "Spanish",
  "Portuguese",
  "Italian",
  "Korean",
];

const EXPERIENCE_TAGS = [
  "Dementia-aware",
  "Patient",
  "Calm",
  "Great conversationalist",
  "Good with pets",
  "Punctual",
  "Cultural fluency",
  "Light humour",
];

const STEPS = [
  { label: "Service", description: "What's needed" },
  { label: "Details", description: "Describe it" },
  { label: "Where", description: "Neighbourhood" },
  { label: "When", description: "Schedule" },
  { label: "Who", description: "Preferences" },
  { label: "Budget", description: "Rate cap" },
  { label: "Review", description: "Post it" },
];

/* ─────────────────────────────────────────────────────────────
 * Page + shell
 * ───────────────────────────────────────────────────────────── */

export default function NewGigPage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Post a gig">
        <Suspense fallback={<InitialLoad />}>
          <NewGigFlow />
        </Suspense>
      </DashboardShell>
    </AuthGuard>
  );
}

function InitialLoad() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-7 animate-spin text-primary" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main form
 * ───────────────────────────────────────────────────────────── */

function NewGigFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategorySlug = searchParams.get("category");

  // ─── categories
  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
  const [catLoadError, setCatLoadError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => setCatLoadError(true));
  }, []);

  // ─── form state
  const [step, setStep] = useState(1);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [address, setAddress] = useState("");
  const [neighbourhood, setNeighbourhood] = useState<string>("");

  const [scheduleMode, setScheduleMode] = useState<"once" | "recurring">("once");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationHours, setDurationHours] = useState(2);
  const [recurringDays, setRecurringDays] = useState<Set<WeekdaySlug>>(new Set());
  const [recurringEndDate, setRecurringEndDate] = useState("");

  const [genderPref, setGenderPref] = useState<"" | "any" | "female" | "male">("");
  const [languagePref, setLanguagePref] = useState("");
  const [experienceTags, setExperienceTags] = useState<string[]>([]);

  const [budgetMode, setBudgetMode] = useState<"any" | "capped">("any");
  const [rateMax, setRateMax] = useState(35);

  const [postingMode, setPostingMode] = useState<PostingMode>("matched");

  const [submitting, setSubmitting] = useState(false);

  // ─── derived
  // Prefer an explicit user pick; fall back to the ?category= slug once
  // categories have loaded. Derivation avoids a setState-in-effect.
  const effectiveCategoryId = useMemo(() => {
    if (categoryId !== null) return categoryId;
    if (!categories || !initialCategorySlug) return null;
    return categories.find((c) => c.slug === initialCategorySlug)?.id ?? null;
  }, [categoryId, categories, initialCategorySlug]);

  const selectedCategory = useMemo(
    () =>
      effectiveCategoryId !== null
        ? (categories?.find((c) => c.id === effectiveCategoryId) ?? null)
        : null,
    [categories, effectiveCategoryId],
  );

  const neighbourhoodInfo = useMemo(
    () => NEIGHBOURHOODS.find((n) => n.slug === neighbourhood) ?? null,
    [neighbourhood],
  );

  const scheduleLine = useMemo(() => {
    if (!scheduledDate) return "";
    const d = new Date(`${scheduledDate}T${startTime || "09:00"}`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [scheduledDate, startTime]);

  const scheduleDetail = useMemo(() => {
    if (!scheduledDate || !startTime) return "";
    const start = new Date(`${scheduledDate}T${startTime}`);
    if (Number.isNaN(start.getTime())) return "";
    const end = new Date(start.getTime() + durationHours * 3600 * 1000);
    const fmt = (d: Date) => d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
    return `${fmt(start)} – ${fmt(end)} (${durationHours}h)`;
  }, [scheduledDate, startTime, durationHours]);

  const recurringNote = useMemo(() => {
    if (scheduleMode !== "recurring" || recurringDays.size === 0) return null;
    const days = WEEKDAYS.filter((w) => recurringDays.has(w.slug))
      .map((w) => w.full.slice(0, 3))
      .join(" · ");
    const until = recurringEndDate
      ? ` until ${new Date(recurringEndDate).toLocaleDateString("en-CA", {
          month: "short",
          day: "numeric",
        })}`
      : "";
    return `Every ${days}${until}`;
  }, [scheduleMode, recurringDays, recurringEndDate]);

  const preferencesLines = useMemo(() => {
    const lines: string[] = [];
    if (genderPref && genderPref !== "any") {
      lines.push(genderPref === "female" ? "Female caregiver" : "Male caregiver");
    }
    if (languagePref) lines.push(`Speaks ${languagePref}`);
    if (experienceTags.length > 0) {
      lines.push(
        experienceTags.length <= 2
          ? experienceTags.join(", ")
          : `${experienceTags.slice(0, 2).join(", ")} +${experienceTags.length - 2}`,
      );
    }
    return lines;
  }, [genderPref, languagePref, experienceTags]);

  const budgetLine = useMemo(
    () => (budgetMode === "capped" ? `Up to $${rateMax}/hour` : "Accepts caregiver rate"),
    [budgetMode, rateMax],
  );

  // ─── validation
  // Pure structural checks — no time-of-day comparisons (those run in the
  // advance handler so render stays pure per React 19 rules).
  const canContinueStep = (n: number): boolean => {
    switch (n) {
      case 1:
        return effectiveCategoryId !== null;
      case 2:
        return description.trim().length >= 20 && description.trim().length <= 500;
      case 3:
        return address.trim().length >= 3 && neighbourhood !== "";
      case 4: {
        if (!scheduledDate || !startTime) return false;
        if (durationHours < 1) return false;
        if (scheduleMode === "recurring" && recurringDays.size === 0) return false;
        return true;
      }
      case 5:
        return true;
      case 6:
        if (budgetMode === "any") return true;
        return rateMax >= 18 && rateMax <= 50;
      default:
        return true;
    }
  };

  const canContinue = canContinueStep(step);

  // ─── handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photos must be under 5MB.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const toggleDay = (day: WeekdaySlug) => {
    setRecurringDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setExperienceTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const goNext = () => {
    if (!canContinue) return;
    // Time-based checks run here so render stays pure.
    if (step === 4) {
      const start = new Date(`${scheduledDate}T${startTime}`);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
        toast.error("Please pick a start time in the future.");
        return;
      }
      if (
        scheduleMode === "recurring" &&
        recurringEndDate &&
        new Date(recurringEndDate).getTime() < start.getTime()
      ) {
        toast.error("The end date should be after the first visit.");
        return;
      }
    }
    setStep((s) => Math.min(7, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!selectedCategory || !neighbourhoodInfo) return;
    const start = new Date(`${scheduledDate}T${startTime}`);
    const end = new Date(start.getTime() + durationHours * 3600 * 1000);

    setSubmitting(true);
    try {
      const gig = await createGig({
        service_category_id: selectedCategory.id,
        description: description.trim(),
        location_address: address.trim(),
        latitude: neighbourhoodInfo.latitude,
        longitude: neighbourhoodInfo.longitude,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        is_recurring: scheduleMode === "recurring",
        recurrence_pattern:
          scheduleMode === "recurring"
            ? {
                days: Array.from(recurringDays) as WeekdaySlug[],
                end_date: recurringEndDate || null,
              }
            : null,
        preferences: {
          gender: genderPref ? genderPref : null,
          language: languagePref || null,
          rate_max: budgetMode === "capped" ? rateMax : null,
        },
        posting_mode: postingMode,
        photo,
      });
      toast.success(
        postingMode === "matched"
          ? "Gig posted. Finding your shortlist now."
          : "Gig posted. Caregivers in your area can claim it.",
      );
      // After posting we either jump straight to the shortlist or back to
      // the gig detail page — mode decides which feels right.
      router.push(postingMode === "matched" ? `/gigs/${gig.id}/matches` : `/gigs/${gig.id}`);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong. Please try again.";
      toast.error(message);
      setSubmitting(false);
    }
  };

  /* ─── loading / error shells ─── */

  if (catLoadError) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn&rsquo;t load services</h1>
        <p className="mt-2 text-muted-foreground">
          Refresh the page in a moment, or head back to browse the catalogue.
        </p>
        <Link href="/services" className="mt-6 inline-block">
          <Button variant="outline">Back to services</Button>
        </Link>
      </section>
    );
  }

  if (!categories) {
    return <InitialLoad />;
  }

  /* ─── render ─── */

  return (
    <div className="relative">
      {/* Paper background wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.035 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 max-w-3xl">
          <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Post a notice
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Tell us who you&rsquo;re
            <br />
            <span className="italic font-normal text-primary">looking for</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            We&rsquo;ll show your request to verified neighbours who match the fit. Takes about
            three minutes.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-10">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        {/* Two-column layout */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-16">
          {/* FORM COLUMN */}
          <div className="min-w-0">
            <div key={step} className="animate-in fade-in slide-in-from-right-2 duration-300">
              {step === 1 && (
                <StepShell
                  number="01"
                  eyebrow="A service"
                  title="What kind of help would be most welcome?"
                  hint="Start here. You can change it later if it isn't quite right."
                >
                  {selectedCategory && !categoryPickerOpen ? (
                    <SelectedCategoryCard
                      category={selectedCategory}
                      onChange={() => setCategoryPickerOpen(true)}
                    />
                  ) : (
                    <CategoryPicker
                      categories={categories}
                      selectedId={categoryId}
                      onSelect={(id) => {
                        setCategoryId(id);
                        setCategoryPickerOpen(false);
                      }}
                    />
                  )}
                </StepShell>
              )}

              {step === 2 && (
                <StepShell
                  number="02"
                  eyebrow="In your own words"
                  title="Describe what would help."
                  hint="A few honest sentences. What does a good afternoon look like?"
                >
                  <div>
                    <Label htmlFor="desc" className="sr-only">
                      Description
                    </Label>
                    <Textarea
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Mum loves conversation over tea and would enjoy going to the park together. She uses a walker and speaks Cantonese most naturally. Mondays and Wednesdays would be wonderful…"
                      rows={7}
                      maxLength={500}
                      className="min-h-40 rounded-xl border-foreground/20 bg-background/70 text-base leading-relaxed"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span
                        className={cn(
                          description.trim().length > 0 &&
                            description.trim().length < 20 &&
                            "text-destructive",
                        )}
                      >
                        {description.trim().length < 20
                          ? `${20 - description.trim().length} more characters needed`
                          : "Looks good."}
                      </span>
                      <span className="font-mono tabular-nums">{description.length} / 500</span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="mb-2 font-mono text-[10px] tracking-[0.22em] text-foreground/45 uppercase">
                      Optional — a photo helps
                    </p>

                    {photoPreview ? (
                      <div className="relative overflow-hidden rounded-xl ring-1 ring-border/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoPreview}
                          alt="Uploaded reference"
                          className="h-56 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearPhoto}
                          className="absolute top-3 right-3 rounded-full bg-background/90 p-1.5 text-foreground ring-1 ring-border shadow-sm transition-colors hover:bg-background"
                          aria-label="Remove photo"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="photo-upload"
                        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/20 bg-muted/30 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
                      >
                        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Upload className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Add a photo</p>
                          <p className="text-xs text-muted-foreground">
                            A grocery list, a garden, anything useful (max 5 MB)
                          </p>
                        </div>
                        <input
                          id="photo-upload"
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>
                </StepShell>
              )}

              {step === 3 && (
                <StepShell
                  number="03"
                  eyebrow="A location"
                  title="Where will the visit happen?"
                  hint="We'll only share the exact address with a caregiver once you've confirmed the booking."
                >
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="address" className="text-sm">
                        Street address
                      </Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g., 123 King Street West"
                        className="mt-2 h-12 rounded-xl border-foreground/20 bg-background/70 text-base"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Only the neighbourhood is shown on your public notice.
                      </p>
                    </div>

                    <fieldset>
                      <legend className="text-sm font-medium">Neighbourhood</legend>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Pick the nearest Durham Region community.
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {NEIGHBOURHOODS.map((n) => (
                          <button
                            key={n.slug}
                            type="button"
                            onClick={() => setNeighbourhood(n.slug)}
                            className={cn(
                              "rounded-xl border-2 px-4 py-4 text-left transition-all",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                              neighbourhood === n.slug
                                ? "border-primary bg-primary/5 text-foreground"
                                : "border-border/60 bg-card hover:border-foreground/30",
                            )}
                          >
                            <p className="text-sm font-semibold">{n.name}</p>
                            <p className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                              Durham · ON
                            </p>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </StepShell>
              )}

              {step === 4 && (
                <StepShell
                  number="04"
                  eyebrow="A time"
                  title="When would the visit happen?"
                  hint="One visit, or a gentle rhythm every week — both are welcome."
                >
                  <div className="mb-6 inline-flex rounded-xl bg-muted/60 p-1 ring-1 ring-border/60">
                    <button
                      type="button"
                      onClick={() => setScheduleMode("once")}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        scheduleMode === "once"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                          : "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="size-4" />
                      One time
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode("recurring")}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        scheduleMode === "recurring"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                          : "text-muted-foreground",
                      )}
                    >
                      <RefreshCw className="size-4" />
                      Recurring
                    </button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
                    <div>
                      <Label htmlFor="date" className="text-sm">
                        {scheduleMode === "recurring" ? "Starts on" : "Date"}
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        min={todayIso()}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
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
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        step={900}
                        className="mt-2 h-12 rounded-xl border-foreground/20 bg-background/70 text-base"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <Label className="text-sm">Duration</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DURATION_OPTIONS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setDurationHours(h)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            durationHours === h
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/70 bg-background hover:border-foreground/40",
                          )}
                        >
                          {h} hour{h > 1 ? "s" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  {scheduleMode === "recurring" && (
                    <div className="mt-8 space-y-6">
                      <fieldset>
                        <legend className="text-sm font-medium">Which days of the week?</legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {WEEKDAYS.map((day) => {
                            const on = recurringDays.has(day.slug);
                            return (
                              <button
                                key={day.slug}
                                type="button"
                                onClick={() => toggleDay(day.slug)}
                                aria-pressed={on}
                                className={cn(
                                  "inline-flex size-11 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border/70 bg-background hover:border-foreground/40",
                                )}
                                title={day.full}
                              >
                                {day.short}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>

                      <div>
                        <Label htmlFor="end-date" className="text-sm">
                          Ends on <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          min={scheduledDate || todayIso()}
                          value={recurringEndDate}
                          onChange={(e) => setRecurringEndDate(e.target.value)}
                          className="mt-2 h-12 w-full rounded-xl border-foreground/20 bg-background/70 text-base sm:w-64"
                        />
                      </div>
                    </div>
                  )}
                </StepShell>
              )}

              {step === 5 && (
                <StepShell
                  number="05"
                  eyebrow="A good match"
                  title="Any gentle preferences?"
                  hint="All optional. You can leave everything blank and we'll simply match on service and area."
                >
                  <div className="space-y-7">
                    <div>
                      <Label className="text-sm">Caregiver gender</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          [
                            { v: "", label: "No preference" },
                            { v: "female", label: "Female" },
                            { v: "male", label: "Male" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.v || "none"}
                            type="button"
                            onClick={() => setGenderPref(opt.v as typeof genderPref)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm transition-all",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                              genderPref === opt.v
                                ? "border-foreground bg-foreground text-background"
                                : "border-border/70 bg-background hover:border-foreground/40",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="lang" className="text-sm">
                        Language they speak{" "}
                        <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <select
                        id="lang"
                        value={languagePref}
                        onChange={(e) => setLanguagePref(e.target.value)}
                        className="mt-2 h-12 w-full max-w-sm rounded-xl border border-foreground/20 bg-background/70 px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <option value="">Any language</option>
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Qualities that matter</p>
                      <p className="text-xs text-muted-foreground">Tap any that feel important.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {EXPERIENCE_TAGS.map((tag) => {
                          const on = experienceTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              aria-pressed={on}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                on
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-border/70 text-foreground hover:border-foreground/40",
                              )}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}

              {step === 6 && (
                <StepShell
                  number="06"
                  eyebrow="The pay"
                  title="What would you like to pay?"
                  hint="Caregivers set their own rate. You can accept theirs, or tell us the most you'd like to pay per hour."
                >
                  <div className="space-y-5">
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-5 transition-all",
                        budgetMode === "any"
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-foreground/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="budget"
                        value="any"
                        checked={budgetMode === "any"}
                        onChange={() => setBudgetMode("any")}
                        className="mt-1 size-4 accent-primary"
                      />
                      <div>
                        <p className="font-medium">Accept the caregiver&rsquo;s rate</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          We&rsquo;ll match you with anyone in your area regardless of hourly rate
                          (within the $18–$50 platform range).
                        </p>
                      </div>
                    </label>

                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-5 transition-all",
                        budgetMode === "capped"
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:border-foreground/30",
                      )}
                    >
                      <input
                        type="radio"
                        name="budget"
                        value="capped"
                        checked={budgetMode === "capped"}
                        onChange={() => setBudgetMode("capped")}
                        className="mt-1 size-4 accent-primary"
                      />
                      <div className="flex-1">
                        <p className="font-medium">Cap the hourly rate</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Only match caregivers charging at or below this amount per hour.
                        </p>
                        {budgetMode === "capped" && (
                          <div className="mt-4 flex flex-wrap items-center gap-4">
                            <div className="inline-flex items-baseline gap-1 rounded-xl bg-background px-4 py-2 ring-1 ring-border">
                              <span className="text-lg font-semibold">$</span>
                              <input
                                type="number"
                                min={18}
                                max={50}
                                value={rateMax}
                                onChange={(e) => setRateMax(Number(e.target.value))}
                                className="w-16 border-0 bg-transparent text-2xl font-semibold tabular-nums outline-none"
                              />
                              <span className="text-sm text-muted-foreground">/ hour</span>
                            </div>
                            <input
                              type="range"
                              min={18}
                              max={50}
                              step={1}
                              value={rateMax}
                              onChange={(e) => setRateMax(Number(e.target.value))}
                              className="h-2 flex-1 min-w-48 max-w-sm accent-primary"
                              aria-label="Maximum hourly rate"
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </StepShell>
              )}

              {step === 7 && selectedCategory && (
                <StepShell
                  number="07"
                  eyebrow="A final read-through"
                  title="Does it look right?"
                  hint="Tap any line to jump back and fix it."
                >
                  <PostingModeChooser value={postingMode} onChange={setPostingMode} />

                  <div className="mt-10 mb-4 flex items-baseline gap-3">
                    <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                      Your notice
                    </span>
                    <span className="h-px flex-1 bg-border/60" />
                  </div>

                  <div className="space-y-4">
                    <ReviewLine
                      label="Service"
                      value={selectedCategory.name}
                      onEdit={() => setStep(1)}
                    />
                    <ReviewLine label="Description" value={description} onEdit={() => setStep(2)} />
                    <ReviewLine
                      label="Location"
                      value={`${address} — ${neighbourhoodInfo?.name ?? ""}`}
                      onEdit={() => setStep(3)}
                    />
                    <ReviewLine
                      label="When"
                      value={`${scheduleLine} · ${scheduleDetail}${
                        recurringNote ? ` · ${recurringNote}` : ""
                      }`}
                      onEdit={() => setStep(4)}
                    />
                    {preferencesLines.length > 0 && (
                      <ReviewLine
                        label="Preferences"
                        value={preferencesLines.join(" · ")}
                        onEdit={() => setStep(5)}
                      />
                    )}
                    <ReviewLine label="Pay" value={budgetLine} onEdit={() => setStep(6)} />
                  </div>

                  <div className="mt-10 rounded-xl bg-primary/[0.06] p-5 text-sm leading-relaxed text-foreground/80 ring-1 ring-primary/20">
                    {postingMode === "matched" ? (
                      <p>
                        When you post, we&rsquo;ll rank verified caregivers in{" "}
                        {neighbourhoodInfo?.name ?? "your area"} and take you straight to your
                        shortlist — you pick who to book.
                      </p>
                    ) : (
                      <p>
                        Your notice will appear on the public feed for every verified caregiver in{" "}
                        {neighbourhoodInfo?.name ?? "your area"} who offers this service. The first
                        person to claim it becomes the match.
                      </p>
                    )}
                  </div>
                </StepShell>
              )}
            </div>

            {/* Nav footer */}
            <div className="mt-10 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
              {step > 1 ? (
                <Button variant="outline" size="lg" onClick={goBack} disabled={submitting}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              ) : (
                <span />
              )}

              {step < 7 ? (
                <Button
                  size="lg"
                  onClick={goNext}
                  disabled={!canContinue}
                  className="h-12 px-8 text-base"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-12 bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Posting…
                    </>
                  ) : (
                    <>
                      Post the notice
                      <Check className="size-4" strokeWidth={2.5} />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* PREVIEW COLUMN */}
          <div className="hidden lg:block">
            <GigPreview
              data={{
                categoryName: selectedCategory?.name ?? "Not yet chosen",
                categoryIcon: selectedCategory ? (iconMap[selectedCategory.icon] ?? Heart) : Heart,
                description: description.trim(),
                neighbourhoodName: neighbourhoodInfo?.name ?? "",
                address,
                scheduleLine,
                scheduleDetail,
                recurringNote,
                preferencesLines,
                budgetLine,
                photoPreview,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Small internal components
 * ───────────────────────────────────────────────────────────── */

function StepShell({
  number,
  eyebrow,
  title,
  hint,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex items-start gap-4">
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
          {hint && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function SelectedCategoryCard({
  category,
  onChange,
}: {
  category: ServiceCategory;
  onChange: () => void;
}) {
  const Icon = iconMap[category.icon] ?? Heart;
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-primary/[0.04] p-6 ring-1 ring-primary/20 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="size-7" strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
          Your chosen service
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{category.name}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
      </div>
      <Button variant="outline" onClick={onChange} className="shrink-0">
        <Pencil className="size-3.5" />
        Change
      </Button>
    </div>
  );
}

function CategoryPicker({
  categories,
  selectedId,
  onSelect,
}: {
  categories: ServiceCategory[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {categories.map((cat) => {
        const Icon = iconMap[cat.icon] ?? Heart;
        const selected = cat.id === selectedId;
        return (
          <li key={cat.id}>
            <button
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                "group flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-card hover:border-foreground/30",
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/60 text-foreground/70 group-hover:bg-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{cat.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {cat.description}
                </p>
              </div>
              <ChevronRight
                className={cn(
                  "mt-1 size-4 transition-all",
                  selected ? "text-primary" : "text-foreground/30",
                )}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PostingModeChooser({
  value,
  onChange,
}: {
  value: PostingMode;
  onChange: (next: PostingMode) => void;
}) {
  return (
    <fieldset>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          How we find them
        </span>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      <legend className="sr-only">Choose how this notice is distributed</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <PostingModeCard
          active={value === "matched"}
          onSelect={() => onChange("matched")}
          icon={Sparkles}
          accent="primary"
          name="Shortlist"
          italic="curated"
          description="Our matcher ranks the best fits and takes you to a list of ten."
          footnote="You pick who to book."
        />
        <PostingModeCard
          active={value === "open"}
          onSelect={() => onChange("open")}
          icon={Megaphone}
          accent="accent"
          name="Open call"
          italic="broadcast"
          description="Post it publicly in the Durham feed."
          footnote="First qualifying claim wins."
        />
      </div>
    </fieldset>
  );
}

function PostingModeCard({
  active,
  onSelect,
  icon: Icon,
  accent,
  name,
  italic,
  description,
  footnote,
}: {
  active: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  accent: "primary" | "accent";
  name: string;
  italic: string;
  description: string;
  footnote: string;
}) {
  const ring = accent === "primary" ? "ring-primary/30" : "ring-accent/30";
  const activeBorder = accent === "primary" ? "border-primary" : "border-accent";
  const activeBg = accent === "primary" ? "bg-primary/[0.04]" : "bg-accent/[0.04]";
  const iconTint = accent === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent";
  const italicTint = accent === "primary" ? "text-primary" : "text-accent";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? `${activeBorder} ${activeBg} ring-2 ${ring} ring-offset-2 ring-offset-background`
          : "border-border/60 bg-card/60 hover:border-foreground/30",
      )}
    >
      {/* Corner radio dot */}
      <span
        aria-hidden
        className={cn(
          "absolute top-4 right-4 grid size-5 place-items-center rounded-full border-2 transition-colors",
          active
            ? `${activeBorder} ${accent === "primary" ? "bg-primary" : "bg-accent"}`
            : "border-foreground/30 bg-background",
        )}
      >
        {active && <span className="size-2 rounded-full bg-background" />}
      </span>

      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-xl transition-colors",
          iconTint,
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </div>

      <div>
        <p className="text-lg font-semibold leading-tight tracking-tight">
          {name} <span className={cn("font-normal italic", italicTint)}>— {italic}</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <p className="mt-1 border-t border-border/50 pt-3 font-mono text-[10px] tracking-[0.18em] text-foreground/50 uppercase">
        {footnote}
      </p>
    </button>
  );
}

function ReviewLine({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full items-start justify-between gap-4 rounded-xl border border-border/60 bg-card px-5 py-4 text-left transition-all hover:border-foreground/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
      </div>
      <Pencil className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ───────────────────────────────────────────────────────────── */

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
