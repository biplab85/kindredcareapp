"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  const [relationship, setRelationship] = useState("parent");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientStreetAddress, setRecipientStreetAddress] = useState("");
  const [recipientAge, setRecipientAge] = useState("");
  const [recipientLanguage, setRecipientLanguage] = useState("English");
  const [recipientInterests, setRecipientInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");

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
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-32 sm:px-6 lg:px-8">
      {/* ─── Editorial header ─── */}
      <div className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-foreground/30" />
        § 01 · Your profile
      </div>

      <header className="mt-3">
        <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl">
          {isAlreadyOnboarded ? (
            <>
              Tell us <span className="italic text-primary">who you book for.</span>
            </>
          ) : (
            <>
              Let&rsquo;s <span className="italic text-primary">get you started.</span>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {isAlreadyOnboarded
            ? "Switch tabs to edit any section. Changes save when you press the button at the bottom."
            : "Just two quick sections so we can match you with the right caregivers."}
        </p>
      </header>

      <div className="my-6 border-t border-dashed border-border/60" />

      {/* ─── Tab bar — clickable, no forced order ─── */}
      <div className="-mx-1 overflow-x-auto">
        <div role="tablist" className="flex min-w-max items-stretch gap-1 px-1">
          {steps.map((tab, idx) => {
            const tabNum = idx + 1;
            const active = step === tabNum;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStep(tabNum)}
                className={cn(
                  "group relative flex items-baseline gap-2 px-3 py-3 transition-colors",
                  "font-mono text-[11px] font-medium tracking-[0.18em] uppercase",
                  "border-b-2",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn(active ? "text-primary" : "text-muted-foreground/60")}>
                  {String(tabNum).padStart(2, "0")}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
                          "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                          relationship === rel.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border-2 transition-all",
                            relationship === rel.value
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {relationship === rel.value && (
                            <div className="size-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{rel.label}</p>
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
                    className="h-12"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Your city"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input
                    id="postal"
                    className="h-12"
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
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4">
                  <Heart className="size-5 text-primary" />
                  <p className="text-sm text-muted-foreground">
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
                      className="h-12"
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
                    className="h-12"
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
                    className="h-12"
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
                    className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
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
                      className="h-12"
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                      placeholder="e.g. gardening, puzzles, music"
                    />
                    <Button type="button" variant="outline" className="h-12" onClick={addInterest}>
                      Add
                    </Button>
                  </div>
                  {recipientInterests.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recipientInterests.map((interest) => (
                        <Badge key={interest} variant="secondary" className="gap-1 px-3 py-1.5">
                          {interest}
                          <button
                            type="button"
                            onClick={() =>
                              setRecipientInterests((prev) => prev.filter((i) => i !== interest))
                            }
                            className="ml-1 text-muted-foreground hover:text-foreground"
                          >
                            &times;
                          </button>
                        </Badge>
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

      {/* ─── Sticky save bar ─── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-md md:left-[248px]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-1">
            {isAlreadyOnboarded ? (
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.18em] text-primary uppercase transition-colors hover:text-primary/80"
              >
                ← Back to profile
              </Link>
            ) : null}
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              {lastSavedAt
                ? `Saved · ${lastSavedAt}`
                : isAlreadyOnboarded
                  ? "Changes save when you press the button"
                  : `${steps[step - 1].label} · step ${step} of ${totalSteps}`}
            </p>
          </div>
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
  );
}

function formatSavedAt(d: Date): string {
  return d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}
