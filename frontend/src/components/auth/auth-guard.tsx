"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: ("family" | "caregiver" | "admin")[];
}

export function AuthGuard({ children, roles }: AuthGuardProps) {
  const router = useRouter();
  const { user, token, isLoading, fetchUser } = useAuthStore();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!user && !isLoading && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchUser();
    }
  }, [token, user, isLoading, fetchUser, router]);

  if (!token || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    router.replace("/dashboard");
    return null;
  }

  return <>{children}</>;
}
