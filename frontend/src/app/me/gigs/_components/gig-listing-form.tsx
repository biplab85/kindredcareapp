"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  Loader2,
  Upload,
  X,
  Plus,
  Check,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fetchServiceCategories, type ServiceCategory } from "@/lib/service-categories";
import { createGig, updateGig, type Gig } from "@/lib/gigs";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";
import { useAuthStore } from "@/lib/auth";
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

interface GigListingFormProps {
  mode: "create" | "edit";
  initialGig?: Gig;
}

/**
 * Single-page form for caregivers to create or edit a gig listing.
 * Shares the editorial paper-wash aesthetic with /gigs/new — § markers,
 * mono eyebrows, italic display headlines.
 */
export function GigListingForm({ mode, initialGig }: GigListingFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => toast.error("Couldn't load service categories. Refresh in a moment."));
  }, []);

  const [categoryId, setCategoryId] = useState<number | null>(
    initialGig?.service_category?.id ?? null,
  );
  const [title, setTitle] = useState(initialGig?.title ?? "");
  const [description, setDescription] = useState(initialGig?.description ?? "");
  const [hourlyRate, setHourlyRate] = useState(initialGig?.hourly_rate_dollars ?? 25);
  const [tasks, setTasks] = useState<string[]>(initialGig?.tasks_included ?? []);
  const [taskDraft, setTaskDraft] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialGig?.photo_url ?? null);
  const [photoIsNew, setPhotoIsNew] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => categories?.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const isEmailUnverified = !useAuthStore((s) => s.user?.email_verified_at);
  // Stripe Connect is required to publish — the form only ever submits as
  // published, so block submit when payouts aren't enabled. The backend
  // enforces the same rule with a 422; this is the polite-warning layer.
  const payoutsReady = useAuthStore((s) => s.user?.caregiver_profile?.payouts_enabled ?? false);

  const canSubmit =
    categoryId !== null &&
    title.trim().length >= 8 &&
    description.trim().length >= 20 &&
    hourlyRate >= 18 &&
    hourlyRate <= 50 &&
    !isEmailUnverified &&
    payoutsReady;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photos must be under 5 MB.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoIsNew(true);
  };

  const clearPhoto = () => {
    if (photoPreview && photoIsNew) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoIsNew(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const addTask = () => {
    const t = taskDraft.trim();
    if (!t) return;
    if (tasks.length >= 10) {
      toast.error("Up to 10 tasks per gig.");
      return;
    }
    if (tasks.includes(t)) {
      setTaskDraft("");
      return;
    }
    setTasks([...tasks, t]);
    setTaskDraft("");
  };

  const removeTask = (t: string) => setTasks((prev) => prev.filter((x) => x !== t));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !categoryId) return;

    setSubmitting(true);
    try {
      const basePayload = {
        service_category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        hourly_rate_dollars: Number(hourlyRate),
        tasks_included: tasks,
        status: "published" as const,
        ...(photoIsNew && photo ? { photo } : {}),
      };

      if (isEdit && initialGig) {
        await updateGig(initialGig.id, basePayload);
        toast.success("Gig updated.");
      } else {
        await createGig(basePayload);
        toast.success("Gig published. Families can find it in the marketplace.");
      }
      router.push("/me/gigs");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong. Try again in a moment.";
      toast.error(message);
      setSubmitting(false);
    }
  };

  if (!categories) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">
          {isEdit ? "Refine your gig." : "Tell families what you offer."}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Each gig is one service families can find and book in the marketplace.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        {/* Form column */}
        <form onSubmit={handleSubmit} className="order-2 space-y-6 lg:order-1">
          {isEmailUnverified && <EmailVerifyBanner context="gig" />}
          {!payoutsReady && !isEmailUnverified && <StripeRequiredBanner />}

          {/* Step 1 — category */}
          <Section number="01" eyebrow="A service" title="Which service is this gig for?">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categories.map((cat) => {
                const Icon = iconMap[cat.icon] ?? Heart;
                const selected = cat.id === categoryId;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={cn(
                        "relative flex w-full cursor-pointer items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/60 bg-card hover:border-foreground/30",
                      )}
                    >
                      {selected && (
                        <Check
                          className="absolute top-3 right-3 size-4 text-primary"
                          strokeWidth={2.5}
                        />
                      )}
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                          selected
                            ? "bg-primary/15 text-primary"
                            : "bg-muted/60 text-foreground/70",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 transition-transform duration-300",
                            selected && "rotate-[20deg]",
                          )}
                          strokeWidth={1.75}
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{cat.name}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {cat.description}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* Step 2 — title + description */}
          <Section number="02" eyebrow="The pitch" title="Headline + description.">
            <div className="space-y-5">
              <div>
                <Label htmlFor="title" className="text-sm">
                  Headline
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    selectedCategory
                      ? `Patient ${selectedCategory.name.toLowerCase()} visits in your area`
                      : "e.g., Patient companionship visits in your area"
                  }
                  maxLength={120}
                  className="mt-2 h-12 rounded-xl border-foreground/20 bg-background/70 text-base"
                />
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span
                    className={cn(
                      title.trim().length > 0 && title.trim().length < 8 && "text-destructive",
                    )}
                  >
                    {title.trim().length < 8
                      ? `${8 - title.trim().length} more characters`
                      : "Looks good."}
                  </span>
                  <span className="font-mono tabular-nums">{title.length} / 120</span>
                </div>
              </div>

              <div>
                <Label htmlFor="desc" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Three or four honest sentences. Who you are, who you're a great fit for, and what a good visit looks like."
                  rows={6}
                  maxLength={500}
                  className="mt-2 min-h-32 rounded-xl border-foreground/20 bg-background/70 text-base leading-relaxed"
                />
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span
                    className={cn(
                      description.trim().length > 0 &&
                        description.trim().length < 20 &&
                        "text-destructive",
                    )}
                  >
                    {description.trim().length < 20
                      ? `${20 - description.trim().length} more characters`
                      : "Looks good."}
                  </span>
                  <span className="font-mono tabular-nums">{description.length} / 500</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Step 3 — rate */}
          <Section number="03" eyebrow="The rate" title="How much per hour?">
            <div className="flex flex-wrap items-center gap-6">
              <div className="inline-flex items-baseline gap-1 rounded-xl bg-background px-4 py-2 ring-1 ring-border">
                <span className="text-lg font-semibold">$</span>
                <input
                  type="number"
                  min={18}
                  max={50}
                  step={1}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-16 border-0 bg-transparent text-3xl font-semibold tabular-nums outline-none"
                />
                <span className="text-sm text-muted-foreground">/ hr</span>
              </div>
              <input
                type="range"
                min={18}
                max={50}
                step={1}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="h-2 max-w-sm min-w-48 flex-1 accent-primary"
                aria-label="Hourly rate"
              />
            </div>
            <p className="mt-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              You keep ${hourlyRate.toFixed(2)} / hr · Family pays $
              {(hourlyRate * 1.075).toFixed(2)}
            </p>
          </Section>

          {/* Step 4 — what's included */}
          <Section number="04" eyebrow="What's included" title="Tasks the rate covers.">
            <p className="mb-3 text-sm text-muted-foreground">
              Optional. Up to 10 short bullets. Families read this to know what to expect.
            </p>
            <div className="flex gap-2">
              <Input
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTask();
                  }
                }}
                placeholder="e.g., Light walk around the block"
                className="h-11 rounded-xl border-foreground/20 bg-background/70"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addTask}
                className="h-11 cursor-pointer px-4"
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {tasks.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {tasks.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => removeTask(t)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
                    >
                      {t}
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Step 5 — photo */}
          <Section number="05" eyebrow="A photo" title="Optional, but helps.">
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-xl ring-1 ring-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Gig listing reference"
                  className="h-56 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute top-3 right-3 cursor-pointer rounded-full bg-background/90 p-1.5 ring-1 ring-border shadow-sm transition-colors hover:bg-background"
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
                    Something representative — a tidy garden, a tea moment, a walking trail (max 5
                    MB)
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
          </Section>

          {/* Submit */}
          <div className="flex items-center justify-end gap-4 border-t border-border/60 pt-6">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || submitting}
              className="h-12 cursor-pointer bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isEdit ? "Saving…" : "Publishing…"}
                </>
              ) : (
                <>
                  {isEdit ? "Save changes" : "Publish gig"}
                  <Check className="size-4" strokeWidth={2.5} />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Live preview — the gig card families see in the marketplace */}
        <aside className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-20">
            <GigPreview
              category={selectedCategory}
              title={title}
              description={description}
              hourlyRate={hourlyRate}
              tasks={tasks}
              photoPreview={photoPreview}
            />
          </div>
        </aside>
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      {/* card header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary tabular-nums">
          {number}
        </span>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
      </div>
      {/* card body */}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

