"use client";

import type { LucideIcon } from "lucide-react";
import { Calendar, MapPin, Clock, User, Tag, DollarSign, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceCategory } from "@/lib/service-categories";

/**
 * Right-rail preview styled as a community-bulletin clipping.
 * Every field read here is a string — the parent passes pre-formatted copy so the
 * preview can stay purely presentational and handle empty states uniformly.
 */
export interface GigPreviewData {
  categoryName: string;
  categoryIcon: LucideIcon;
  description: string;
  neighbourhoodName: string;
  address: string;
  scheduleLine: string;
  scheduleDetail: string;
  recurringNote: string | null;
  preferencesLines: string[];
  budgetLine: string;
  photoPreview: string | null;
}

export function GigPreview({ data }: { data: GigPreviewData }) {
  const Icon = data.categoryIcon;

  return (
    <aside aria-label="Live preview" className="relative lg:sticky lg:top-24">
      {/* Tape corners — pure decorative */}
      <span
        aria-hidden
        className="absolute -top-3 left-8 z-10 h-6 w-16 rotate-[-6deg] bg-accent/30 ring-1 ring-accent/50 shadow-sm"
      />
      <span
        aria-hidden
        className="absolute -top-3 right-10 z-10 h-6 w-12 rotate-[4deg] bg-primary/25 ring-1 ring-primary/40 shadow-sm"
      />

      <div
        className={cn(
          "relative rounded-md bg-[oklch(0.985_0.008_85)] ring-1 ring-foreground/15",
          "shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]",
          "pt-8 pb-9 px-7 sm:px-9",
        )}
      >
        {/* Grain overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md opacity-50 mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.18  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* Masthead */}
        <div className="relative border-b-2 border-foreground pb-4">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-foreground/60 uppercase">
            <Heart className="size-3 text-accent" strokeWidth={2.5} />A KindredCare Notice
          </p>
          <p className="mt-1 flex items-baseline justify-between font-mono text-[9px] tracking-[0.22em] text-foreground/45 uppercase">
            <span>Durham Region &nbsp;·&nbsp; No. {new Date().getFullYear()}</span>
            <span>Posted Today</span>
          </p>
        </div>

        {/* Category banner */}
        <div className="relative mt-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30">
            <Icon className="size-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 border-b border-dashed border-foreground/25 pb-1">
            <p className="font-mono text-[10px] tracking-[0.2em] text-foreground/45 uppercase">
              Seeking
            </p>
            <p className="font-heading text-xl leading-tight font-semibold">{data.categoryName}</p>
          </div>
        </div>

        {/* Description pull-quote */}
        <div className="relative mt-6">
          <p className="font-mono text-[10px] tracking-[0.22em] text-foreground/45 uppercase">
            What we&rsquo;re after
          </p>
          <blockquote
            className={cn(
              "mt-2 border-l-2 border-accent/60 pl-4 text-[0.95rem] leading-relaxed italic",
              data.description ? "text-foreground" : "text-foreground/30",
            )}
          >
            &ldquo;{data.description || "Tell us a little about what would help the most…"}&rdquo;
          </blockquote>
        </div>

        {/* Photo thumbnail if present */}
        {data.photoPreview && (
          <div className="relative mt-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-foreground/45 uppercase">
              Attached
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.photoPreview}
              alt="Attached reference"
              className="mt-2 h-32 w-full rounded-sm object-cover ring-1 ring-foreground/15"
            />
          </div>
        )}

        {/* Classified-style details */}
        <dl className="relative mt-7 grid gap-4 border-t border-dashed border-foreground/25 pt-5">
          <PreviewRow
            icon={MapPin}
            label="Where"
            value={data.neighbourhoodName ? data.neighbourhoodName : "—"}
            detail={data.address || undefined}
            filled={Boolean(data.neighbourhoodName)}
          />
          <PreviewRow
            icon={Calendar}
            label="When"
            value={data.scheduleLine || "—"}
            detail={data.scheduleDetail || undefined}
            filled={Boolean(data.scheduleLine)}
          />
          {data.recurringNote && (
            <PreviewRow icon={Clock} label="Repeats" value={data.recurringNote} filled />
          )}
          {data.preferencesLines.length > 0 && (
            <PreviewRow
              icon={User}
              label="Ideal person"
              value={data.preferencesLines.join(" · ")}
              filled
            />
          )}
          <PreviewRow
            icon={DollarSign}
            label="Pay"
            value={data.budgetLine || "Accepts caregiver rate"}
            filled
          />
        </dl>

        {/* Sign-off */}
        <div className="relative mt-7 border-t-2 border-foreground/85 pt-4 text-center">
          <p className="font-mono text-[9px] tracking-[0.3em] text-foreground/55 uppercase">
            A neighbour will reply — verified &amp; vetted.
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 font-mono text-[9px] tracking-[0.22em] text-foreground/40 uppercase">
            <Tag className="size-2.5" />
            KindredCare · 7.5% fee · Durham ON
          </p>
        </div>
      </div>
    </aside>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  value,
  detail,
  filled,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  filled: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-5 items-center justify-center text-foreground/70",
          !filled && "text-foreground/25",
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div>
        <dt className="font-mono text-[10px] tracking-[0.22em] text-foreground/45 uppercase">
          {label}
        </dt>
        <dd
          className={cn("text-sm leading-snug", filled ? "text-foreground" : "text-foreground/30")}
        >
          {value}
        </dd>
        {detail && <p className="mt-0.5 text-xs text-foreground/55 italic">{detail}</p>}
      </div>
    </div>
  );
}

export function neighbourhoodLatLong(
  slug: string,
  all: Array<{ slug: string; latitude: number; longitude: number; name: string }>,
): { latitude: number; longitude: number; name: string } | null {
  const match = all.find((n) => n.slug === slug);
  return match ? { latitude: match.latitude, longitude: match.longitude, name: match.name } : null;
}

// Re-exported so parent can type the category without introducing a new dep
export type { ServiceCategory };
