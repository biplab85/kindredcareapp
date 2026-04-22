"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LargeTextToggle } from "@/components/ui/large-text-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  userName?: string;
  userInitials?: string;
  notificationCount?: number;
}

export function AppHeader({
  userName = "User",
  userInitials = "U",
  notificationCount = 0,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Logo — visible on mobile only (desktop has sidebar) */}
      <Link href="/" className="flex items-center md:hidden">
        <Image src="/logo.png" alt="KindredCare" width={140} height={32} priority />
      </Link>

      {/* Spacer for desktop */}
      <div className="hidden md:block" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <LargeTextToggle />

        {/* Notifications */}
        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[0.6rem] font-bold text-accent-foreground">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Button>
        </Link>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium md:block">{userName}</span>
              </button>
            }
          />
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-48">
            <DropdownMenuLabel>{userName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings/profile" />}>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOut className="size-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
