"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  Loader2,
  CheckCircle2,
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  DollarSign,
  Plus,
  X,
  Shield,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import {
  type Certification as RemoteCertification,
  createCertification,
  deleteCertification,
  listCertifications,
  statusLabel,
  statusTone,
  uploadCertificationDocument,
} from "@/lib/certifications";
import type { ServiceCategory } from "@/lib/service-categories";
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

const PERSONALITY_TAGS = [
  "Patient",
  "Warm",
  "Reliable",
  "Energetic",
  "Calm",
  "Organized",
  "Creative",
  "Empathetic",
  "Punctual",
  "Flexible",
];

// Sentinel value for the dropdown's "Other" escape hatch — when this is
// selected the form reveals a freeform text field for the caregiver to
// type a cert name that isn't in COMMON_CERTS.
const CERT_OTHER_VALUE = "__other__";

const COMMON_CERTS = [
  "PSW",
  "Standard First Aid + CPR C",
  "BLS",
  "GPA (Dementia Care)",
  "MHFA",
  "Food Handler",
  "WHMIS",
];

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const steps = [
  { label: "Personal", description: "About you" },
  { label: "Services", description: "What you offer" },
  { label: "Skills", description: "Certs & languages" },
  { label: "Rate", description: "Pay & schedule" },
  { label: "Safety", description: "References" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface DayAvailability {
  available: boolean;
  start: string;
  end: string;
}
interface Reference {
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

export function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Honor ?step=N from the URL so deep-links from dashboard CTAs ("add a
  // certification" → /onboarding?step=4) land on the right step. Clamped
  // to the valid range.
  const initialStep = (() => {
    const raw = Number(searchParams.get("step"));
    return Number.isFinite(raw) && raw >= 1 && raw <= 5 ? raw : 1;
  })();
  // When the caregiver has already finished onboarding once, this page acts
  // as the profile editor (linked from /profile in the sidebar). Headline
  // switches to "Edit your profile" so it doesn't read like a first-run flow.
  const isAlreadyOnboarded = useAuthStore(
    (s) => s.user?.caregiver_profile?.onboarding_complete === true,
  );
  const [step, setStep] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Shown in the sticky save bar after a successful save. Just a relative
  // time string like "just now" or "2 min ago" — we re-derive on save.
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [yearsOfExperience, setYearsOfExperience] = useState(0);
  const [selectedServices, setSelectedServices] = useState<Record<number, number>>({});

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [personalityTags, setPersonalityTags] = useState<string[]>([]);
  // Certifications live on the new /api/me/certifications endpoint, not on
  // the big profile PATCH. Fetched separately on mount + after every mutate.
  const [certifications, setCertifications] = useState<RemoteCertification[]>([]);
  // certName carries the dropdown value. The literal "__other__" sentinel
  // means the caregiver wants to type their own name in certCustomName.
  const [certName, setCertName] = useState("");
  const [certCustomName, setCertCustomName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certYear, setCertYear] = useState("");
  const [certDoc, setCertDoc] = useState<File | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  const certDocInputRef = useRef<HTMLInputElement>(null);
  const certRowDocInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocCertId, setPendingDocCertId] = useState<number | null>(null);

  const [hourlyRate, setHourlyRate] = useState(25);
  const [travelRadius, setTravelRadius] = useState(10);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>(
    Object.fromEntries(
      DAYS.map((d) => [
        d.toLowerCase(),
        { available: d !== "Saturday" && d !== "Sunday", start: "09:00", end: "17:00" },
      ]),
    ),
  );

  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [references, setReferences] = useState<Reference[]>([
    { name: "", email: "", phone: "", relationship: "" },
    { name: "", email: "", phone: "", relationship: "" },
  ]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Certs live on a sibling endpoint now (PR 86) — fetch them on mount
    // and after every mutation to keep the list authoritative.
    listCertifications()
      .then(setCertifications)
      .catch(() => {
        // Soft-fail: a fresh caregiver with no certs still loads, and an
        // outright API failure shouldn't block the rest of the form.
      });

    api
      .get<{ data: ServiceCategory[] }>("/api/service-categories")
      .then((res) => setCategories(res.data.data))
      .catch(() => toast.error("Failed to load services."));

    // Prefill from the existing caregiver profile so deep-links from the
    // dashboard ("add a certification") don't strand the user on a blank
    // form when they're already 92% complete.
    api
      .get<{
        user?: {
          date_of_birth?: string | null;
          gender?: string | null;
          caregiver_profile?: {
            bio?: string | null;
            address?: string | null;
            postal_code?: string | null;
            hourly_rate?: number | string | null;
            travel_radius_km?: number | null;
            years_of_experience?: number | null;
            languages?: string[] | null;
            interests?: string[] | null;
            personality_tags?: string[] | null;
            references?: Reference[] | null;
            emergency_contact_name?: string | null;
            emergency_contact_phone?: string | null;
            emergency_contact_relationship?: string | null;
            availability?: { weekly?: Record<string, { start: string; end: string }[]> } | null;
            photo_path?: string | null;
            services?: Array<{ id: number; pivot?: { years_experience?: number } }> | null;
          } | null;
        };
      }>("/api/me")
      .then((res) => {
        const u = res.data.user;
        if (!u) return;
        if (u.date_of_birth) setDateOfBirth(u.date_of_birth.slice(0, 10));
        if (u.gender) setGender(u.gender);

        const p = u.caregiver_profile;
        if (!p) return;
        if (p.bio) setBio(p.bio);
        if (p.address) setAddress(p.address);
        if (p.postal_code) setPostalCode(p.postal_code);
        // Photo path can be either a fully-qualified URL (seeded pravatar
        // placeholders) or a relative public-disk path like
        // "avatars/1-xyz.jpg" — uploaded files. Resolve the relative case
        // through the API origin so the preview actually renders.
        if (p.photo_path) {
          setPhotoPreview(resolvePhotoUrl(p.photo_path));
        }
        if (p.hourly_rate != null) setHourlyRate(Number(p.hourly_rate));
        if (p.travel_radius_km != null) setTravelRadius(p.travel_radius_km);
        if (p.years_of_experience != null) setYearsOfExperience(p.years_of_experience);
        if (Array.isArray(p.languages)) setSelectedLanguages(p.languages);
        if (Array.isArray(p.interests)) setInterests(p.interests);
        if (Array.isArray(p.personality_tags)) setPersonalityTags(p.personality_tags);
        // Certs are fetched separately via /api/me/certifications below —
        // the relation is loaded server-side but we hit the dedicated
        // endpoint so the form's mutation methods share the same shape.
        if (Array.isArray(p.references) && p.references.length > 0) {
          // Pad with blanks so the form always shows two reference rows;
          // coerce nullable fields so controlled <Input>s don't warn.
          const refs = p.references.map((r) => ({
            name: r.name ?? "",
            email: r.email ?? "",
            phone: r.phone ?? "",
            relationship: r.relationship ?? "",
          }));
          while (refs.length < 2) refs.push({ name: "", email: "", phone: "", relationship: "" });
          setReferences(refs);
        }
        if (p.emergency_contact_name) setEmergencyName(p.emergency_contact_name);
        if (p.emergency_contact_phone) setEmergencyPhone(p.emergency_contact_phone);
        if (p.emergency_contact_relationship) {
          setEmergencyRelationship(p.emergency_contact_relationship);
        }
        if (Array.isArray(p.services) && p.services.length > 0) {
          const next: Record<number, number> = {};
          p.services.forEach((s) => {
            next[s.id] = s.pivot?.years_experience ?? 0;
          });
          setSelectedServices(next);
        }
        const weekly = p.availability?.weekly;
        if (weekly && typeof weekly === "object") {
          // Convert matcher-shaped weekly { mon: [{start,end}], ... } back
          // to the form's { mon: { available, start, end } } shape.
          const dayKeyMap: Record<string, string> = {
            monday: "mon",
            tuesday: "tue",
            wednesday: "wed",
            thursday: "thu",
            friday: "fri",
            saturday: "sat",
            sunday: "sun",
          };
          setAvailability((prev) => {
            const next = { ...prev };
            for (const [longDay, prevValue] of Object.entries(prev)) {
              const shortKey = dayKeyMap[longDay] ?? longDay;
              const ranges = weekly[shortKey];
              if (Array.isArray(ranges) && ranges.length > 0) {
                next[longDay] = {
                  available: true,
                  start: ranges[0].start,
                  end: ranges[0].end,
                };
              } else if (Array.isArray(ranges)) {
                next[longDay] = { ...prevValue, available: false };
              }
            }
            return next;
          });
        }
      })
      .catch(() => {
        // Soft-fail: a fresh user with no profile yet hits a 404-ish
        // shape; either way we just leave the form blank.
      });
  }, []);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB.");
      return;
    }

    // Show the local preview immediately so the user sees their choice
    // before the upload round-trips.
    setPhotoPreview(URL.createObjectURL(file));

    // Upload right away. The original flow deferred this to handleSubmit
    // (step 5's "Complete Setup"), which meant editing the photo from
    // /profile silently dropped it if the user didn't click through every
    // step — the photo was just a local blob URL until the final submit.
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await api.post<{ photo_url?: string }>("/api/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.photo_url) {
        setPhotoPreview(res.data.photo_url);
      }
      toast.success("Photo updated.");
    } catch {
      toast.error("Couldn't upload the photo. Try again in a moment.");
    } finally {
      setIsUploadingPhoto(false);
    }

    // Reset the hidden input so picking the same file twice in a row still
    // fires the onChange event.
    e.target.value = "";
  };

  const toggleService = (id: number) => {
    setSelectedServices((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 0;
      return next;
    });
  };

  const setServiceExp = (id: number, years: number) => {
    setSelectedServices((prev) => ({ ...prev, [id]: years }));
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const togglePersonality = (tag: string) => {
    setPersonalityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addInterest = () => {
    const trimmed = interestInput.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests((prev) => [...prev, trimmed]);
      setInterestInput("");
    }
  };

  const refreshCertifications = async () => {
    try {
      setCertifications(await listCertifications());
    } catch {
      toast.error("Couldn't load your certifications. Try again in a moment.");
    }
  };

  const addCertification = async () => {
    if (certBusy) return;
    // Resolve the actual cert name: dropdown value unless the caregiver
    // picked "Other", in which case the freeform input wins.
    const finalName =
      certName === CERT_OTHER_VALUE ? certCustomName.trim() : certName;
    if (!finalName) {
      toast.error(
        certName === CERT_OTHER_VALUE
          ? "Type the certification name."
          : "Pick a certification.",
      );
      return;
    }
    // Document is required server-side; toast a friendly nudge here
    // instead of letting the picker drop the file silently and the
    // request 422 with a generic message.
    if (!certDoc) {
      toast.error("Attach a PDF or photo of your certification before adding.");
      return;
    }
    // Year is optional. Treat anything outside 1990–2030 as "no year"
    // rather than shipping out-of-range values that 422 server-side.
    // The user might mid-type "20" and tap Add — that shouldn't fail.
    const yearNum = certYear ? Number(certYear) : NaN;
    const yearForApi =
      Number.isFinite(yearNum) && yearNum >= 1990 && yearNum <= 2030 ? yearNum : null;

    setCertBusy(true);
    try {
      await createCertification({
        name: finalName,
        issuer: certIssuer || null,
        year: yearForApi,
        document: certDoc,
      });
      setCertName("");
      setCertCustomName("");
      setCertIssuer("");
      setCertYear("");
      setCertDoc(null);
      if (certDocInputRef.current) certDocInputRef.current.value = "";
      await refreshCertifications();
      toast.success("Certification added — admin will review your document.");
    } catch (err) {
      surfaceServerError(err, "Couldn't add the certification. Try again in a moment.");
    } finally {
      setCertBusy(false);
    }
  };

  const removeCertification = async (id: number) => {
    if (certBusy) return;
    setCertBusy(true);
    try {
      await deleteCertification(id);
      await refreshCertifications();
    } catch (err) {
      surfaceServerError(err, "Couldn't remove the certification.");
    } finally {
      setCertBusy(false);
    }
  };

  const handleRowDocChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    certId: number,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Document must be under 10MB.");
      return;
    }
    setPendingDocCertId(certId);
    try {
      await uploadCertificationDocument(certId, file);
      await refreshCertifications();
      toast.success("Document uploaded — pending review.");
    } catch (err) {
      surfaceServerError(err, "Couldn't upload the document. Try again in a moment.");
    } finally {
      setPendingDocCertId(null);
    }
  };

  const updateDay = (day: string, field: keyof DayAvailability, value: string | boolean) => {
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const updateReference = (index: number, field: keyof Reference, value: string) => {
    setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Photo is uploaded eagerly on file select via handlePhotoSelect, so
      // there's nothing to do here for it.

      await api.patch("/api/me/caregiver-profile", {
        date_of_birth: dateOfBirth,
        gender,
        bio,
        address,
        postal_code: postalCode,
        hourly_rate: hourlyRate,
        travel_radius_km: travelRadius,
        years_of_experience: yearsOfExperience,
        languages: selectedLanguages,
        interests,
        personality_tags: personalityTags,
        // certifications now managed via their own endpoint — not part of
        // this PATCH payload (see addCertification / removeCertification).
        services_offered: Object.entries(selectedServices).map(([id, years]) => ({
          id: Number(id),
          years_experience: years,
        })),
        references: references.filter((r) => r.name),
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        emergency_contact_relationship: emergencyRelationship,
        availability: { weekly: availability },
      });

      // Refresh the auth store so caregiver_profile.onboarding_complete is
      // current — without this, the next visit to /profile sees stale
      // local state and AuthGuard bounces the user back to /onboarding
      // (because postLoginRoute still thinks they're not done).
      await useAuthStore.getState().fetchUser();

      // First-run signup: walk the caregiver into the dashboard so they can
      // see their first matches. Edit session from /profile: stay on the
      // page, just show a confirmation in the sticky save bar.
      if (isAlreadyOnboarded) {
        setLastSavedAt(formatSavedAt(new Date()));
        toast.success("Profile saved.");
      } else {
        toast.success("Profile complete! You're ready to receive gigs.");
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      // Surface the actual server message (validation errors, 500s, etc)
      // instead of swallowing into a generic "failed to save". 422 field
      // errors fan out into one toast each.
      const error = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
      };
      const fieldErrors = error.response?.data?.errors;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        Object.values(fieldErrors)
          .flat()
          .forEach((msg) => toast.error(msg));
      } else {
        toast.error(error.response?.data?.message ?? "Failed to save profile. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fee-on-top model: caregiver gets the full hourly rate, fee is added
  // on top of what the family pays.
  const platformFee = +(hourlyRate * 0.075).toFixed(2);
  const familyPays = +(hourlyRate + platformFee).toFixed(2);
  const youKeep = hourlyRate;

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
              Tell families <span className="italic text-primary">who you are.</span>
            </>
          ) : (
            <>
              Let&rsquo;s set up <span className="italic text-primary">your profile.</span>
            </>
          )}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {isAlreadyOnboarded
            ? "Switch tabs to edit any section. Changes save when you press the button at the bottom."
            : "Walk through the tabs — when each is filled out, families can find and book you."}
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
            {/* ─── STEP 1: Personal Info ─── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="group relative mb-2 flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted transition-colors hover:bg-muted/80 disabled:cursor-not-allowed"
                  >
                    {photoPreview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={photoPreview} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <Camera className="size-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                    )}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                        <Loader2 className="size-6 animate-spin text-primary" />
                      </div>
                    )}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {isUploadingPhoto ? "Uploading…" : "Upload a profile photo"}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      className="h-12"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option value="">Select...</option>
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bio">About You</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell families about your experience, personality, and why you love caregiving..."
                    rows={5}
                    maxLength={500}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {bio.length < 50
                        ? `${50 - bio.length} more characters needed`
                        : "Looks great!"}
                    </span>
                    <span>{bio.length}/500</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    className="h-12"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City, Province"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input
                    id="postal"
                    className="h-12"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                    placeholder="L1H 8C1"
                    maxLength={7}
                  />
                </div>
              </div>
            )}

            {/* ─── STEP 2: Services & Experience ─── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Your experience</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <Label htmlFor="yoe" className="shrink-0">
                      Total years of caregiving:
                    </Label>
                    <Input
                      id="yoe"
                      type="number"
                      className="h-12 w-24"
                      min={0}
                      max={50}
                      value={yearsOfExperience}
                      onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">What services do you offer?</h3>
                  <p className="text-sm text-muted-foreground">
                    Select services and set your experience for each.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categories.map((cat) => {
                    const Icon = iconMap[cat.icon] || Heart;
                    const selected = cat.id in selectedServices;
                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          "rounded-xl border-2 p-4 transition-all",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleService(cat.id)}
                          className="flex w-full items-start gap-3 text-left"
                        >
                          <div
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-lg",
                              selected
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                          {selected && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
                        </button>
                        {selected && (
                          <div className="mt-3 flex items-center gap-2 pl-[52px]">
                            <Label className="shrink-0 text-xs text-muted-foreground">
                              Years exp:
                            </Label>
                            <Input
                              type="number"
                              className="h-8 w-16 text-sm"
                              min={0}
                              max={50}
                              value={selectedServices[cat.id]}
                              onChange={(e) => setServiceExp(cat.id, Number(e.target.value))}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── STEP 3: Skills & Certifications ─── */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Languages you speak</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Select all languages you can communicate in.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => (
                      <button key={lang} type="button" onClick={() => toggleLanguage(lang)}>
                        <Badge
                          variant={selectedLanguages.includes(lang) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer px-3 py-1.5 text-sm transition-all",
                            selectedLanguages.includes(lang) &&
                              "bg-primary text-primary-foreground",
                          )}
                        >
                          {lang}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Certifications</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Add your professional certifications — every entry needs a PDF or photo
                    so the admin team can mark it as Verified.
                  </p>

                  {certifications.length > 0 && (
                    <ul className="mb-4 space-y-2">
                      {certifications.map((cert) => (
                        <li
                          key={cert.id}
                          className="rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Shield className="size-4 text-primary" />
                            <span className="text-sm font-medium">{cert.name}</span>
                            {cert.issuer ? (
                              <span className="text-xs text-muted-foreground">
                                {cert.issuer}
                              </span>
                            ) : null}
                            {cert.year ? (
                              <span className="text-xs text-muted-foreground">{cert.year}</span>
                            ) : null}
                            <CertStatusPill status={cert.status} />
                            <div className="ml-auto flex items-center gap-1">
                              {!cert.has_document || cert.status === "rejected" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-[11px]"
                                  disabled={pendingDocCertId === cert.id}
                                  onClick={() => {
                                    if (certRowDocInputRef.current) {
                                      certRowDocInputRef.current.dataset.certId = String(cert.id);
                                      certRowDocInputRef.current.click();
                                    }
                                  }}
                                >
                                  {pendingDocCertId === cert.id ? (
                                    <Loader2 className="mr-1 size-3 animate-spin" />
                                  ) : (
                                    <Plus className="mr-1 size-3" />
                                  )}
                                  {cert.has_document ? "Re-upload" : "Add document"}
                                </Button>
                              ) : null}
                              <button
                                type="button"
                                aria-label="Remove certification"
                                onClick={() => removeCertification(cert.id)}
                                disabled={certBusy}
                              >
                                <X className="size-4 text-muted-foreground hover:text-foreground" />
                              </button>
                            </div>
                          </div>
                          {cert.status === "rejected" && cert.rejection_reason ? (
                            <p className="mt-2 text-xs leading-relaxed text-destructive">
                              <span className="font-medium">Rejected:</span>{" "}
                              {cert.rejection_reason}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  <input
                    ref={certRowDocInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const id = Number(certRowDocInputRef.current?.dataset.certId);
                      if (Number.isFinite(id) && id > 0) {
                        handleRowDocChange(e, id);
                      }
                    }}
                  />

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={certName}
                        onChange={(e) => setCertName(e.target.value)}
                        className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                      >
                        <option value="">Select certification…</option>
                        {COMMON_CERTS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {/* Thin divider so "Other" reads as a different
                            tier from the preset list. */}
                        <option disabled>──────────</option>
                        <option value={CERT_OTHER_VALUE}>Other (specify)</option>
                      </select>
                      <Input
                        className="h-10 w-32"
                        placeholder="Issuer"
                        value={certIssuer}
                        onChange={(e) => setCertIssuer(e.target.value)}
                      />
                      <Input
                        className="h-10 w-20"
                        type="number"
                        placeholder="Year"
                        value={certYear}
                        onChange={(e) => setCertYear(e.target.value)}
                        min={1990}
                        max={2030}
                      />
                    </div>
                    {/* CSS-only slide reveal: grid-rows transition keeps
                        the field flush with the strip above and animates
                        cleanly on open. */}
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 ease-out",
                        certName === CERT_OTHER_VALUE
                          ? "grid-rows-[1fr]"
                          : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <Input
                          className="h-10"
                          placeholder="Name your certification — e.g. Vulnerable Sector Check"
                          value={certCustomName}
                          onChange={(e) => setCertCustomName(e.target.value)}
                          maxLength={100}
                          autoFocus={certName === CERT_OTHER_VALUE}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={certDocInputRef}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => setCertDoc(e.target.files?.[0] ?? null)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-9",
                          !certDoc &&
                            certName &&
                            !(certName === CERT_OTHER_VALUE && !certCustomName.trim())
                            ? "border-accent/40 text-accent hover:bg-accent/5 hover:text-accent"
                            : "",
                        )}
                        onClick={() => certDocInputRef.current?.click()}
                      >
                        <Plus className="mr-1 size-3" />
                        {certDoc ? certDoc.name : "Attach your cert (required)"}
                      </Button>
                      {certDoc ? (
                        <button
                          type="button"
                          aria-label="Clear document"
                          onClick={() => {
                            setCertDoc(null);
                            if (certDocInputRef.current) certDocInputRef.current.value = "";
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          clear
                        </button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        className="ml-auto h-9"
                        onClick={addCertification}
                        disabled={
                          !certName ||
                          (certName === CERT_OTHER_VALUE && !certCustomName.trim()) ||
                          !certDoc ||
                          certBusy
                        }
                      >
                        {certBusy ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <Plus className="mr-1 size-3" />
                        )}
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDF or image, up to 10MB. The admin team reviews documents within a
                      couple of business days — your cert appears as &ldquo;Pending&rdquo; until
                      then.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Your interests</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Help families find things you have in common.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      className="h-12"
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                      placeholder="Type an interest and press Enter"
                    />
                    <Button type="button" variant="outline" className="h-12" onClick={addInterest}>
                      Add
                    </Button>
                  </div>
                  {interests.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {interests.map((interest) => (
                        <Badge key={interest} variant="secondary" className="gap-1 px-3 py-1.5">
                          {interest}
                          <button
                            type="button"
                            onClick={() =>
                              setInterests((prev) => prev.filter((i) => i !== interest))
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

                <div>
                  <h3 className="text-lg font-semibold">Personality traits</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    How would you describe yourself?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PERSONALITY_TAGS.map((tag) => (
                      <button key={tag} type="button" onClick={() => togglePersonality(tag)}>
                        <Badge
                          variant={personalityTags.includes(tag) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer px-3 py-1.5 text-sm transition-all",
                            personalityTags.includes(tag) && "bg-accent text-accent-foreground",
                          )}
                        >
                          {tag}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 4: Rate & Availability ─── */}
            {step === 4 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold">Your hourly rate</h3>
                  <div className="mt-4">
                    <div className="flex items-center gap-4">
                      <DollarSign className="size-5 text-muted-foreground" />
                      <input
                        type="range"
                        min={18}
                        max={50}
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      />
                      <span className="w-16 text-right text-2xl font-bold text-foreground">
                        ${hourlyRate}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 rounded-xl bg-muted/60 p-4 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Family pays</p>
                        <p className="text-lg font-semibold">${familyPays}</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">You keep</p>
                        <p className="text-lg font-semibold text-success">${youKeep}</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Platform fee</p>
                        <p className="text-lg font-semibold text-muted-foreground">
                          ${platformFee}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Travel radius</h3>
                  <p className="text-sm text-muted-foreground">
                    How far are you willing to travel?
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={travelRadius}
                      onChange={(e) => setTravelRadius(Number(e.target.value))}
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    />
                    <span className="w-20 text-right text-lg font-semibold">{travelRadius} km</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Weekly availability</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Set your typical weekly schedule.
                  </p>
                  <div className="space-y-3">
                    {DAYS.map((day) => {
                      const key = day.toLowerCase();
                      const dayData = availability[key];
                      return (
                        <div
                          key={day}
                          className="flex items-center gap-3 rounded-xl border border-border p-3"
                        >
                          <Switch
                            checked={dayData.available}
                            onCheckedChange={(checked) => updateDay(key, "available", checked)}
                          />
                          <span
                            className={cn(
                              "w-24 text-sm font-medium",
                              !dayData.available && "text-muted-foreground",
                            )}
                          >
                            {day}
                          </span>
                          {dayData.available ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={dayData.start}
                                onChange={(e) => updateDay(key, "start", e.target.value)}
                                className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm"
                              />
                              <span className="text-xs text-muted-foreground">to</span>
                              <input
                                type="time"
                                value={dayData.end}
                                onChange={(e) => updateDay(key, "end", e.target.value)}
                                className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm"
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not available</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 5: Safety & References ─── */}
            {step === 5 && (
              <div className="space-y-8">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <Shield className="size-5 text-primary" /> Emergency Contact
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Someone we can reach if there&apos;s an emergency during a visit.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ec-name">Name</Label>
                      <Input
                        id="ec-name"
                        className="h-12"
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ec-phone">Phone</Label>
                      <Input
                        id="ec-phone"
                        type="tel"
                        className="h-12"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="+1 (416) 555-0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ec-rel">Relationship</Label>
                      <Input
                        id="ec-rel"
                        className="h-12"
                        value={emergencyRelationship}
                        onChange={(e) => setEmergencyRelationship(e.target.value)}
                        placeholder="e.g. Spouse"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <UserCheck className="size-5 text-primary" /> Professional References
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Provide 2 references who can speak to your caregiving experience. They&apos;ll
                    receive an email questionnaire.
                  </p>

                  {references.map((ref, i) => (
                    <div key={i} className="mb-4 rounded-xl border border-border p-4">
                      <p className="mb-3 text-sm font-medium">Reference {i + 1}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Name</Label>
                          <Input
                            className="h-12"
                            value={ref.name}
                            onChange={(e) => updateReference(i, "name", e.target.value)}
                            placeholder="Full name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            className="h-12"
                            value={ref.email}
                            onChange={(e) => updateReference(i, "email", e.target.value)}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Phone (optional)</Label>
                          <Input
                            type="tel"
                            className="h-12"
                            value={ref.phone}
                            onChange={(e) => updateReference(i, "phone", e.target.value)}
                            placeholder="+1 (416) 555-0000"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Relationship</Label>
                          <Input
                            className="h-12"
                            value={ref.relationship}
                            onChange={(e) => updateReference(i, "relationship", e.target.value)}
                            placeholder="e.g. Former employer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
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
                  : `${steps[step - 1].label} · step ${step} of ${steps.length}`}
            </p>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[140px]">
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-4" />
            )}
            {isAlreadyOnboarded ? "Save changes" : "Complete profile"}
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

/**
 * Read the Laravel error shape off an axios rejection and toast the
 * meaningful bit instead of a swallowed generic. 422 field errors fan
 * out into one toast each (mime/size validation, etc.); single-message
 * errors (419, 5xx) show the server's `message`; everything else falls
 * back to the supplied default.
 */
function surfaceServerError(err: unknown, fallback: string): void {
  const error = err as {
    response?: { data?: { message?: string; errors?: Record<string, string[]> } };
  };
  const fieldErrors = error.response?.data?.errors;
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    Object.values(fieldErrors)
      .flat()
      .forEach((msg) => toast.error(msg));
    return;
  }
  toast.error(error.response?.data?.message ?? fallback);
}

/**
 * Photo paths come back as either:
 * - a fully-qualified URL (seeded pravatar avatars), or
 * - a relative public-disk path (uploaded files).
 *
 * The public disk is served by Laravel at `/storage/<path>` on the API
 * origin, so we prepend NEXT_PUBLIC_API_URL for the relative case.
 */
function resolvePhotoUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}/storage/${path.replace(/^\/+/, "")}`;
}

function CertStatusPill({
  status,
}: {
  status: import("@/lib/certifications").CertificationStatus;
}) {
  const tone = statusTone(status);
  const cls: Record<typeof tone, string> = {
    muted: "bg-muted text-muted-foreground ring-foreground/15",
    primary: "bg-primary/10 text-primary ring-primary/30",
    success: "bg-success/10 text-success ring-success/30",
    destructive: "bg-destructive/10 text-destructive ring-destructive/30",
    warning: "bg-accent/10 text-accent ring-accent/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase ring-1 ${cls[tone]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
