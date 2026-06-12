"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Heart, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SlideTabs } from "@/components/ui/slide-tabs";
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

export function FamilyOnboardingForm() {
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

  const steps = [
    { label: "Your Info", description: "About you" },
    {
      label: isSelf ? "About You" : "Care Recipient",
      description: isSelf ? "Your details" : "Who needs care",
    },
  ];
  const totalSteps = 2;

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

  return (
    <div className="max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      {/* ─── Header ─── */}
      <header className="mb-6">
        <h1 className="text-lg font-semibold leading-[1.15] tracking-tight text-foreground">
          {isAlreadyOnboarded ? "Who you book for" : "Let's get you started"}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {isAlreadyOnboarded
            ? "Switch tabs to edit any section. Changes save when you press the button at the bottom."
            : "Just two quick sections so we can match you with the right caregivers."}
        </p>
      </header>

      {/* ─── Tab bar — sliding segmented control ─── */}
      <SlideTabs
        ariaLabel="Profile sections"
        value={String(step)}
        options={steps.map((tab, idx) => ({ value: String(idx + 1), label: tab.label }))}
        onChange={(v) => setStep(Number(v))}
        tabWidthClass="w-[132px]"
      />

      {/* ─── Tab body ─── */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* Step 1 */}
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
                            ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                            : "border-border hover:border-primary/40 hover:bg-muted/30",
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

                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    className="h-[35px]"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Your city"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input
                    id="postal"
                    className="h-[35px]"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                    placeholder="L1H 4G1"
                    maxLength={7}
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Recipient details (about them, or about you in the self flow) */}
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
                      className="h-[35px]"
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
                    className="h-[35px]"
                    value={recipientStreetAddress}
                    onChange={(e) => setRecipientStreetAddress(e.target.value)}
                    placeholder="123 Main Street"
                  />
                  <p className="text-xs text-muted-foreground">
                    Where visits will usually happen. You can override this on any single booking.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rage">Age (optional)</Label>
                  <Input
                    id="rage"
                    type="number"
                    className="h-[35px]"
                    value={recipientAge}
                    onChange={(e) => setRecipientAge(e.target.value)}
                    placeholder="78"
                    min={0}
                    max={120}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rlang">Primary Language</Label>
                  <select
                    id="rlang"
                    value={recipientLanguage}
                    onChange={(e) => setRecipientLanguage(e.target.value)}
                    className="h-[35px] w-full cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Interests (helps with companionship matching)</Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-[35px]"
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                      placeholder="e.g. gardening, puzzles, music"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-[35px]"
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
      </div>

      {/* ─── Save row ─── */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          {lastSavedAt ? (
            <p className="text-xs text-muted-foreground">Saved · {lastSavedAt}</p>
          ) : !isAlreadyOnboarded ? (
            <p className="text-xs text-muted-foreground">
              {steps[step - 1].label} · step {step} of {totalSteps}
            </p>
          ) : null}
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="min-w-[140px]">
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1 size-4" />
          )}
          {isAlreadyOnboarded ? "Save changes" : "Find caregivers"}
        </Button>
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
