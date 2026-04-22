"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Shield,
  MapPin,
  Clock,
  DollarSign,
  MessageCircle,
  Loader2,
  Star,
  Briefcase,
  Award,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/ui/star-rating";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PublicLayout } from "@/components/layouts/public-layout";
import api from "@/lib/api";

interface CaregiverService {
  id: number;
  name: string;
  icon: string;
  pivot: { years_experience: number };
}

interface Certification {
  name: string;
  issuer?: string;
  year?: string;
  status: string;
}

interface CaregiverData {
  id: number;
  name: string;
  gender: string | null;
  caregiver_profile: {
    bio: string;
    hourly_rate: string;
    travel_radius_km: number;
    years_of_experience: number;
    languages: string[];
    interests: string[];
    personality_tags: string[];
    certifications: Certification[] | null;
    photo_path: string | null;
    photo_status: string;
    onboarding_complete: boolean;
    services: CaregiverService[];
  };
}

export default function CaregiverProfilePage() {
  const params = useParams();
  const [caregiver, setCaregiver] = useState<CaregiverData | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/api/caregivers/${params.id}`);
        setCaregiver(res.data.caregiver);
        setIsVerified(res.data.is_verified || false);
      } catch {
        setError("Caregiver not found.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (error || !caregiver) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <h2 className="mb-2">Caregiver Not Found</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </PublicLayout>
    );
  }

  const profile = caregiver.caregiver_profile;
  const initials = caregiver.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const photoUrl =
    profile.photo_path && profile.photo_status === "approved"
      ? `${process.env.NEXT_PUBLIC_API_URL}/storage/${profile.photo_path}`
      : undefined;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Avatar className="mb-4 size-28">
                  {photoUrl && <AvatarImage src={photoUrl} alt={caregiver.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <h1 className="text-xl font-bold">{caregiver.name}</h1>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  {isVerified ? (
                    <Badge className="bg-success text-success-foreground">
                      <Shield className="mr-1 size-3" /> Basic Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Unverified
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1">
                  <StarRating value={0} readonly size="sm" />
                  <span className="text-sm text-muted-foreground">No reviews yet</span>
                </div>

                <Separator className="my-4" />

                <div className="w-full space-y-3 text-left text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4 text-primary" />
                    <span className="font-medium">${profile.hourly_rate}/hr</span>
                  </div>
                  {profile.years_of_experience > 0 && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="size-4 text-primary" />
                      <span>{profile.years_of_experience} years experience</span>
                    </div>
                  )}
                  {caregiver.gender && caregiver.gender !== "prefer_not_to_say" && (
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-primary" />
                      <span className="capitalize">{caregiver.gender.replace("_", " ")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    <span>Travels up to {profile.travel_radius_km} km</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    <span>Member since {new Date().getFullYear()}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex w-full gap-2">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button className="flex-1" disabled>
                          Book
                        </Button>
                      }
                    />
                    <TooltipContent>Booking coming soon</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" className="flex-1" disabled>
                          <MessageCircle className="mr-1 size-4" /> Message
                        </Button>
                      }
                    />
                    <TooltipContent>Messaging coming soon</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">{profile.bio}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Services Offered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.services.map((svc) => (
                    <Badge key={svc.id} variant="secondary" className="px-3 py-1.5">
                      {svc.name}
                      {svc.pivot.years_experience > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          · {svc.pivot.years_experience} yr
                          {svc.pivot.years_experience !== 1 ? "s" : ""}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {profile.certifications && profile.certifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="size-4 text-primary" />
                    Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {profile.certifications.map((cert, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                      >
                        <Shield className="size-4 text-primary" />
                        <span className="flex-1 text-sm font-medium">{cert.name}</span>
                        {cert.issuer && (
                          <span className="text-xs text-muted-foreground">{cert.issuer}</span>
                        )}
                        {cert.year && (
                          <span className="text-xs text-muted-foreground">{cert.year}</span>
                        )}
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[0.6rem] text-muted-foreground"
                        >
                          Self-reported
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {profile.languages && profile.languages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Languages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.languages.map((lang) => (
                      <Badge key={lang} variant="outline" className="px-3 py-1.5">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {((profile.interests && profile.interests.length > 0) ||
              (profile.personality_tags && profile.personality_tags.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Interests & Personality</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.interests && profile.interests.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Interests</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.map((interest) => (
                          <Badge key={interest} variant="secondary" className="px-3 py-1.5">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.personality_tags && profile.personality_tags.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Personality</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.personality_tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="px-3 py-1.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-amber-400" />
                  Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center py-8 text-center">
                  <p className="text-muted-foreground">No reviews yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reviews will appear here after completed bookings.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
