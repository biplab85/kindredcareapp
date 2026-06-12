import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Heart, ShieldCheck } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Optional status badge rendered above the title (e.g. on verify-email). */
  icon?: React.ReactNode;
}

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Background-checked, vetted caregivers" },
  { icon: BadgeCheck, label: "Identity-verified & insured" },
  { icon: Heart, label: "Compassionate, non-medical care" },
];

/**
 * Premium two-column auth shell — a clean form column beside a branded
 * Trust-Blue panel (hidden on mobile). Shared across login, signup, and
 * forgot-password so the three surfaces feel like one cohesive product.
 */
export function AuthLayout({ children, title, subtitle, icon }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.05fr]">
      {/* ─── Form column ─── */}
      <div className="flex flex-col px-6 py-7 sm:px-10">
        {/* Logo here only on mobile — on desktop it lives top-right of the brand panel. */}
        <header className="flex items-center justify-center lg:hidden">
          <Link href="/" className="inline-flex shrink-0 items-center">
            <Image src="/logo.png" alt="KindredCare Global" width={164} height={36} priority />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-7">
              {icon && <div className="mb-5">{icon}</div>}
              <h1 className="text-[1.7rem] leading-tight font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>

      {/* ─── Brand panel ─── */}
      <div
        className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col"
        style={{
          backgroundImage:
            "linear-gradient(135deg, oklch(0.58 0.13 235) 0%, oklch(0.50 0.14 249) 45%, oklch(0.39 0.13 264) 100%)",
        }}
      >
        {/* Atmosphere — gradient wash, decorative SVG, glows + dot grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* soft glows */}
          <div className="absolute -top-28 -right-20 size-[30rem] rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-40 -left-24 size-[34rem] rounded-full bg-accent/25 blur-3xl" />

          {/* dot-grid texture */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "26px 26px",
            }}
          />

          {/* decorative SVG — concentric rings, flowing waves & scattered dots */}
          <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 600 820"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
          >
            <g stroke="white" strokeOpacity="0.1">
              <circle cx="560" cy="80" r="70" />
              <circle cx="560" cy="80" r="138" />
              <circle cx="560" cy="80" r="208" />
              <circle cx="560" cy="80" r="284" />
            </g>
            <path
              d="M0 612 C 150 560, 300 690, 600 586 L600 820 L0 820 Z"
              fill="white"
              fillOpacity="0.04"
            />
            <path
              d="M0 690 C 190 650, 370 754, 600 662 L600 820 L0 820 Z"
              fill="white"
              fillOpacity="0.05"
            />
            <circle cx="78" cy="250" r="5" fill="white" fillOpacity="0.35" />
            <circle cx="120" cy="198" r="3" fill="white" fillOpacity="0.25" />
            <circle cx="486" cy="430" r="4" fill="white" fillOpacity="0.3" />
          </svg>

          {/* gentle vignette for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/[0.04]" />
        </div>

        <div className="relative flex flex-col items-start gap-5 px-12 pt-12">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo.png"
              alt="KindredCare Global"
              width={158}
              height={35}
              className="brightness-0 invert"
            />
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white ring-1 ring-white/25 backdrop-blur">
            <Heart className="size-3.5" strokeWidth={2.5} />
            Trusted senior care
          </span>
        </div>

        <div className="relative flex flex-1 flex-col justify-center px-12 pb-14">
          <h2 className="max-w-md text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-white">
            Care for the people who cared for you.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
            KindredCare connects families across Durham Region with background-checked, compassionate
            caregivers — companionship, errands, gentle walks, and more.
          </p>

          <ul className="mt-9 space-y-3.5">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm font-medium text-white/90">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/12 ring-1 ring-white/25">
                  <Icon className="size-4" strokeWidth={2.25} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
