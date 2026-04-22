"use client";

import { useState } from "react";
import {
  Users,
  ShieldCheck,
  CalendarDays,
  AlertOctagon,
  BarChart3,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, type NavItem } from "./sidebar";
import { AppHeader } from "./app-header";

const adminNav: NavItem[] = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck, badge: 8 },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/disputes", label: "Disputes", icon: AlertOctagon, badge: 2 },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/alerts", label: "System Alerts", icon: Bell, badge: 3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userName="Admin" userInitials="A" notificationCount={13} />
      <div className="flex flex-1">
        {/* Collapsible sidebar */}
        <div className="relative hidden md:block">
          <Sidebar items={adminNav} collapsed={collapsed} />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-4 z-10 rounded-full border border-border bg-background shadow-sm"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="size-3" /> : <PanelLeftClose className="size-3" />}
          </Button>
        </div>

        {/* Content — full width, no max-width cap for admin dashboards */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
