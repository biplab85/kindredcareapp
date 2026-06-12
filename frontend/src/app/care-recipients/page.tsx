"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  User,
  UserPlus,
  Languages,
  Accessibility,
  MapPin,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import api from "@/lib/api";

interface Recipient {
  id: number;
  name: string;
  street_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  age: number | null;
  language: string | null;
  interests: string[] | null;
  accessibility_notes: string | null;
}

const PROVINCES: { value: string; label: string }[] = [
  { value: "ON", label: "Ontario" },
  { value: "QC", label: "Quebec" },
  { value: "BC", label: "British Columbia" },
  { value: "AB", label: "Alberta" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland & Labrador" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "YT", label: "Yukon" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
];

const CANADIAN_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

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

// Native <select> styling, matched to the shared Input height/radius so the
// address + language pickers sit flush with the text fields around them.
const SELECT_CLASS =
  "h-[35px] w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50";

export default function CareRecipientsPage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Care recipients">
        <div className="max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
          <CareRecipientsContent />
        </div>
      </DashboardShell>
    </AuthGuard>
  );
}

function CareRecipientsContent() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  const [name, setName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("ON");
  const [postalCode, setPostalCode] = useState("");
  const [age, setAge] = useState("");
  const [language, setLanguage] = useState("English");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadRecipients = async () => {
    try {
      const res = await api.get("/api/me/care-recipients");
      setRecipients(res.data.recipients);
    } catch {
      toast.error("Failed to load care recipients.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadRecipients();
  }, []);

  const resetForm = () => {
    setName("");
    setStreetAddress("");
    setCity("");
    setProvince("ON");
    setPostalCode("");
    setAge("");
    setLanguage("English");
    setInterests([]);
    setInterestInput("");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (r: Recipient) => {
    setName(r.name);
    setStreetAddress(r.street_address || "");
    setCity(r.city || "");
    setProvince(r.province || "ON");
    setPostalCode(r.postal_code || "");
    setAge(r.age?.toString() || "");
    setLanguage(r.language || "English");
    setInterests(r.interests || []);
    setNotes(r.accessibility_notes || "");
    setEditingId(r.id);
    setShowForm(true);
  };

  const addInterest = () => {
    const trimmed = interestInput.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests((prev) => [...prev, trimmed]);
      setInterestInput("");
    }
  };

  const handleSave = async () => {
    if (name.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }

    const trimmedPostal = postalCode.trim().toUpperCase();
    if (trimmedPostal && !CANADIAN_POSTAL_REGEX.test(trimmedPostal)) {
      toast.error("Postal code must be a valid Canadian format (e.g. L1H 7K4).");
      return;
    }

    setIsSaving(true);
    try {
      const trimmedStreet = streetAddress.trim();
      const trimmedCity = city.trim();
      // Province only travels with a real address — sending "ON" alongside an
      // otherwise-blank address would pollute the record with a default that
      // means nothing to the matcher.
      const hasAnyAddress = !!(trimmedStreet || trimmedCity || trimmedPostal);
      const data = {
        name,
        street_address: trimmedStreet || null,
        city: trimmedCity || null,
        province: hasAnyAddress ? province : null,
        postal_code: trimmedPostal || null,
        age: age ? parseInt(age) : null,
        language,
        interests,
        accessibility_notes: notes || null,
      };

      if (editingId) {
        await api.patch(`/api/me/care-recipients/${editingId}`, data);
        toast.success("Care recipient updated.");
      } else {
        await api.post("/api/me/care-recipients", data);
        toast.success("Care recipient added.");
      }

      resetForm();
      fetchedRef.current = false;
      loadRecipients();
    } catch {
      toast.error("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/me/care-recipients/${id}`);
      setRecipients((prev) => prev.filter((r) => r.id !== id));
      setDeletingId(null);
      toast.success("Care recipient removed.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-[1.15] tracking-tight">Care recipients</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            The people you&apos;re arranging care for. Add or update anyone anytime.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="cursor-pointer">
          <Plus className="size-4" /> Add Person
        </Button>
      </div>

      {/* Add / Edit modal */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {editingId ? (
                <Pencil className="size-5" strokeWidth={2} />
              ) : (
                <UserPlus className="size-5" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {editingId ? "Edit care recipient" : "Add a care recipient"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                {editingId
                  ? "Update their details below."
                  : "Tell us who you're arranging care for."}
              </DialogDescription>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            {/* Basic details */}
            <FormSection icon={User} title="Basic details">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rname">Name</Label>
                  <Input
                    id="rname"
                    className="h-[35px]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rage">Age (optional)</Label>
                  <Input
                    id="rage"
                    type="number"
                    className="h-[35px]"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="78"
                  />
                </div>
              </div>
            </FormSection>

            {/* Address */}
            <FormSection icon={MapPin} title="Address">
              <div className="space-y-1.5">
                <Label htmlFor="rstreet">Street (optional)</Label>
                <Input
                  id="rstreet"
                  className="h-[35px]"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <Label htmlFor="rcity">City (optional)</Label>
                  <Input
                    id="rcity"
                    className="h-[35px]"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Oshawa"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rprov">Province</Label>
                  <select
                    id="rprov"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {PROVINCES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="rpostal">Postal code (optional)</Label>
                  <Input
                    id="rpostal"
                    className="h-[35px] font-mono tracking-wider uppercase"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                    placeholder="L1H 7K4"
                    maxLength={7}
                    autoComplete="postal-code"
                  />
                </div>
                <p className="self-end pb-2.5 text-xs leading-relaxed text-muted-foreground">
                  Where visits happen. The booking form pre-fills from this; you can override per
                  visit. Postal code sharpens caregiver-distance matching.
                </p>
              </div>
            </FormSection>

            {/* Care preferences */}
            <FormSection icon={Sparkles} title="Care preferences">
              <div className="space-y-1.5">
                <Label htmlFor="rlang">Primary language</Label>
                <select
                  id="rlang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Interests</Label>
                <div className="flex gap-2">
                  <Input
                    className="h-[35px]"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                    placeholder="e.g. gardening, puzzles"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[35px] cursor-pointer"
                    onClick={addInterest}
                  >
                    Add
                  </Button>
                </div>
                {interests.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {interests.map((i) => (
                      <Badge key={i} variant="secondary" className="gap-1 px-3 py-1.5">
                        {i}
                        <button
                          type="button"
                          onClick={() => setInterests((prev) => prev.filter((x) => x !== i))}
                          className="ml-1 cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${i}`}
                        >
                          &times;
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rnotes">Accessibility notes (optional)</Label>
                <Textarea
                  id="rnotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Uses a walker, hearing aid"
                  rows={3}
                  className="rounded-lg"
                />
              </div>
            </FormSection>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
            <Button variant="outline" onClick={resetForm} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || name.length < 2}
              className="cursor-pointer"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? "Save changes" : "Add person"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipient list */}
      {recipients.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <User className="size-7" strokeWidth={1.75} />
          </span>
          <p className="mt-4 font-semibold text-foreground">No care recipients yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the people you&apos;re arranging care for.
          </p>
          <Button className="mt-5 cursor-pointer" onClick={() => setShowForm(true)}>
            <Plus className="size-4" /> Add care recipient
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {recipients.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(10,14,40,0.04)] transition-all hover:border-primary/30 hover:shadow-[0_10px_26px_-16px_rgba(10,14,40,0.2)]"
            >
              {/* Header — avatar, identity, actions */}
              <div className="flex items-start gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl font-bold text-primary ring-1 ring-primary/15">
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {r.name}
                      </h3>
                      {r.age && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Age {r.age}
                        </span>
                      )}
                    </div>
                    {r.language && (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Languages className="size-3.5" strokeWidth={2} />
                        Speaks {r.language}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(r)}
                      className="cursor-pointer"
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <Dialog
                      open={deletingId === r.id}
                      onOpenChange={(open) => setDeletingId(open ? r.id : null)}
                    >
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="cursor-pointer"
                            aria-label={`Remove ${r.name}`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                      />
                      <DialogContent>
                        <DialogTitle>Remove {r.name}?</DialogTitle>
                        <DialogDescription>
                          This will remove {r.name} from your care recipients. Any active bookings
                          will not be affected.
                        </DialogDescription>
                        <div className="flex justify-end gap-2 pt-4">
                          <DialogClose
                            render={
                              <Button variant="outline" className="cursor-pointer">
                                Cancel
                              </Button>
                            }
                          />
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(r.id)}
                            className="cursor-pointer"
                          >
                            Remove
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              {/* Detail grid — labeled fact cells */}
              {(r.street_address || r.city || r.postal_code || r.accessibility_notes) && (
                <div className="mt-5 grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2">
                  {(r.street_address || r.city || r.postal_code) && (
                    <DetailTile icon={MapPin} label="Address">
                      {r.street_address && <span>{r.street_address}</span>}
                      {r.street_address && (r.city || r.postal_code) && (
                        <span className="text-muted-foreground/60"> · </span>
                      )}
                      {r.city && (
                        <span>
                          {r.city}
                          {r.province && `, ${r.province}`}
                        </span>
                      )}
                      {r.city && r.postal_code && (
                        <span className="text-muted-foreground/60"> · </span>
                      )}
                      {r.postal_code && (
                        <span className="font-mono text-xs tracking-wider">{r.postal_code}</span>
                      )}
                    </DetailTile>
                  )}
                  {r.accessibility_notes && (
                    <DetailTile icon={Accessibility} label="Accessibility">
                      {r.accessibility_notes}
                    </DetailTile>
                  )}
                </div>
              )}

              {/* Interests */}
              {r.interests && r.interests.length > 0 && (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Interests
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.interests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium break-words text-foreground">{children}</p>
      </div>
    </div>
  );
}
