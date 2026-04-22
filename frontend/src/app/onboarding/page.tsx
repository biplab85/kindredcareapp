"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Camera,
  Loader2,
  ArrowRight,
  ArrowLeft,
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
import { StepIndicator } from "@/components/ui/step-indicator";
import { ProfileCompletionRing } from "@/components/ui/profile-completion-ring";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
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

interface ServiceCategory {
  id: number;
  name: string;
  icon: string;
  description: string;
}
interface DayAvailability {
  available: boolean;
  start: string;
  end: string;
}
interface Certification {
  name: string;
  issuer: string;
  year: string;
}
interface Reference {
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

export default function OnboardingPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <OnboardingForm />
    </AuthGuard>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [yearsOfExperience, setYearsOfExperience] = useState(0);
  const [selectedServices, setSelectedServices] = useState<Record<number, number>>({});

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [personalityTags, setPersonalityTags] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certYear, setCertYear] = useState("");

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
    api
      .get("/api/service-categories")
      .then((res) => setCategories(res.data))
      .catch(() => toast.error("Failed to load services."));
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
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

  const addCertification = () => {
    if (!certName) return;
    setCertifications((prev) => [...prev, { name: certName, issuer: certIssuer, year: certYear }]);
    setCertName("");
    setCertIssuer("");
    setCertYear("");
  };

  const updateDay = (day: string, field: keyof DayAvailability, value: string | boolean) => {
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const updateReference = (index: number, field: keyof Reference, value: string) => {
    setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const localCompletion = (() => {
    let score = 0;
    if (bio.length >= 50) score += 15;
    if (photoFile) score += 10;
    if (dateOfBirth) score += 5;
    if (gender) score += 3;
    if (postalCode.length >= 6) score += 7;
    if (Object.keys(selectedServices).length > 0) score += 10;
    if (Object.values(selectedServices).some((v) => v > 0)) score += 5;
    if (yearsOfExperience > 0) score += 5;
    if (selectedLanguages.length > 0) score += 5;
    if (certifications.length > 0) score += 8;
    if (hourlyRate >= 18) score += 5;
    if (Object.values(availability).some((d) => d.available)) score += 7;
    if (emergencyName && emergencyPhone) score += 5;
    if (references.filter((r) => r.name).length >= 2) score += 7;
    if (personalityTags.length > 0) score += 2;
    if (interests.length > 0) score += 1;
    return Math.min(100, score);
  })();

  const canProceed = () => {
    switch (step) {
      case 1:
        return bio.length >= 50 && postalCode.length >= 6 && dateOfBirth.length > 0;
      case 2:
        return Object.keys(selectedServices).length > 0;
      case 3:
        return selectedLanguages.length > 0;
      case 4:
        return hourlyRate >= 18 && hourlyRate <= 50;
      case 5:
        return (
          emergencyName.length > 0 &&
          emergencyPhone.length > 0 &&
          references[0].name.length > 0 &&
          references[1].name.length > 0
        );
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (photoFile) {
        const formData = new FormData();
        formData.append("photo", photoFile);
        await api.post("/api/me/photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

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
        certifications: certifications.map((c) => ({ ...c, status: "self_reported" })),
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

      toast.success("Profile complete! You're ready to receive gigs.");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const platformFee = +(hourlyRate * 0.075).toFixed(2);
  const familyPays = +(hourlyRate + platformFee).toFixed(2);
  const youKeep = +(hourlyRate - platformFee).toFixed(2);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="KindredCare"
            width={160}
            height={36}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="text-2xl font-bold">Complete Your Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell families about yourself so they can find and book you.
          </p>
        </div>

        <div className="mb-8 flex items-center gap-6">
          <div className="flex-1">
            <StepIndicator steps={steps} currentStep={step} />
          </div>
          <ProfileCompletionRing percentage={localCompletion} size="sm" />
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* ─── STEP 1: Personal Info ─── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative mb-2 flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted transition-colors hover:bg-muted/80"
                  >
                    {photoPreview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={photoPreview} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <Camera className="size-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                    )}
                  </button>
                  <p className="text-xs text-muted-foreground">Upload a profile photo</p>
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
                    placeholder="123 Main St, Oshawa, ON"
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
                    Add your professional certifications. Displayed as &quot;Self-reported&quot;
                    until verified.
                  </p>

                  {certifications.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {certifications.map((cert, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                        >
                          <Shield className="size-4 text-primary" />
                          <span className="flex-1 text-sm font-medium">{cert.name}</span>
                          {cert.issuer && (
                            <span className="text-xs text-muted-foreground">{cert.issuer}</span>
                          )}
                          {cert.year && (
                            <span className="text-xs text-muted-foreground">{cert.year}</span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCertifications((prev) => prev.filter((_, idx) => idx !== i))
                            }
                          >
                            <X className="size-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={certName}
                      onChange={(e) => setCertName(e.target.value)}
                      className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    >
                      <option value="">Select certification...</option>
                      {COMMON_CERTS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10"
                      onClick={addCertification}
                      disabled={!certName}
                    >
                      <Plus className="mr-1 size-3" /> Add
                    </Button>
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

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="mr-1 size-4" /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  Next <ArrowRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 size-4" />
                  )}
                  Complete Setup
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
