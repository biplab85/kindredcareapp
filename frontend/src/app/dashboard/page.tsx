"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, AlertTriangle, ArrowRight, Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CaregiverLayout } from "@/components/layouts/caregiver-layout";
import { FamilyLayout } from "@/components/layouts/family-layout";
import { ProfileCompletionCard } from "@/components/caregiver/profile-completion-card";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";

interface ProfileCompletion {
  percentage: number;
  is_matchable: boolean;
  missing: { field: string; label: string; weight: number }[];
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user.role === "caregiver") return <CaregiverDashboard />;
  if (user.role === "family") return <FamilyDashboard />;
  return <div className="p-8 text-center text-muted-foreground">Dashboard for {user.role}</div>;
}

function CaregiverDashboard() {
  const user = useAuthStore((s) => s.user);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    api
      .get("/api/me")
      .then((res) => {
        setCompletion(res.data.profile_completion || null);
        setIsVerified(res.data.is_fully_verified || false);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <CaregiverLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </CaregiverLayout>
    );
  }

  return (
    <CaregiverLayout isVerified={isVerified}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(" ")[0]}!</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s an overview of your KindredCare account.
          </p>
        </div>

        {/* Verification alert */}
        {isVerified ? (
          <Alert>
            <ShieldCheck className="size-4 text-success" />
            <AlertTitle>You&apos;re verified!</AlertTitle>
            <AlertDescription>
              Your &quot;Basic Verified&quot; badge is active. Families can find and book you.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="size-4 text-warning" />
            <AlertTitle>Verification needed</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>Complete your verification to start receiving bookings.</span>
              <Link href="/verification">
                <Button size="sm" className="ml-4">
                  Verify Now <ArrowRight className="ml-1 size-3" />
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Profile completion */}
        {completion && completion.percentage < 100 && (
          <ProfileCompletionCard
            percentage={completion.percentage}
            isMatchable={completion.is_matchable}
            missing={completion.missing}
          />
        )}

        {/* Quick stats placeholder */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Available gigs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Heart className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Active bookings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/10 text-success">
                <Badge className="bg-transparent px-0 text-success">$0</Badge>
              </div>
              <div>
                <p className="text-2xl font-bold">$0.00</p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CaregiverLayout>
  );
}

function FamilyDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <FamilyLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name?.split(" ")[0]}!</h1>
          <p className="text-sm text-muted-foreground">
            Find trusted caregivers for your loved ones.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Search className="mb-4 size-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">Ready to find a caregiver?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Post a gig to get matched with verified caregivers in your area.
            </p>
            <Link href="/gigs" className="mt-4">
              <Button>
                Post a Gig <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </FamilyLayout>
  );
}
