"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  type LucideIcon,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ScrollText,
  Search,
  ShieldAlert,
  UserCircle,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ─────────────────────────────────────────────────────────────
 * DashboardSidebar — the left rail used across every signed-in
 * page. Light neutral surface per the existing --sidebar tokens.
 * Collapsible on desktop (icon-only 68px), full drawer on mobile.
 * ───────────────────────────────────────────────────────────── */

export interface DashboardNavBadges {
  bookings?: number;
  verification?: number;
}

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key that matches DashboardNavBadges — used for the pending-action dot. */
  badge?: keyof DashboardNavBadges;
}

interface SidebarSection {
  heading: string;
  items: SidebarItem[];
}

const CAREGIVER_SECTIONS: SidebarSection[] = [
  {
    heading: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/me/gigs", label: "My gigs", icon: PlusCircle },
      { href: "/bookings", label: "Bookings", icon: CalendarDays, badge: "bookings" },
      { href: "/caregiver/schedule", label: "Schedule", icon: CalendarDays },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/profile", label: "Profile", icon: UserCircle },
      { href: "/verification", label: "Verification", icon: BadgeCheck, badge: "verification" },
    ],
  },
];

const FAMILY_SECTIONS: SidebarSection[] = [
  {
    heading: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/marketplace", label: "Marketplace", icon: Search },
      { href: "/bookings", label: "Bookings", icon: CalendarDays, badge: "bookings" },
      { href: "/care-recipients", label: "Recipients", icon: UsersRound },
    ],
  },
  {
    heading: "Account",
    items: [{ href: "/profile", label: "Profile", icon: UserCircle }],
  },
];

const ADMIN_SECTIONS: SidebarSection[] = [
  {
    heading: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: UsersRound },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/admin/verifications", label: "Verifications", icon: BadgeCheck },
      { href: "/admin/certifications", label: "Certifications", icon: ClipboardCheck },
      { href: "/admin/safety", label: "Safety", icon: ShieldAlert },
      { href: "/admin/alerts", label: "Alerts", icon: Bell },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
      { href: "/admin/admins", label: "Admins", icon: UserCog },
    ],
  },
  // Admin Settings lives in the top-right dropdown — same convention as
  // the caregiver/family roles after this cleanup.
];

function sectionsFor(role: "family" | "caregiver" | "admin" | undefined): SidebarSection[] {
  if (role === "caregiver") return CAREGIVER_SECTIONS;
  if (role === "family") return FAMILY_SECTIONS;
  if (role === "admin") return ADMIN_SECTIONS;
  return [];
}

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** On mobile, used to close the drawer after tapping a link or the X icon. */
  onDrawerClose?: () => void;
  /** Pending-action counts for the nav badge dots. */
  badges?: DashboardNavBadges;
  /** True when rendered inside the mobile drawer; hides the desktop collapse toggle and shows a close X instead. */
  isMobileDrawer?: boolean;
}

export function DashboardSidebar({
  collapsed,
  onToggleCollapsed,
  onDrawerClose,
  badges,
  isMobileDrawer = false,
}: DashboardSidebarProps) {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const sections = sectionsFor(user?.role);

  const initials = initialsOf(user?.name);
  const accountName = user?.name?.split(" ")[0] ?? "Account";

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  // Pick the single most-specific nav item for the current path so nested
  // routes (e.g. /gigs/new) don't also light up their parent (/gigs).
  const activeHref = sections
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  // Mobile drawer always shows full-width content; only the desktop sidebar respects `collapsed`.
  const labelsVisible = isMobileDrawer || !collapsed;

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isMobileDrawer ? "w-[260px]" : collapsed ? "w-[68px]" : "w-[248px]",
      )}
      aria-label="Primary navigation"
    >
      {/* Logo + collapse toggle — height matches top bar for a seamless seam */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-3",
          labelsVisible ? "justify-between" : "justify-center",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onDrawerClose}
          className="flex items-center gap-2"
          aria-label="KindredCare home"
        >
          {labelsVisible ? (
            <Image
              src="/logo.png"
              alt="KindredCare Global"
              width={180}
              height={40}
              priority
              className="h-9 w-auto"
            />
          ) : (
            <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary/10 font-mono text-sm font-semibold tracking-[0.08em] text-sidebar-primary">
              KC
            </span>
          )}
        </Link>
        {isMobileDrawer ? (
          <button
            type="button"
            onClick={onDrawerClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Close navigation"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "hidden size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:grid",
              !labelsVisible && "ml-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" strokeWidth={1.75} />
            ) : (
              <ChevronsLeft className="size-4" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      {/* Scrollable nav area */}
      <nav
        className={cn("flex-1 overflow-y-auto", labelsVisible ? "px-3 py-4" : "px-2 py-4")}
        aria-label="Main navigation"
      >
        <ul className="space-y-6">
          {sections.map((section) => (
            <li key={section.heading}>
              {labelsVisible && (
                <p className="mb-2 px-2 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {section.heading}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  const badgeCount = item.badge ? (badges?.[item.badge] ?? 0) : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onDrawerClose}
                        aria-current={active ? "page" : undefined}
                        title={labelsVisible ? undefined : item.label}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl text-[13px] font-medium transition-colors",
                          labelsVisible ? "px-3 py-2" : "justify-center px-0 py-2.5",
                          active
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                          />
                        )}
                        <span className="relative shrink-0">
                          <Icon
                            className={cn("size-[18px]", active ? "text-sidebar-primary" : "")}
                            strokeWidth={1.75}
                          />
                          {badgeCount > 0 && !labelsVisible && (
                            <span
                              aria-hidden
                              className="absolute -top-0.5 -right-1 size-2 rounded-full bg-accent ring-2 ring-sidebar"
                            />
                          )}
                        </span>
                        {labelsVisible && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {badgeCount > 0 && (
                              <span
                                aria-label={`${badgeCount} pending`}
                                className="inline-flex size-[7px] shrink-0 rounded-full bg-accent"
                              />
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Account — pinned to the sidebar bottom, same menu as the topbar */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                title={labelsVisible ? undefined : (user?.name ?? "Account")}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl text-sm transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-primary/40 focus-visible:outline-none",
                  labelsVisible ? "px-2 py-2" : "justify-center px-0 py-2",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary/10 font-mono text-[11px] font-semibold tracking-[0.08em] text-sidebar-primary">
                  {initials}
                </span>
                {labelsVisible && (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                      <span className="truncate text-[13px] font-medium text-sidebar-foreground">
                        {accountName}
                      </span>
                      <span className="truncate font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                        {user?.role}
                      </span>
                    </span>
                    <ChevronsUpDown
                      className="size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                  </>
                )}
              </button>
            }
          />
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-semibold">{user?.name}</span>
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                {user?.role}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />} onClick={onDrawerClose}>
              <Settings className="size-4" strokeWidth={1.75} />
              Settings
            </DropdownMenuItem>
            {user?.role === "caregiver" && (
              <DropdownMenuItem render={<Link href="/verification" />} onClick={onDrawerClose}>
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
    </aside>
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
