"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  User,
  Languages,
  Accessibility,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  age: number | null;
  language: string | null;
  interests: string[] | null;
  accessibility_notes: string | null;
}

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

export default function CareRecipientsPage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Care recipients">
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
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

    setIsSaving(true);
    try {
      const data = {
        name,
        street_address: streetAddress.trim() || null,
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            Care recipients, <span className="font-normal italic text-primary">on file</span>.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            The people you&apos;re arranging care for. Add or update anyone anytime.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-1 size-4" /> Add Person
          </Button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit Care Recipient" : "Add a Care Recipient"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rname">Name</Label>
                <Input
                  id="rname"
                  className="h-12"
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
                  className="h-12"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="78"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rstreet">Street Address (optional)</Label>
              <Input
                id="rstreet"
                className="h-12"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="123 Main Street"
              />
              <p className="text-xs text-muted-foreground">
                Where visits happen. The booking form pre-fills from this; you can override per
                visit.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rlang">Primary Language</Label>
              <select
                id="rlang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
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
                  className="h-12"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                  placeholder="e.g. gardening, puzzles"
                />
                <Button type="button" variant="outline" className="h-12" onClick={addInterest}>
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
              <Label htmlFor="rnotes">Accessibility Notes (optional)</Label>
              <Textarea
                id="rnotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Uses a walker, hearing aid"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving || name.length < 2}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Person"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipient list */}
      {recipients.length === 0 && !showForm ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <User className="mb-4 size-12 text-muted-foreground/30" />
            <p className="font-medium">No care recipients yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the people you&apos;re arranging care for.
            </p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-1 size-4" /> Add Care Recipient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recipients.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.age && <span className="text-sm text-muted-foreground">Age {r.age}</span>}
                  </div>

                  <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {r.street_address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" /> {r.street_address}
                      </div>
                    )}
                    {r.language && (
                      <div className="flex items-center gap-1.5">
                        <Languages className="size-3.5" /> {r.language}
                      </div>
                    )}
                    {r.accessibility_notes && (
                      <div className="flex items-start gap-1.5">
                        <Accessibility className="mt-0.5 size-3.5 shrink-0" />{" "}
                        {r.accessibility_notes}
                      </div>
                    )}
                  </div>

                  {r.interests && r.interests.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.interests.map((interest) => (
                        <Badge key={interest} variant="secondary" className="text-xs">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(r)}>
                    <Pencil className="size-4" />
                  </Button>

                  <Dialog
                    open={deletingId === r.id}
                    onOpenChange={(open) => setDeletingId(open ? r.id : null)}
                  >
                    <DialogTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
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
                        <DialogClose render={<Button variant="outline">Cancel</Button>} />
                        <Button variant="destructive" onClick={() => handleDelete(r.id)}>
                          Remove
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
