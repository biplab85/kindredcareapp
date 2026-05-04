import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · KindredCare",
};

const LAST_UPDATED = "April 26, 2026";
const POLICY_VERSION = "v0.1-mvp";

/**
 * Phase 15.D — privacy policy scaffolding. Content is structured around
 * PIPEDA's ten fair-information principles + the specific data flows in
 * this product (identity verification via Veriff, background checks via
 * Certn, payments via Stripe, GPS check-in/out during visits).
 *
 * IMPORTANT: This is a working placeholder. Before public launch, the
 * full text needs lawyer review for jurisdictional accuracy (PIPEDA,
 * Ontario PHIPA, Quebec Law 25 if expanding east, BC PIPA west).
 */
export default function PrivacyPolicyPage() {
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

      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <header>
          <div className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
            <span className="h-px w-8 bg-foreground/30" />
            Legal
            <span className="text-foreground/30">— § 01</span>
          </div>
          <h1 className="text-2xl font-semibold leading-[1.15] tracking-tight sm:text-3xl">
            <span className="font-normal italic text-primary">Privacy</span> policy.
          </h1>
          <p className="mt-4 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase tabular-nums">
            Last updated · {LAST_UPDATED} · {POLICY_VERSION}
          </p>
        </header>

        <article className="mt-12 space-y-10 text-[15px] leading-relaxed text-foreground/85">
          <Section title="What we collect" no="01">
            <p>To match families with caregivers and run safe visits, we collect:</p>
            <ul>
              <li>
                <strong>Identity:</strong> name, email, phone, date of birth, photo, and
                government-issued ID (caregivers only — verified via Veriff and never stored on our
                servers)
              </li>
              <li>
                <strong>Background-check results:</strong> CPIC clearance status from Certn
                (pass/fail only, not the underlying records)
              </li>
              <li>
                <strong>Care recipient details:</strong> name, age, accessibility notes, language
                and interest preferences (encrypted at rest)
              </li>
              <li>
                <strong>Visit telemetry:</strong> GPS check-in/check-out coordinates, timestamps,
                and completed-task lists
              </li>
              <li>
                <strong>Payment data:</strong> Stripe-tokenized card references — we never see or
                store raw card numbers
              </li>
              <li>
                <strong>Communication:</strong> messages sent through booking threads (redacted for
                personal info before storage, encrypted at rest)
              </li>
            </ul>
          </Section>

          <Section title="Why we collect it" no="02">
            <p>
              Each category serves a specific operational or safety purpose. Identity + background
              checks meet our duty-of-care to the seniors served. GPS confirms visits actually
              happen at the agreed location. Payment data enables hourly billing and 7.5% commission
              accounting. Messages stay in-platform so safety staff can investigate disputes.
            </p>
            <p>
              We do not use any of this data for advertising profiling or sell it to third parties.
            </p>
          </Section>

          <Section title="Who we share it with" no="03">
            <ul>
              <li>
                <strong>Stripe (payments):</strong> tokenized card data + Connect transfer metadata
              </li>
              <li>
                <strong>Veriff (identity):</strong> ID photo + selfie at the time of verification —
                results-only retained on our side
              </li>
              <li>
                <strong>Certn (background checks):</strong> name + DOB + consent — pass/fail
                returned
              </li>
              <li>
                <strong>Twilio (SMS):</strong> phone number + verification codes
              </li>
              <li>
                <strong>Email service provider:</strong> name + email for transactional
                notifications
              </li>
            </ul>
            <p>Data is shared only as necessary to deliver these services.</p>
          </Section>

          <Section title="How long we keep it" no="04">
            <ul>
              <li>
                <strong>Active accounts:</strong> as long as the account exists
              </li>
              <li>
                <strong>Booking + payment records:</strong> 7 years per CRA tax retention
                requirements
              </li>
              <li>
                <strong>Verification results:</strong> retained for 7 years to demonstrate due
                diligence
              </li>
              <li>
                <strong>GPS visit logs:</strong> 2 years
              </li>
              <li>
                <strong>Messages:</strong> 2 years
              </li>
              <li>
                <strong>Marketing preferences:</strong> until revoked
              </li>
            </ul>
          </Section>

          <Section title="Your rights under PIPEDA" no="05">
            <p>You can:</p>
            <ul>
              <li>
                Request a complete copy of your data (Settings → Export my data, available within 30
                days)
              </li>
              <li>
                Request deletion of your account (personal data is anonymized within 30 days;
                financial records stay for 7 years per CRA)
              </li>
              <li>Update or correct any data we hold</li>
              <li>Revoke consent for marketing or non-essential data uses</li>
              <li>
                Lodge a complaint with the{" "}
                <a
                  href="https://www.priv.gc.ca/en/report-a-concern/file-a-formal-privacy-complaint/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Office of the Privacy Commissioner of Canada
                </a>{" "}
                if we fail to address concerns
              </li>
            </ul>
          </Section>

          <Section title="Security measures" no="06">
            <p>
              Sensitive fields (date of birth, accessibility notes, message bodies) are encrypted at
              rest with AES-256. Sessions use Laravel Sanctum tokens. All API endpoints are
              rate-limited. Content Security Policy headers contain script execution to vetted
              origins. Personal info in messages (phone numbers, addresses, off-platform contact
              attempts) is automatically redacted before storage.
            </p>
          </Section>

          <Section title="Breach notification" no="07">
            <p>
              In the unlikely event of a data breach affecting your information, we will notify you
              and the Office of the Privacy Commissioner of Canada within 72 hours of confirming the
              breach, as required under PIPEDA&apos;s mandatory breach reporting provisions.
            </p>
          </Section>

          <Section title="Contact" no="08">
            <p>
              Questions or requests about this policy or your data go to our Privacy Officer at{" "}
              <a
                href="mailto:privacy@kindredcare.ca"
                className="text-primary underline-offset-2 hover:underline"
              >
                privacy@kindredcare.ca
              </a>
              . Verified responses arrive within 30 days.
            </p>
          </Section>

          <Section title="Changes" no="09">
            <p>
              When we materially change this policy, we&apos;ll notify active users and request
              renewed consent. The version stamp at the top tracks which iteration is current. The
              full version history is available on request.
            </p>
          </Section>
        </article>

        <footer className="mt-16 border-t border-dashed border-border/60 pt-6 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          <p>
            See also:{" "}
            <Link
              href="/terms"
              className="text-primary normal-case tracking-[0.05em] underline-offset-2 hover:underline"
            >
              Terms of Service
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
