import type { Metadata } from "next";
import Link from "next/link";
import {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  ArrowUpRight,
  ShieldCheck,
  MapPin,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicLayout } from "@/components/layouts/public-layout";
import { fetchServiceCategories, type ServiceCategory } from "@/lib/service-categories";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Every way KindredCare helps seniors in Durham Region — from companionship and errands to gardening, tech help, and transportation.",
};

// Controlled revalidation. The taxonomy rarely changes but we want fresh copy if it does.
export const revalidate = 3600;

const iconMap: Record<string, LucideIcon> = {
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
};

// Intentionally-chosen accent per slug. Keeps warmth distributed across the grid
// instead of a uniform primary-blue wash. Falls back to primary for unknown slugs.
const accentMap: Record<string, "primary" | "accent" | "success"> = {
  companionship: "accent",
  "tech-help": "primary",
  "errands-shopping": "primary",
  "walking-companion": "success",
  gardening: "success",
  "meal-preparation": "accent",
  transportation: "primary",
  "light-housekeeping": "primary",
};

type Accent = "primary" | "accent" | "success";

const accentStyles: Record<
  Accent,
  { halo: string; ink: string; line: string; softBg: string; pill: string }
> = {
  primary: {
    halo: "bg-primary/10",
    ink: "text-primary",
    line: "bg-primary/40",
    softBg: "bg-primary/[0.04]",
    pill: "bg-primary/10 text-primary",
  },
  accent: {
    halo: "bg-accent/12",
    ink: "text-accent",
    line: "bg-accent/50",
    softBg: "bg-accent/[0.05]",
    pill: "bg-accent/12 text-accent",
  },
  success: {
    halo: "bg-success/12",
    ink: "text-success",
    line: "bg-success/40",
    softBg: "bg-success/[0.04]",
    pill: "bg-success/12 text-success",
  },
};

