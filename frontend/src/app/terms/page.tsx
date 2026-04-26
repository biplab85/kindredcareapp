import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · KindredCare",
};

const LAST_UPDATED = "April 26, 2026";
const POLICY_VERSION = "v0.1-mvp";

/**
 * Phase 15.D — terms of service scaffolding. Covers the marketplace
 * model, payment + commission structure, eligibility, prohibited
 * conduct, and dispute / liability boundaries.
 *
 * Lawyer review required before public launch.
 */
export default function TermsOfServicePage() {
  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.3] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
        <header>
          <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Legal
            <span className="text-foreground/30">— § 02</span>
          </div>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            <span className="font-normal italic text-primary">Terms</span> of service.
          </h1>
          <p className="mt-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
            Last updated · {LAST_UPDATED} · {POLICY_VERSION}
          </p>
        </header>

        <article className="mt-12 space-y-10 text-[15px] leading-relaxed text-foreground/85">
          <Section title="What KindredCare is" no="01">
            <p>
              KindredCare is a Canadian marketplace that connects families seeking non-medical care
              for older adults with vetted, independent caregivers. We are a platform, not a care
              provider — caregivers are independent contractors who set their own rates and accept
              their own bookings.
            </p>
          </Section>

          <Section title="Eligibility" no="02">
            <ul>
              <li>You must be at least 18 years old</li>
              <li>You must be a resident of Canada</li>
              <li>
                Caregivers must complete identity verification (Veriff) and pass a CPIC + AML
                screening
              </li>
              <li>One account per person — sharing is not permitted</li>
              <li>
                We may decline or revoke access at our discretion if you violate these terms or pose
                a safety risk
              </li>
            </ul>
          </Section>

          <Section title="Bookings and visits" no="03">
            <p>
              Family members post gigs. Our matching engine surfaces eligible caregivers. The family
              chooses one and sends an offer. If accepted, the booking is confirmed; if declined or
              expired, the next-best caregiver is offered automatically. Both parties confirm a
              pre-visit safety checklist before the caregiver checks in. GPS check-in/check-out
              timestamps the visit. Tasks completed are logged in-app.
            </p>
            <p>
              KindredCare is non-medical only. Caregivers do not administer medication, perform
              clinical tasks, or provide skilled nursing.
            </p>
          </Section>

          <Section title="Payments and commission" no="04">
            <ul>
              <li>
                Caregivers set their hourly rate at signup. Families see the rate before booking.
              </li>
              <li>
                KindredCare retains a 7.5% platform fee on every completed visit, deducted from the
                caregiver&apos;s gross.
              </li>
              <li>
                Payment is captured at check-out via Stripe. Caregiver payouts are released 24 hours
                later (held longer if a dispute is filed).
              </li>
              <li>
                Refunds and disputes are handled by KindredCare safety staff using GPS, task logs,
                and message threads as evidence. Resolutions can include full refund, partial
                refund, or release-to-caregiver.
              </li>
              <li>
                Annual T4A statements are issued to caregivers earning over $500 in a calendar year.
              </li>
            </ul>
          </Section>

          <Section title="Cancellations" no="05">
            <ul>
              <li>
                Family cancellations more than 24 hours before the visit are free. Cancellations
                within 24 hours retain the platform fee as a no-show charge.
              </li>
              <li>
                Caregiver cancellations within 12 hours of a confirmed visit may affect their Trust
                Score.
              </li>
              <li>
                Either party can cancel a confirmed visit on safety grounds at any time without
                penalty.
              </li>
            </ul>
          </Section>

          <Section title="Prohibited conduct" no="06">
            <p>
              The following are grounds for immediate suspension and may be reported to law
              enforcement:
            </p>
            <ul>
              <li>
                Off-platform contact attempts to circumvent KindredCare&apos;s commission, safety
                checks, or messaging redaction
              </li>
              <li>Misrepresenting your identity, qualifications, or background</li>
              <li>Discrimination on protected grounds</li>
              <li>Harassment, abuse, theft, or property damage</li>
              <li>Substance use during a visit</li>
              <li>Performing medical or clinical tasks outside the non-medical scope</li>
              <li>Automated scraping, scripting, or load-testing the platform</li>
            </ul>
          </Section>

          <Section title="Safety incidents" no="07">
            <p>
              Caregivers have access to a panic button during active visits that alerts our safety
              team with current GPS coordinates. Either party can file an incident report from any
              booking. Critical incidents are routed to on-call staff for immediate triage.
            </p>
            <p>
              In emergencies, call 911 first. Use the in-app panic button to log the alert with our
              safety team in parallel.
            </p>
          </Section>

          <Section title="Liability" no="08">
            <p>
              KindredCare facilitates introductions and payments but does not employ caregivers or
              provide care directly. Caregivers are independent contractors. We disclaim liability
              for the conduct of any user; however, our verification, background-check, and dispute
              resolution processes exist to minimize risk.
            </p>
            <p>
              Our maximum aggregate liability for any single incident is limited to the total
              platform fees you have paid in the preceding 12 months, except where Canadian consumer
              protection law sets a higher floor.
            </p>
          </Section>

          <Section title="Termination" no="09">
            <p>
              You may close your account at any time from Settings. Personal data is anonymized
              within 30 days; financial records are retained for 7 years per CRA. We may terminate
              or suspend accounts for violations of these terms.
            </p>
          </Section>

          <Section title="Governing law" no="10">
            <p>
              These terms are governed by the laws of the Province of Ontario and the federal laws
              of Canada applicable therein. Disputes are subject to the exclusive jurisdiction of
              the courts of Ontario, except where consumer protection law provides otherwise.
            </p>
          </Section>

          <Section title="Changes" no="11">
            <p>
              When we materially change these terms we&apos;ll notify active users and request
              renewed consent. Continued use of the platform after notice constitutes acceptance.
            </p>
          </Section>
        </article>

        <footer className="mt-16 border-t border-dashed border-border/60 pt-6 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          <p>
            See also:{" "}
            <Link
              href="/privacy"
              className="text-primary normal-case tracking-[0.05em] underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  no,
  children,
}: {
  title: string;
  no: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase tabular-nums">
          § {no}
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 [&_a]:text-primary [&_a]:underline-offset-2 [&_li]:my-1 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}
