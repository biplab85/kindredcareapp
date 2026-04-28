"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { GigWizard } from "../_components/gig-wizard";

export default function NewGigPage() {
  return (
    <AuthGuard roles={["family"]}>
      <DashboardShell pageTitle="Post a gig">
        <Suspense fallback={<InitialLoad />}>
          <GigWizard mode="create" />
        </Suspense>
      </DashboardShell>
    </AuthGuard>
  );
}

function InitialLoad() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-7 animate-spin text-primary" />
    </div>
  );
}
