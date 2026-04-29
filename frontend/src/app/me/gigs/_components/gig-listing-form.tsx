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
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fetchServiceCategories, type ServiceCategory } from "@/lib/service-categories";
import { createGig, updateGig, type Gig } from "@/lib/gigs";
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

  const canSubmit =
    categoryId !== null &&
    title.trim().length >= 8 &&
    description.trim().length >= 20 &&
    hourlyRate >= 18 &&
    hourlyRate <= 50;

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
      toast.error("Up to 10 tasks per notice.");
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
        toast.success("Notice updated.");
      } else {
        await createGig(basePayload);
        toast.success("Notice published. Families can find it in the marketplace.");
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
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.035 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6">
        {/* Header */}
        <div className="mb-10">
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            {isEdit ? "Edit a notice" : "Post a notice"}
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            {isEdit ? "Refine your" : "Tell families what"}
            <br />
            <span className="italic font-normal text-primary">
              {isEdit ? "notice" : "you offer"}
            </span>
            .
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Step 1 — category */}
          <Section number="01" eyebrow="A service" title="Which service is this notice for?">
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
                        "flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
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
                            : "bg-muted/60 text-foreground/70",
                        )}
                      >
                        <Icon className="size-5" strokeWidth={1.75} />
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
                      ? `Patient ${selectedCategory.name.toLowerCase()} visits in Oshawa`
                      : "e.g., Patient companionship visits in Oshawa"
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
            <div className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
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
                  <span className="text-sm text-muted-foreground">/ hour</span>
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
                Platform fee: 7.5% · You keep ${(hourlyRate * 0.925).toFixed(2)} / hour
              </p>
            </div>
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
              <Button type="button" variant="outline" onClick={addTask} className="h-11 px-4">
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
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
                  className="absolute top-3 right-3 rounded-full bg-background/90 p-1.5 ring-1 ring-border shadow-sm transition-colors hover:bg-background"
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
              className="h-12 bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isEdit ? "Saving…" : "Publishing…"}
                </>
              ) : (
                <>
                  {isEdit ? "Save changes" : "Publish notice"}
                  <Check className="size-4" strokeWidth={2.5} />
                </>
              )}
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