export default async function ServicesPage() {
  let categories: ServiceCategory[] = [];
  let loadError = false;

  try {
    categories = await fetchServiceCategories();
  } catch {
    loadError = true;
  }

  return (
    <PublicLayout>
      <Hero />

      {loadError ? (
        <ErrorState />
      ) : categories.length === 0 ? (
        <LoadingState />
      ) : (
        <CategoryGrid categories={categories} />
      )}

      <TrustStrip />
      <FinalCta />
    </PublicLayout>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sections
 * ───────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      aria-labelledby="services-hero-heading"
      className="relative overflow-hidden border-b border-border/50"
    >
      {/* Paper texture: soft double-gradient + noise via SVG data URI */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:px-8">
        {/* Eyebrow */}
        <div className="mb-8 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          <span className="h-px w-8 bg-foreground/30" />
          The Catalogue of Care
          <span className="h-px w-8 bg-foreground/30" />
        </div>

        {/* Headline */}
        <h1
          id="services-hero-heading"
          className="max-w-4xl text-balance text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[5.25rem]"
        >
          Eight ways
          <br />
          <span className="italic font-normal text-primary">to help,</span> written
          <br />
          in everyday hours.
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          KindredCare isn&rsquo;t an agency. It&rsquo;s a small catalogue of honest help —
          conversation, a walk in the park, a ride to the clinic — offered by verified neighbours
          who set their own rate. Browse the catalogue. Pick what fits the week. Pay only for the
          hours you use.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-foreground/70">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-success" strokeWidth={2.2} />
            Every caregiver background-checked
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" strokeWidth={2.2} />
            Durham Region, Ontario
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" strokeWidth={2.2} />
            Only 7.5% platform fee
          </span>
        </div>
      </div>
    </section>
  );
}

function CategoryGrid({ categories }: { categories: ServiceCategory[] }) {
  return (
    <section
      aria-labelledby="services-grid-heading"
      className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mb-14 flex items-end justify-between gap-8 border-b border-border/60 pb-6">
        <div>
          <p className="mb-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            № 01 &mdash; 0{categories.length}
          </p>
          <h2
            id="services-grid-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            The full list.
          </h2>
        </div>
        <p className="hidden max-w-xs text-right text-sm leading-relaxed text-muted-foreground sm:block">
          Pick one to post a specific gig, or mix and match — caregivers often offer several.
        </p>
      </div>

      {/* Asymmetric grid: featured #1 spans 2 cols on lg; rest flow in a 3-col. */}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => {
          const accent = accentMap[category.slug] ?? "primary";
          const Icon = iconMap[category.icon] ?? Heart;
          const isFeatured = index === 0;

          return (
            <li
              key={category.id}
              className={cn(isFeatured && "sm:col-span-2 lg:col-span-2 lg:row-span-2")}
            >
              <CategoryCard
                category={category}
                icon={Icon}
                index={index}
                accent={accent}
                featured={isFeatured}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CategoryCard({
  category,
  icon: Icon,
  index,
  accent,
  featured,
}: {
  category: ServiceCategory;
  icon: LucideIcon;
  index: number;
  accent: Accent;
  featured: boolean;
}) {
  const styles = accentStyles[accent];
  const numericLabel = `№ ${String(index + 1).padStart(2, "0")}`;
  const href = `/gigs/new?category=${category.slug}`;

  return (
    <Link
      href={href}
      aria-label={`Post a ${category.name.toLowerCase()} gig`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-border/70 transition-all duration-300",
        "hover:-translate-y-0.5 hover:ring-foreground/30 hover:shadow-[0_24px_60px_-28px] hover:shadow-foreground/20",
        "focus-visible:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        featured && "min-h-[28rem] sm:min-h-[32rem] lg:min-h-full",
      )}
    >
      {/* Tinted paper background wash */}
      <div aria-hidden className={cn("absolute inset-0 opacity-80", styles.softBg)} />

      {/* Corner numeric marker */}
      <div className="relative flex items-center justify-between px-6 pt-6">
        <span
          className={cn("font-mono text-[11px] tracking-[0.2em] uppercase", "text-foreground/50")}
        >
          {numericLabel}
        </span>
        <ArrowUpRight
          className="size-5 -translate-x-0.5 translate-y-0.5 text-foreground/30 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-foreground/80"
          strokeWidth={1.8}
        />
      </div>

      {/* Icon + title cluster */}
      <div className={cn("relative flex flex-col px-6 pt-8", featured ? "gap-6" : "gap-5")}>
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl",
            styles.halo,
            featured ? "size-16" : "size-14",
          )}
        >
          <Icon className={cn(styles.ink, featured ? "size-8" : "size-7")} strokeWidth={1.75} />
        </div>

        <div>
          <h3
            className={cn(
              "font-semibold tracking-tight text-foreground",
              featured ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
            )}
          >
            {category.name}
          </h3>
          <p
            className={cn(
              "mt-2 text-muted-foreground",
              featured ? "text-base leading-relaxed sm:text-lg" : "text-sm leading-relaxed",
            )}
          >
            {category.description}
          </p>
        </div>
      </div>

      {/* Example tasks — shown in full on featured, first 3 otherwise */}
      {category.example_tasks.length > 0 && (
        <div className="relative mt-6 px-6">
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-foreground/50 uppercase">
            <span className={cn("h-px w-4", styles.line)} />
            Typical requests
          </p>
          <ul className="space-y-2.5">
            {(featured ? category.example_tasks : category.example_tasks.slice(0, 3)).map(
              (task) => (
                <li
                  key={task}
                  className="flex items-start gap-3 text-sm leading-snug text-foreground/80"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[0.45rem] block size-1.5 shrink-0 rounded-full",
                      styles.ink.replace("text-", "bg-"),
                    )}
                  />
                  <span>{task}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {/* CTA footer */}
      <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-border/50 px-6 py-4 pt-5">
        <span className="text-sm font-medium text-foreground">Post a gig</span>
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full transition-all duration-300",
            styles.pill,
            "group-hover:scale-110",
          )}
        >
          <ArrowUpRight className="size-4" strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}

function TrustStrip() {
  const pillars = [
    {
      title: "Identity verified",
      desc: "Government ID and a live selfie — confirmed before anyone can accept a visit.",
    },
    {
      title: "Background checked",
      desc: "A Canadian criminal record check (CPIC) and AML screening runs on every caregiver.",
    },
    {
      title: "Visit verified",
      desc: "Every shift is GPS-stamped on arrival and departure. Families are notified in real time.",
    },
  ];

  return (
    <section className="relative border-y border-border/60 bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div>
            <p className="mb-3 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
              On trust
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Every visit, <span className="italic font-normal">accounted for.</span>
            </h2>
          </div>

          <dl className="grid gap-6 sm:grid-cols-3">
            {pillars.map((p, i) => (
              <div key={p.title} className="border-t border-foreground/15 pt-5">
                <dt className="mb-2 flex items-baseline gap-3">
                  <span className="font-mono text-xs text-foreground/50">0{i + 1}</span>
                  <span className="text-base font-semibold text-foreground">{p.title}</span>
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{p.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.05] via-transparent to-transparent" />
      <div
        aria-hidden
        className="absolute bottom-[-10rem] left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
        <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Seen one you&rsquo;d like <span className="italic font-normal">some help with?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Tell us what you need, and we&rsquo;ll show you the neighbours best placed to help —
          ranked by skill, nearness, and fit.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link href="/signup?role=family">
            <Button size="lg" className="h-12 px-8 text-base">
              Find a caregiver
            </Button>
          </Link>
          <Link href="/signup?role=caregiver">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base">
              Offer your help
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Non-happy states
 * ───────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <section
      aria-label="Loading services"
      aria-busy="true"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mb-14 flex items-end justify-between border-b border-border/60 pb-6">
        <div>
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="h-9 w-56" />
        </div>
        <Skeleton className="hidden h-10 w-64 sm:block" />
      </div>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className={cn(
              "rounded-2xl bg-card p-6 ring-1 ring-border/60",
              i === 0 && "sm:col-span-2 lg:col-span-2 lg:row-span-2",
            )}
          >
            <Skeleton className={cn(i === 0 ? "size-16" : "size-14", "rounded-2xl")} />
            <Skeleton className="mt-6 h-7 w-40" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <div className="mt-6 space-y-2.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ErrorState() {
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-24 text-center sm:py-32"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <MapPin className="size-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        We couldn&rsquo;t load the catalogue.
      </h2>
      <p className="max-w-md text-muted-foreground">
        Something went wrong fetching the service list. Please refresh the page or try again in a
        moment — it&rsquo;s almost always us, not you.
      </p>
      <Link href="/" className="mt-2">
        <Button variant="outline" size="lg">
          Back to home
        </Button>
      </Link>
    </section>
  );
}