/**
 * Live marketplace preview — renders the gig card families see, from the
 * current form values. Read-only; updates as the caregiver fills the form.
 */
function GigPreview({
  category,
  title,
  description,
  hourlyRate,
  tasks,
  photoPreview,
}: {
  category: ServiceCategory | null;
  title: string;
  description: string;
  hourlyRate: number;
  tasks: string[];
  photoPreview: string | null;
}) {
  const Icon = category ? (iconMap[category.icon] ?? Heart) : Sparkles;
  const hasTitle = title.trim().length > 0;
  const hasDesc = description.trim().length > 0;

  return (
    <div>
      <p className="mb-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Marketplace preview
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* media */}
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
              <Icon className="size-12 text-primary/30" strokeWidth={1.5} />
            </div>
          )}
          <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-foreground uppercase">
            New
          </span>
        </div>

        {/* body */}
        <div className="p-4">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              category ? "text-muted-foreground" : "text-primary",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            {category?.name ?? "Select a service"}
          </div>
          <h3
            className={cn(
              "mt-1.5 line-clamp-2 text-base leading-snug font-semibold tracking-tight",
              hasTitle ? "text-foreground" : "text-muted-foreground/50",
            )}
          >
            {hasTitle ? title.trim() : "Your headline will appear here"}
          </h3>
          <p
            className={cn(
              "mt-1 line-clamp-2 text-[13px] leading-relaxed",
              hasDesc ? "text-muted-foreground" : "text-muted-foreground/50",
            )}
          >
            {hasDesc ? description.trim() : "Your description gives families a feel for the visit."}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <p className="text-sm">
              <span className="font-semibold text-foreground tabular-nums">
                ${hourlyRate.toFixed(2)}
              </span>
              <span className="text-muted-foreground"> / hr</span>
            </p>
            {tasks.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <Check className="size-3.5" strokeWidth={2.5} />
                {tasks.length} task{tasks.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Updates live as you fill out the form — this is what families see in the marketplace.
      </p>
    </div>
  );
}

function StripeRequiredBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-4 ring-1 ring-accent/15">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
        <CreditCard className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Connect your payout account before publishing.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Families pay through the platform — without Stripe Connect we have nowhere to send your
          share. It takes about 5 minutes.
        </p>
        <Link
          href="/settings/payouts"
          className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.22em] text-accent uppercase transition-colors hover:text-accent/80"
        >
          Set up Stripe Connect →
        </Link>
      </div>
    </div>
  );
}
