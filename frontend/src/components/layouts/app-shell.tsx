"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  LayoutDashboard,
  type LucideIcon,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LargeTextToggle } from "@/components/ui/large-text-toggle";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * AppShell — the unified editorial layout for every signed-in
 * page. Paper wash + noise overlay auto-applied; children render
 * inside a max-width container so page code stays lean.
 *
 * Replaces Phase 3 CaregiverLayout / FamilyLayout / AppHeader.
 * ───────────────────────────────────────────────────────────── */

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const CAREGIVER_NAV: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Open gigs", icon: Search },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/caregiver/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/verification", label: "Verification", icon: BadgeCheck },
];

const FAMILY_NAV: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gigs", label: "My gigs", icon: Search },
  { href: "/gigs/new", label: "Post a gig", icon: CalendarDays },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/care-recipients", label: "Recipients", icon: User },
];

const ADMIN_NAV: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/verifications", label: "Verifications", icon: BadgeCheck },
];

function navFor(role: "family" | "caregiver" | "admin" | undefined): NavLink[] {
  if (role === "caregiver") return CAREGIVER_NAV;
  if (role === "family") return FAMILY_NAV;
  if (role === "admin") return ADMIN_NAV;
  return [];
}

function initialsOf(name: string | undefined): string {
  if (!name) return "·";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");
}

interface AppShellProps {
  children: React.ReactNode;
  /** Optional background tint — tweak per page if needed. Defaults to primary. */
  tint?: "primary" | "accent" | "success" | "none";
}

export function AppShell({ children, tint = "primary" }: AppShellProps) {
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const nav = navFor(user?.role);

  const tintClass = {
    primary: "from-primary/[0.04]",
    accent: "from-accent/[0.04]",
    success: "from-success/[0.04]",
    none: "from-transparent",
  }[tint];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Paper wash — uniform across every signed-in page */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b via-background to-background",
          tintClass,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Top nav */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="KindredCare Global"
              width={180}
              height={40}
              priority
              className="h-9 w-auto"
            />
          </Link>

          {/* Desktop nav — editorial tracking, not generic sans */}
          <nav
            className="ml-6 hidden flex-1 items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {nav.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-foreground"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desktop actions */}
          <div className="ml-auto hidden items-center gap-1 md:flex">
            <LargeTextToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="ml-1 flex items-center gap-2 rounded-full border border-border/60 bg-card px-2 py-1.5 pr-3 text-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Account menu"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold tracking-[0.08em] text-primary">
                      {initialsOf(user?.name)}
                    </span>
                    <span className="hidden max-w-[120px] truncate font-medium lg:inline">
                      {user?.name?.split(" ")[0] ?? "Account"}
                    </span>
                  </button>
                }
              />
              <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-52">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-semibold">{user?.name}</span>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    {user?.role}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/settings" />}>
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                {user?.role === "caregiver" && (
                  <DropdownMenuItem render={<Link href="/verification" />}>
                    <BadgeCheck className="size-4" />
                    Verification
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile hamburger */}
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <LargeTextToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "overflow-hidden border-t border-border/40 bg-background transition-all duration-200 ease-in-out md:hidden",
            mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Mobile navigation">
            {nav.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-border/40 pt-2">
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Settings className="size-4" strokeWidth={1.75} />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
                Log out
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
