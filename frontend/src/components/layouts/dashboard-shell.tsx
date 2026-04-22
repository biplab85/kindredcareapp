"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DashboardSidebar, type DashboardNavBadges } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * DashboardShell — the unified signed-in chrome. Sidebar on the
 * left (collapsible on desktop, drawer on mobile) + sticky top
 * bar with the user dropdown. Every signed-in page renders its
 * content as children inside this shell.
 * ───────────────────────────────────────────────────────────── */

const COLLAPSED_STORAGE_KEY = "kindredcare-sidebar-collapsed";

/**
 * Subscribe to `storage` events so other tabs toggling the sidebar stay in
 * sync. Keeps all localStorage access inside the external-store contract
 * so React 19's setState-in-effect rule isn't violated.
 */
function subscribeToCollapsed(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === COLLAPSED_STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getCollapsedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// Server always hydrates with "expanded" so the initial paint matches between
// SSR and client; the stored value is applied after mount.
function getServerCollapsedSnapshot(): boolean {
  return false;
}

interface DashboardShellProps {
  children: React.ReactNode;
  /** Optional small title / breadcrumb node shown in the top bar's left slot. */
  pageTitle?: React.ReactNode;
  /** Pending-action counts to drive the sidebar nav badge dots. */
  navBadges?: DashboardNavBadges;
  /** Notification count for the bell badge. */
  notificationCount?: number;
}

export function DashboardShell({
  children,
  pageTitle,
  navBadges,
  notificationCount,
}: DashboardShellProps) {
  const collapsed = useSyncExternalStore(
    subscribeToCollapsed,
    getCollapsedSnapshot,
    getServerCollapsedSnapshot,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Writing the collapse state is a straightforward event handler — no
  // setState needed because useSyncExternalStore re-reads after the write.
  const toggleCollapsed = () => {
    if (typeof window === "undefined") return;
    try {
      const next = !collapsed;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      // Storage events don't fire in the same tab, so dispatch a manual one.
      window.dispatchEvent(new StorageEvent("storage", { key: COLLAPSED_STORAGE_KEY }));
    } catch {
      // Ignore
    }
  };

  // Close drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Prevent scroll on body when drawer is open.
  useEffect(() => {
    if (drawerOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
    return undefined;
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <div className="sticky top-0 h-screen">
          <DashboardSidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            badges={navBadges}
          />
        </div>
      </div>

      {/* Mobile drawer + backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-foreground/40 backdrop-blur-[2px] transition-opacity duration-200",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setDrawerOpen(false)}
        />
        {/* Panel */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <DashboardSidebar
            collapsed={false}
            onToggleCollapsed={() => {}}
            onDrawerClose={() => setDrawerOpen(false)}
            badges={navBadges}
            isMobileDrawer
          />
        </div>
      </div>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          pageTitle={pageTitle}
          onOpenDrawer={() => setDrawerOpen(true)}
          notificationCount={notificationCount}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
