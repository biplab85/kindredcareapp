"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { getGig, type Gig } from "@/lib/gigs";
import { GigListingForm } from "../../_components/gig-listing-form";

export default function EditGigListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gigId = Number(id);

  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Edit gig">
        <Loader gigId={gigId} />
      </DashboardShell>
    </AuthGuard>
  );
}

function Loader({ gigId }: { gigId: number }) {
  const router = useRouter();
  const [gig, setGig] = useState<Gig | null>(null);

  useEffect(() => {
    if (Number.isNaN(gigId)) {
      router.replace("/me/gigs");
      return;
    }
    getGig(gigId)
      .then(setGig)
      .catch(() => {
        toast.error("Couldn't load that gig.");
        router.replace("/me/gigs");
      });
  }, [gigId, router]);

  if (!gig) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return <GigListingForm mode="edit" initialGig={gig} />;
}
