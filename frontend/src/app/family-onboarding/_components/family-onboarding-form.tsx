"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Heart, CheckCircle2, Check, X, MapPin, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const RELATIONSHIPS = [
  { value: "self", label: "Myself", desc: "I'm looking for help for myself" },
  { value: "parent", label: "My Parent", desc: "I'm arranging care for my parent" },
  { value: "spouse", label: "My Spouse", desc: "I'm finding help for my partner" },
  { value: "family", label: "Family Member", desc: "A relative who needs assistance" },
  { value: "friend", label: "A Friend", desc: "Helping a friend find care" },
];

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

// {value,label} items so the shadcn Select trigger renders a readable label.
const LANGUAGE_ITEMS = LANGUAGES.map((l) => ({ value: l, label: l }));

export function FamilyOnboardingForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Shown in the sticky save bar after a successful save in edit mode.
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Pre-fill the recipient fields from the existing care recipient so the
  // edit session shows real data (including the interests pills). AuthGuard
  // gates this form behind a loaded user, so the initializers run with data.
  const recipient = user?.family_profile?.care_recipients?.[0] ?? null;

  const [relationship, setRelationship] = useState("parent");
  const [postalCode, setPostalCode] = useState(recipient?.postal_code ?? "");
  const [city, setCity] = useState("");

  const [recipientName, setRecipientName] = useState(recipient?.name ?? "");
  const [recipientStreetAddress, setRecipientStreetAddress] = useState(
    recipient?.street_address ?? "",
  );
  const [recipientAge, setRecipientAge] = useState(
    recipient?.age != null ? String(recipient.age) : "",
  );
  const [recipientLanguage, setRecipientLanguage] = useState(recipient?.language ?? "English");
  const [recipientInterests, setRecipientInterests] = useState<string[]>(
    recipient?.interests ?? [],
  );
  const [interestInput, setInterestInput] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState(
    recipient?.accessibility_notes ?? "",
  );

  const isSelf = relationship === "self";

  const steps: { label: string; description: string; icon: LucideIcon }[] = [
    { label: "Your Info", description: "About you", icon: MapPin },
    {
      label: isSelf ? "About You" : "Care Recipient",
      description: isSelf ? "Your details" : "Who needs care",
      icon: Heart,
    },
  ];

  const addInterest = () => {
    const trimmed = interestInput.trim();
    if (trimmed && !recipientInterests.includes(trimmed)) {
      setRecipientInterests((prev) => [...prev, trimmed]);
      setInterestInput("");
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data: Record<string, unknown> = {
        relationship,
        postal_code: postalCode,
        city,
      };

      // Same payload shape for both flows now — self users have already
      // had their name pre-filled via useEffect, family users typed it.
      data.care_recipient = {
        name: recipientName.trim() || user?.name || "Self",
        street_address: recipientStreetAddress.trim() || null,
        age: recipientAge ? parseInt(recipientAge) : null,
        language: recipientLanguage,
        interests: recipientInterests,
        accessibility_notes: accessibilityNotes || null,
      };

      await api.patch("/api/me/family-profile", data);
      // Refresh the auth store so AuthGuard sees the new
      // family_profile.onboarding_complete=true. Without this, the
      // dashboard redirect bounces straight back to /family-onboarding
      // because the cached user still has the stale flag.
      await useAuthStore.getState().fetchUser();

      // First-run signup: walk the family into the dashboard to start
      // browsing caregivers. Edit session from /profile: stay on the
      // page, just stamp the sticky save bar.
      if (user?.family_profile?.onboarding_complete) {
        setLastSavedAt(formatSavedAt(new Date()));
        toast.success("Profile saved.");
      } else {
        toast.success("Profile complete! You can now find caregivers.");
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      // Surface Laravel's 422 field errors instead of a generic
      // "something went wrong". If the response carries a structured
      // errors object, toast each field message; otherwise fall back
      // to the top-level message or a default.
      const error = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
      };
      const fieldErrors = error.response?.data?.errors;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        Object.values(fieldErrors)
          .flat()
          .forEach((msg) => toast.error(msg));
      } else {
        toast.error(error.response?.data?.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyOnboarded = user?.family_profile?.onboarding_complete === true;
  const StepIcon = steps[step - 1].icon;

  return (
    <div
      className={cn(
        "w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8",
        // Centered for the focused standalone onboarding flow; left-aligned
        // inside the dashboard shell (profile editor).
        !embedded && "mx-auto",
      )}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* ─── Vertical step nav ─── */}
        <nav
          role="tablist"
          aria-label="Profile sections"
          className={cn(
            "rounded-2xl border border-border bg-card p-3 shadow-sm lg:sticky",
            // Standalone onboarding has no fixed header → small offset. Inside
            // the dashboard shell the topbar is sticky h-16 (64px), so clear it.
            embedded ? "lg:top-20" : "lg:top-6",
          )}
        >
          {/* Brand mark — standalone onboarding only; the profile editor sits
              inside the dashboard shell, which already shows the logo. */}
          {!embedded && (
            <div className="px-2 pt-1 pb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="KindredCare" className="h-8 w-auto max-w-full" />
            </div>
          )}

          {/* Progress header */}
          <div className={cn("px-2 pb-3", !embedded ? "border-t border-border/60 pt-3" : "pt-1")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Setup
              </span>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                Step {step} of {steps.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/75 transition-[width] duration-500 ease-out"
                style={{ width: `${(step / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            {steps.map((tab, idx) => {
              const tabNum = idx + 1;
              const active = step === tabNum;
              const done = tabNum < step;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStep(tabNum)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    active ? "bg-primary/10 ring-1 ring-primary/15" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums transition-all",
                      active
                        ? "bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-[0_4px_12px_-3px_oklch(0.56_0.13_240/0.55)] ring-1 ring-white/20 ring-inset"
                        : done
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" strokeWidth={2.75} /> : tabNum}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span
                      className={cn(
                        "block truncate text-sm font-semibold",
                        active
                          ? "text-foreground"
                          : done
                            ? "text-foreground/80"
                            : "text-muted-foreground",
                      )}
                    >
                      {tab.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {tab.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ─── Tab body ─── */}
        <div className="min-w-0">
          {!isAlreadyOnboarded && (
            <header className="mb-4">
              <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Let&rsquo;s get you started
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Just two quick sections so we can match you with the right caregivers.
              </p>
            </header>
          )}

          <Card className="gap-0 overflow-hidden rounded-2xl border border-border py-0 shadow-sm ring-0">
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-6 py-4 sm:px-8">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-[0_4px_12px_-3px_oklch(0.56_0.13_240/0.55)] ring-1 ring-white/20 ring-inset">
                <StepIcon className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
                  Step {step} of {steps.length} · {steps[step - 1].description}
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {steps[step - 1].label}
                </h2>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              {/* ─── STEP 1: Your info ─── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label className="mb-3">Who are you looking for care for?</Label>
                    <div className="space-y-2">
                      {RELATIONSHIPS.map((rel) => (
                        <button
                          key={rel.value}
                          type="button"
                          onClick={() => setRelationship(rel.value)}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                            relationship === rel.value
                              ? "border-primary/40 bg-primary/[0.04] shadow-sm ring-1 ring-primary/20"
                              : "border-border hover:border-primary/30 hover:bg-muted/30",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                              relationship === rel.value
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30",
                            )}
                          >
                            {relationship === rel.value && (
                              <div className="size-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "text-sm font-semibold",
                                relationship === rel.value ? "text-primary" : "text-foreground",
                              )}
                            >
                              {rel.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{rel.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        className="h-10"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Your city"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="postal">Postal Code</Label>
                      <Input
                        id="postal"
                        className="h-10"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                        placeholder="L1H 4G1"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── STEP 2: Recipient details (about them, or about you in the self flow) ─── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                      <Heart className="size-5" strokeWidth={2} />
                    </span>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {isSelf
                        ? "Tell us a little about yourself so caregivers can prepare. The address is where visits will happen — you can override it per booking."
                        : "Tell us a bit about the person who needs care. This helps caregivers prepare and bookings auto-fill the address."}
                    </p>
                  </div>

                  {/* Family flow asks for the recipient's name. Self flow
                      skips it entirely — the user's name from signup is
                      already on file and the submit handler falls back to
                      user.name when recipientName is empty. */}
                  {!isSelf && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rname">Their Name</Label>
                      <Input
                        id="rname"
                        className="h-10"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="First name is fine"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="rstreet">
                      {isSelf ? "Your Street Address" : "Their Street Address"}
                    </Label>
                    <Input
                      id="rstreet"
                      className="h-10"
                      value={recipientStreetAddress}
                      onChange={(e) => setRecipientStreetAddress(e.target.value)}
                      placeholder="123 Main Street"
                    />
                    <p className="text-xs text-muted-foreground">
                      Where visits will usually happen. You can override this on any single booking.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="rage">Age (optional)</Label>
                      <Input
                        id="rage"
                        type="number"
                        className="h-10"
                        value={recipientAge}
                        onChange={(e) => setRecipientAge(e.target.value)}
                        placeholder="78"
                        min={0}
                        max={120}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rlang">Primary Language</Label>
                      <Select
                        items={LANGUAGE_ITEMS}
                        value={recipientLanguage || null}
                        onValueChange={(value) => setRecipientLanguage(value ?? "English")}
                      >
                        <SelectTrigger id="rlang" className="w-full data-[size=default]:h-10">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Interests (helps with companionship matching)</Label>
                    <div className="flex gap-2">
                      <Input
                        className="h-10"
                        value={interestInput}
                        onChange={(e) => setInterestInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                        placeholder="e.g. gardening, puzzles, music"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={addInterest}
                      >
                        Add
                      </Button>
                    </div>
                    {recipientInterests.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {recipientInterests.map((interest) => (
                          <span
                            key={interest}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-1 pr-1 pl-3 text-sm font-medium text-primary shadow-xs transition-colors hover:border-primary/30 hover:bg-primary/15"
                          >
                            {interest}
                            <button
                              type="button"
                              aria-label={`Remove ${interest}`}
                              onClick={() =>
                                setRecipientInterests((prev) => prev.filter((i) => i !== interest))
                              }
                              className="grid size-5 place-items-center rounded-full text-primary/60 transition-colors hover:bg-primary/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                            >
                              <X className="size-3.5" strokeWidth={2.5} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Accessibility Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={accessibilityNotes}
                      onChange={(e) => setAccessibilityNotes(e.target.value)}
                      placeholder="e.g. Uses a walker, hearing aid in left ear, prefers a quiet environment"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      This helps caregivers prepare and provide better care.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Save action — sits directly below the card ─── */}
          <div className="mt-6 flex items-center justify-end gap-4">
            {lastSavedAt && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" strokeWidth={2.25} />
                Saved · {lastSavedAt}
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              size="lg"
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 size-4" />
              )}
              {isAlreadyOnboarded ? "Save changes" : "Find caregivers"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSavedAt(d: Date): string {
  return d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}
