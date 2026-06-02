import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";

const footerLinks = {
  platform: [
    { href: "/#how-it-works", label: "How it Works" },
    { href: "/#services", label: "Services" },
    { href: "/#for-caregivers", label: "For Caregivers" },
    { href: "/signup", label: "Sign Up" },
  ],
  legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Image
              src="/logo.png"
              alt="KindredCare Global"
              width={160}
              height={36}
              className="mb-4"
            />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Connecting Canadian seniors with verified caregivers for companionship, errands, and
              everyday help.
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Heart className="size-3 text-accent" />
              Serving families across Canada — Proudly Canadian
            </p>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Platform</h4>
            <ul className="space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} KindredCare Global. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
