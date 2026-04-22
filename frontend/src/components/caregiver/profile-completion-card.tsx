"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileCompletionRing } from "@/components/ui/profile-completion-ring";
import { cn } from "@/lib/utils";

interface MissingItem {
  field: string;
  label: string;
  weight: number;
}

interface ProfileCompletionCardProps {
  percentage: number;
  isMatchable: boolean;
  missing: MissingItem[];
  className?: string;
}

const fieldToStep: Record<string, string> = {
  bio: "/onboarding?step=1",
  photo: "/onboarding?step=1",
  date_of_birth: "/onboarding?step=1",
  gender: "/onboarding?step=1",
  address: "/onboarding?step=1",
  services: "/onboarding?step=2",
  service_experience: "/onboarding?step=2",
  years_of_experience: "/onboarding?step=2",
  languages: "/onboarding?step=3",
  certifications: "/onboarding?step=3",
  hourly_rate: "/onboarding?step=4",
  availability: "/onboarding?step=4",
  emergency_contact: "/onboarding?step=5",
  references: "/onboarding?step=5",
  personality_tags: "/onboarding?step=3",
  interests: "/onboarding?step=3",
};

export function ProfileCompletionCard({
  percentage,
  isMatchable,
  missing,
  className,
}: ProfileCompletionCardProps) {
  const isComplete = percentage >= 100;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {isComplete ? "Profile Complete!" : `Profile ${percentage}% Complete`}
          </CardTitle>
          {isMatchable ? (
            <Badge className="bg-success text-success-foreground">
              <Shield className="mr-1 size-3" /> Matchable
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Need 70% to match
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <ProfileCompletionRing percentage={percentage} size="md" showLabel={false} />

          <div className="flex-1">
            {isComplete ? (
              <div className="flex items-center gap-2 py-4">
                <CheckCircle2 className="size-5 text-success" />
                <p className="text-sm font-medium text-success">
                  Your profile is complete. You&apos;re ready to receive bookings!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Complete these to improve your visibility:
                </p>
                {missing.slice(0, 5).map((item) => (
                  <Link
                    key={item.field}
                    href={fieldToStep[item.field] || "/onboarding"}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                    )}
                  >
                    <div className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                    <span className="flex-1 text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-medium text-muted-foreground/60">
                      +{item.weight}%
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground/40" />
                  </Link>
                ))}
                {missing.length > 5 && (
                  <p className="pl-5 text-xs text-muted-foreground">
                    +{missing.length - 5} more items
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
