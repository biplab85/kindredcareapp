"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ArrowRight, ArrowLeft, Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "@/components/ui/step-indicator";
import { AuthGuard } from "@/components/auth/auth-guard";
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

export default function FamilyOnboardingPage() {
  return (
    <AuthGuard roles={["family"]}>
      <FamilyOnboardingForm />
    </AuthGuard>
  );
}

function FamilyOnboardingForm() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const canProceedStep1 = postalCode.length >= 6 && city.length > 0;
  // Self users can leave the name blank — submit falls back to user.name.
  const canProceedStep2 = isSelf ? Boolean(user?.name) : recipientName.length >= 2;

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
      toast.success("Profile complete! You can now find caregivers.");
      router.push("/dashboard");
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="KindredCare"
            width={160}
            height={36}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="text-2xl font-bold">
            {user?.family_profile?.onboarding_complete
              ? "Edit your profile"
              : "Let’s Get You Started"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.family_profile?.onboarding_complete
              ? "Update any section — your changes save when you finish the wizard."
              : "Just a couple of quick questions so we can match you with the right caregivers."}
          </p>
        </div>

        <div className="mb-8">
          <StepIndicator steps={steps} currentStep={step} />
        </div>

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

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-1 size-4" /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < totalSteps ? (
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  Next <ArrowRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting || !canProceedStep2}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 size-4" />
                  )}
                  Find Caregivers
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
