"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardShell } from "@/components/layouts";
import { GigListingForm } from "../_components/gig-listing-form";

export default function NewGigListingPage() {
  return (
    <AuthGuard roles={["caregiver"]}>
      <DashboardShell pageTitle="Post a notice">
        <GigListingForm mode="create" />
      </DashboardShell>
    </AuthGuard>
  );
}
