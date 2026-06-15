"use client";

import { useState, useEffect, useRef } from "react";
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
  UserCircle,
  Award,
  Briefcase,
  Check,
  Calendar as CalendarIcon,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  "Bangla",
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

// {value,label} items so the Select trigger renders the readable label
// (not the raw value) for the chosen certification, incl. the "Other" entry.
const CERT_ITEMS = [
  ...COMMON_CERTS.map((c) => ({ value: c, label: c })),
  { value: CERT_OTHER_VALUE, label: "Other (specify)" },
];

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// "09:00" → "9:00 AM" for the time pickers; storage stays 24-hour "HH:MM".
function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// 15-minute slots for the availability time selects.
const TIME_OPTIONS = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      out.push({ value: v, label: timeLabel(v) });
    }
  }
  return out;
})();

const steps = [
  { label: "Personal", description: "About you", icon: UserCircle },
  { label: "Services", description: "What you offer", icon: Briefcase },
  { label: "Skills", description: "Certs & languages", icon: Award },
  { label: "Rate", description: "Pay & schedule", icon: DollarSign },
  { label: "Safety", description: "References", icon: Shield },
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

export function OnboardingForm({ embedded = false }: { embedded?: boolean }) {
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
  const [dobOpen, setDobOpen] = useState(false);
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
    const finalName = certName === CERT_OTHER_VALUE ? certCustomName.trim() : certName;
    if (!finalName) {
      toast.error(
        certName === CERT_OTHER_VALUE ? "Type the certification name." : "Pick a certification.",
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

  const handleRowDocChange = async (e: React.ChangeEvent<HTMLInputElement>, certId: number) => {
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

  const StepIcon = steps[step - 1].icon;

  return (
    <div
      className={cn(
        "w-full max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8",
        // Centered for the focused standalone onboarding flow; left-aligned
        // inside the dashboard shell (profile editor).
        !embedded && "mx-auto",
      )}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* ─── Vertical step nav ─── */}
        <nav
          role="tablist"
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
                Set up your profile
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Walk through the steps — when each is filled out, families can find and book you.
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
              {/* ─── STEP 1: Personal Info ─── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-5 rounded-xl border border-border bg-muted/20 p-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="group relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl bg-muted shadow-sm ring-2 ring-card transition-colors hover:bg-muted/80 disabled:cursor-not-allowed"
                    >
                      {photoPreview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={photoPreview} alt="Preview" className="size-full object-cover" />
                      ) : (
                        <Camera className="size-7 text-muted-foreground transition-colors group-hover:text-foreground" />
                      )}
                      {isUploadingPhoto && (
                        <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                          <Loader2 className="size-6 animate-spin text-primary" />
                        </div>
                      )}
                      <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-md bg-primary text-primary-foreground shadow ring-2 ring-card">
                        <Camera className="size-3" strokeWidth={2.25} />
                      </span>
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Profile photo</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {isUploadingPhoto
                          ? "Uploading…"
                          : "A clear face photo helps families trust you. JPG or PNG, up to 5MB."}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={isUploadingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="size-3.5" />
                        {photoPreview ? "Change photo" : "Upload photo"}
                      </Button>
                    </div>
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
                      <Popover open={dobOpen} onOpenChange={setDobOpen}>
                        <PopoverTrigger
                          id="dob"
                          className="flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-ring"
                        >
                          <span className={cn(!dateOfBirth && "text-muted-foreground")}>
                            {dateOfBirth
                              ? format(parseISO(dateOfBirth), "MMM d, yyyy")
                              : "Select date"}
                          </span>
                          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto">
                          <Calendar
                            value={dateOfBirth ? parseISO(dateOfBirth) : null}
                            onSelect={(date) => {
                              setDateOfBirth(format(date, "yyyy-MM-dd"));
                              setDobOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        items={GENDERS}
                        value={gender || null}
                        onValueChange={(value) => setGender(value ?? "")}
                      >
                        <SelectTrigger id="gender" className="w-full data-[size=default]:h-10">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      className="h-10"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St, City, Province"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="postal">Postal Code</Label>
                    <Input
                      id="postal"
                      className="h-10"
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
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Your experience
                    </h3>
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
                      <Label htmlFor="yoe" className="shrink-0 text-sm">
                        Total years of caregiving
                      </Label>
                      <Input
                        id="yoe"
                        type="number"
                        className="h-10 w-24"
                        min={0}
                        max={50}
                        value={yearsOfExperience}
                        onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                      />
                      <span className="text-sm text-muted-foreground">years</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      What services do you offer?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
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
                            "rounded-xl border p-4 transition-all",
                            selected
                              ? "border-primary/40 bg-primary/[0.04] shadow-sm ring-1 ring-primary/20"
                              : "border-border hover:border-primary/30 hover:bg-muted/30",
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
                                className="h-10 w-16 text-sm"
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
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Languages you speak
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Select all languages you can communicate in.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => {
                        const on = selectedLanguages.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                              on
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.04]",
                            )}
                          >
                            {on && <CheckCircle2 className="size-3.5" strokeWidth={2.5} />}
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Certifications
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Add your professional certifications — every entry needs a PDF or photo so the
                      admin team can mark it as Verified.
                    </p>

                    {certifications.length > 0 && (
                      <ul className="mb-4 space-y-2">
                        {certifications.map((cert) => (
                          <li
                            key={cert.id}
                            className="rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:bg-muted/30"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Shield className="size-4 text-primary" />
                              <span className="text-sm font-medium">{cert.name}</span>
                              {cert.issuer ? (
                                <span className="text-xs text-muted-foreground">{cert.issuer}</span>
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

                    <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Add a certification
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Select
                          items={CERT_ITEMS}
                          value={certName || null}
                          onValueChange={(value) => setCertName(value ?? "")}
                        >
                          <SelectTrigger className="flex-1 data-[size=default]:h-10">
                            <SelectValue placeholder="Select certification…" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_CERTS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                            {/* Separator so "Other" reads as a different
                              tier from the preset list. */}
                            <SelectSeparator />
                            <SelectItem value={CERT_OTHER_VALUE}>Other (specify)</SelectItem>
                          </SelectContent>
                        </Select>
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
                          certName === CERT_OTHER_VALUE ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
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
                          size="lg"
                          className={cn(
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
                          size="lg"
                          className="ml-auto"
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
                        PDF or image, up to 10MB. The admin team reviews documents within a couple
                        of business days — your cert appears as &ldquo;Pending&rdquo; until then.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Your interests
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Help families find things you have in common.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        className="h-10"
                        value={interestInput}
                        onChange={(e) => setInterestInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                        placeholder="Type an interest and press Enter"
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
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Personality traits
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      How would you describe yourself?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PERSONALITY_TAGS.map((tag) => {
                        const on = personalityTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => togglePersonality(tag)}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                              on
                                ? "border-accent bg-accent text-accent-foreground shadow-sm"
                                : "border-border bg-card text-foreground hover:border-accent/40 hover:bg-accent/[0.04]",
                            )}
                          >
                            {on && <CheckCircle2 className="size-3.5" strokeWidth={2.5} />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── STEP 4: Rate & Availability ─── */}
              {step === 4 && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Your hourly rate
                    </h3>
                    <div className="mt-4">
                      <div className="flex items-center gap-4">
                        <DollarSign className="size-5 text-muted-foreground" />
                        <Slider
                          min={18}
                          max={50}
                          value={hourlyRate}
                          onValueChange={(value) => setHourlyRate(value as number)}
                          className="flex-1"
                        />
                        <span className="w-16 text-right text-2xl font-bold text-foreground">
                          ${hourlyRate}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            Family pays
                          </p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                            ${familyPays}
                          </p>
                        </div>
                        <div className="rounded-xl border border-success/30 bg-success/[0.06] p-3 text-center">
                          <p className="text-[11px] font-semibold tracking-wide text-success uppercase">
                            You keep
                          </p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-success">
                            ${youKeep}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            Platform fee
                          </p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-muted-foreground">
                            ${platformFee}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Travel radius
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      How far are you willing to travel?
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <Slider
                        min={1}
                        max={50}
                        value={travelRadius}
                        onValueChange={(value) => setTravelRadius(value as number)}
                        className="flex-1"
                      />
                      <span className="w-20 text-right text-lg font-semibold">
                        {travelRadius} km
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Weekly availability
                    </h3>
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
                            className={cn(
                              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                              dayData.available
                                ? "border-border bg-card"
                                : "border-border/60 bg-muted/20",
                            )}
                          >
                            <Switch
                              checked={dayData.available}
                              onCheckedChange={(checked) => updateDay(key, "available", checked)}
                            />
                            <span
                              className={cn(
                                "w-24 text-sm font-semibold",
                                !dayData.available && "text-muted-foreground",
                              )}
                            >
                              {day}
                            </span>
                            {dayData.available ? (
                              <div className="ml-auto flex items-center gap-2">
                                <Select
                                  items={TIME_OPTIONS}
                                  value={dayData.start}
                                  onValueChange={(v) => updateDay(key, "start", v ?? "")}
                                >
                                  <SelectTrigger className="w-[7.5rem] gap-1.5 data-[size=default]:h-10">
                                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                                    <SelectValue placeholder="Start" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-xs text-muted-foreground">to</span>
                                <Select
                                  items={TIME_OPTIONS}
                                  value={dayData.end}
                                  onValueChange={(v) => updateDay(key, "end", v ?? "")}
                                >
                                  <SelectTrigger className="w-[7.5rem] gap-1.5 data-[size=default]:h-10">
                                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                                    <SelectValue placeholder="End" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <span className="ml-auto text-sm text-muted-foreground">
                                Not available
                              </span>
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
                    <h3 className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
                      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Shield className="size-4" strokeWidth={2} />
                      </span>
                      Emergency Contact
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Someone we can reach if there&apos;s an emergency during a visit.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ec-name">Name</Label>
                        <Input
                          id="ec-name"
                          className="h-10"
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
                          className="h-10"
                          value={emergencyPhone}
                          onChange={(e) => setEmergencyPhone(e.target.value)}
                          placeholder="+1 (416) 555-0000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ec-rel">Relationship</Label>
                        <Input
                          id="ec-rel"
                          className="h-10"
                          value={emergencyRelationship}
                          onChange={(e) => setEmergencyRelationship(e.target.value)}
                          placeholder="e.g. Spouse"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
                      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                        <UserCheck className="size-4" strokeWidth={2} />
                      </span>
                      Professional References
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Provide 2 references who can speak to your caregiving experience. They&apos;ll
                      receive an email questionnaire.
                    </p>

                    {references.map((ref, i) => (
                      <div key={i} className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-[11px] font-bold tabular-nums text-primary">
                            {i + 1}
                          </span>
                          Reference {i + 1}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input
                              className="h-10"
                              value={ref.name}
                              onChange={(e) => updateReference(i, "name", e.target.value)}
                              placeholder="Full name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              className="h-10"
                              value={ref.email}
                              onChange={(e) => updateReference(i, "email", e.target.value)}
                              placeholder="email@example.com"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Phone (optional)</Label>
                            <Input
                              type="tel"
                              className="h-10"
                              value={ref.phone}
                              onChange={(e) => updateReference(i, "phone", e.target.value)}
                              placeholder="+1 (416) 555-0000"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Relationship</Label>
                            <Input
                              className="h-10"
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
              {isAlreadyOnboarded ? "Save changes" : "Complete profile"}
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${cls[tone]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
