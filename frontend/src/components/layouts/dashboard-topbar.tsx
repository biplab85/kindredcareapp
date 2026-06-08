"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Menu, Settings, type LucideIcon, User, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * DashboardTopbar — 64px bar sitting to the right of the sidebar.
 * Left: hamburger (mobile only) + page title slot.
 * Right: notification bell (placeholder) and the user dropdown
 * (avatar + first name + role menu).
 * ───────────────────────────────────────────────────────────── */

interface DashboardTopbarProps {
  /** Content for the left slot — typically a short page title string or a breadcrumb node. */
  pageTitle?: React.ReactNode;
  /** Opens the mobile drawer. Hidden on md+. */
  onOpenDrawer: () => void;
  /** Optional count for the notification bell badge. */
  notificationCount?: number;
}

export function DashboardTopbar({
  pageTitle,
  onOpenDrawer,
  notificationCount: notificationCountProp = 0,
}: DashboardTopbarProps) {
  const { user, logout } = useAuthStore();
  const [unread, setUnread] = useState<number>(notificationCountProp);

  // Self-fetching unread count. Poll every 60s; pause when tab hidden so
  // we don't burn cycles in the background. The prop is the initial value
  // so the badge isn't blank during the first roundtrip.
  useEffect(() => {
    let alive = true;

    const fetchOnce = async () => {
      try {
        const resp = await listNotifications();
        if (!alive) return;
        setUnread(resp.meta.unread);
      } catch {
        // Silent — bell badge is non-critical, page-load shouldn't fail.
      }
    };

    void fetchOnce();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchOnce();
    }, 60_000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const notificationCount = unread;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const initials = initialsOf(user?.name);
  const firstName = user?.name?.split(" ")[0] ?? "Account";
  // Caregivers carry a profile photo; surface it in the top-right avatar
  // so the user sees their own face instead of just initials.
  const photoUrl =
    user?.role === "caregiver" ? resolvePhotoUrl(user.caregiver_profile?.photo_path) : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl sm:px-6",
      )}
    >
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </Button>

      {/* Page title slot */}
      <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
        {pageTitle}
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          {notificationCount > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 grid size-4 min-w-[1rem] place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-foreground"
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="ml-1 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card py-1 pr-3 pl-1 text-sm transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                aria-label="Account menu"
              >
                {photoUrl ? (
                  <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-foreground/10">
                    <Image
                      src={photoUrl}
                      alt={user?.name ?? "You"}
                      fill
                      sizes="28px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold tracking-[0.08em] text-primary">
                    {initials}
                  </span>
                )}
                <span className="hidden max-w-[120px] truncate font-medium lg:inline">
                  {firstName}
                </span>
              </button>
            }
          />
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-semibold">{user?.name}</span>
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                {user?.role}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <UserCircle className="size-4" strokeWidth={1.75} />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" strokeWidth={1.75} />
              Settings
            </DropdownMenuItem>
            {user?.role === "caregiver" && (
              <DropdownMenuItem render={<Link href="/verification" />}>
                <User className="size-4" strokeWidth={1.75} />
                Verification
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" strokeWidth={1.75} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function initialsOf(name: string | undefined): string {
  if (!name) return "·";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

// Keep the unused-import warning happy if LucideIcon is referenced elsewhere in future.
export type { LucideIcon };

/**
 * Photo paths come back as either a fully-qualified URL (seeded pravatar
 * placeholders) or a relative public-disk path (uploaded files). Resolve
 * the relative case through NEXT_PUBLIC_API_URL so the topbar renders
 * the same asset everyone else sees.
 */
function resolvePhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}/storage/${path.replace(/^\/+/, "")}`;
}
