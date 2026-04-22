"use client";

import { LayoutDashboard, FileText, CalendarDays, MessageSquare, Settings } from "lucide-react";
import { Sidebar, type NavItem } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { AppHeader } from "./app-header";

const familyNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gigs", label: "My Gigs", icon: FileText },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare, badge: 3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface FamilyLayoutProps {
  children: React.ReactNode;
}

export function FamilyLayout({ children }: FamilyLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userName="Jane D." userInitials="JD" notificationCount={2} />
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar items={familyNav} />
        </div>
        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      {/* Mobile bottom nav */}
      <MobileNav items={familyNav} />
    </div>
  );
}
