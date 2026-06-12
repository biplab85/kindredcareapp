"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

/**
 * The app domain has no marketing landing — that lives at kindredcare.ca.
 * `/` is a router-only page: authed users land on /dashboard, guests get
 * bounced to the marketing site. We render a brief spinner while the
 * decision happens to avoid a white flash.
 *
 * The marketing destination is left as a hard-coded production URL because
 * this redirect only makes sense on the app subdomain in the first place.
 * In local development there is no marketing site to bounce to, so guests
 * are sent to /login instead — otherwise `/` would kick the dev off to the
 * live production site.
 */
const MARKETING_URL = "https://kindredcare.ca";

function isLocalHost() {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export default function RootRedirect() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
      return;
    }

    if (isLocalHost()) {
      router.replace("/login");
      return;
    }

    // window.location instead of router so the browser actually navigates
    // across domains — next/router can't push to an external origin.
    window.location.replace(MARKETING_URL);
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
