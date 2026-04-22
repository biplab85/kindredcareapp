"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Search,
  CalendarDays,
  DollarSign,
  MessageSquare,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, type NavItem } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { AppHeader } from "./app-header";

const caregiverNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/available-gigs", label: "Available Gigs", icon: Search, badge: 5 },
  { href: "/bookings", label: "My Bookings", icon: CalendarDays },
  { href: "/earnings", label: "Earnings", icon: DollarSign },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface CaregiverLayoutProps {
  children: React.ReactNode;
  isVerified?: boolean;
}

export function CaregiverLayout({ children, isVerified = true }: CaregiverLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userName="Sarah M." userInitials="SM" notificationCount={5} />

      {/* Verification banner */}
      {!isVerified && (
        <div className="flex items-center justify-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5">
          <AlertTriangle className="size-4 shrink-0 text-warning-foreground" />
          <p className="text-sm font-medium text-warning-foreground">
            Complete your verification to start receiving bookings.
          </p>
          <Link href="/verification">
            <Button size="xs" className="bg-warning text-warning-foreground hover:bg-warning/80">
              Complete Now
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-1">
        <div className="hidden md:block">
          <Sidebar items={caregiverNav} />
        </div>
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <MobileNav items={caregiverNav} />
    </div>
  );
}
