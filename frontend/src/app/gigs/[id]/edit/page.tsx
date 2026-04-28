"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { getGig, type Gig } from "@/lib/gigs";
import { GigWizard } from "../../_components/gig-wizard";

const NON_EDITABLE_STATUSES: ReadonlyArray<Gig["status"]> = ["booked", "completed", "cancelled"];

export default function EditGigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gigId = Number(id);

  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Edit gig">
        <Suspense fallback={<InitialLoad />}>
          <EditGigLoader gigId={gigId} />
        </Suspense>
      </DashboardShell>
    </AuthGuard>
  );
}

function EditGigLoader({ gigId }: { gigId: number }) {
  const router = useRouter();
  const [gig, setGig] = useState<Gig | null>(null);
  const [error, setError] = useState<"not-found" | "forbidden" | "load-failed" | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (Number.isNaN(gigId) || fetchedRef.current) return;
    fetchedRef.current = true;

    getGig(gigId)
      .then((g) => {
        if (NON_EDITABLE_STATUSES.includes(g.status)) {
          toast.error(`This gig is ${g.status} — it can’t be edited.`);
          router.replace(`/gigs/${gigId}`);
          return;
        }
        setGig(g);
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setError("not-found");
        else if (status === 403) setError("forbidden");
        else setError("load-failed");
      });
  }, [gigId, router]);

  if (Number.isNaN(gigId) || error === "not-found") {
    return (
      <FailureShell title="We couldn’t find that gig." onBack={() => router.replace("/gigs")} />
    );
  }

  if (error === "forbidden") {
    return (
      <FailureShell
        title="You can only edit gigs you posted."
        onBack={() => router.replace("/gigs")}
      />
    );
  }

  if (error === "load-failed") {
    return (
      <FailureShell
        title="Something got in the way of loading this gig."
        onBack={() => router.replace(`/gigs/${gigId}`)}
      />
    );
  }

  if (!gig) {
    return <InitialLoad />;
  }

  return <GigWizard mode="edit" initialGig={gig} />;
}

function InitialLoad() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-7 animate-spin text-primary" />
    </div>
  );
}

function FailureShell({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        Back
      </button>
    </section>
  );
}
