import Link from "next/link";
import {
  Shield,
  MapPin,
  DollarSign,
  FileText,
  Sparkles,
  CreditCard,
  UserPlus,
  ShieldCheck,
  Briefcase,
  Heart,
  Smartphone,
  ShoppingBag,
  Footprints,
  Flower2,
  ChefHat,
  Car,
  SprayCan,
  FileSearch,
  MapPinCheck,
  Clock,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicLayout } from "@/components/layouts/public-layout";
import { FaqSection } from "@/components/landing/faq-section";

const familySteps = [
  {
    icon: FileText,
    title: "Browse the Marketplace",
    desc: "Verified caregivers list their services with rates, what's included, and a real photo. Filter by what you need.",
  },
  {
    icon: Sparkles,
    title: "Pick a Gig That Fits",
    desc: "Review the rate, the tasks included, and the caregiver's profile — then send a booking request for the date and time you need.",
  },
  {
    icon: CreditCard,
    title: "Pay Only After the Visit",
    desc: "A hold goes on your card when the caregiver accepts. We charge it only at check-out — and pro-rate if the visit runs short.",
  },
];

const caregiverSteps = [
  {
    icon: UserPlus,
    title: "Set Up Your Profile",
    desc: "Tell families who you are, set your weekly availability, and complete ID verification + a criminal record check to earn your Verified badge.",
  },
  {
    icon: ShieldCheck,
    title: "Publish Your Gigs",
    desc: "Each gig is one productized service — a title, a rate, what's included. Families browse them and book the one that fits.",
  },
  {
    icon: Briefcase,
    title: "Accept Bookings, Get Paid",
    desc: "Review every booking offer before you accept. Payouts transfer to your bank 24 hours after each visit ends.",
  },
];

const services = [
  {
    icon: Heart,
    title: "Companionship",
    desc: "Conversation, reading, hobbies, and social outings.",
  },
  {
    icon: Smartphone,
    title: "Tech Help",
    desc: "Tablets, video calls, smart devices, and apps.",
  },
  {
    icon: ShoppingBag,
    title: "Errands & Shopping",
    desc: "Groceries, prescriptions, and everyday errands.",
  },
  {
    icon: Footprints,
    title: "Walking Companion",
    desc: "Walks, light exercise, and fresh air together.",
  },
  {
    icon: Flower2,
    title: "Gardening",
    desc: "Planting, weeding, watering, and yard care.",
  },
  {
    icon: ChefHat,
    title: "Meal Preparation",
    desc: "Nutritious meals tailored to dietary needs.",
  },
  {
    icon: Car,
    title: "Transportation",
    desc: "Appointments, social visits, and errands.",
  },
  {
    icon: SprayCan,
    title: "Light Housekeeping",
    desc: "Tidying, laundry, dishes, and organization.",
  },
];

const trustPillars = [
  {
    icon: ShieldCheck,
    title: "Identity Verified",
    desc: "Government-issued ID with facial matching confirms every caregiver is who they say they are.",
  },
  {
    icon: FileSearch,
    title: "Background Checked",
    desc: "CPIC criminal record check and AML screening — completed before any caregiver can accept bookings.",
  },
  {
    icon: MapPinCheck,
    title: "Visit Verified",
    desc: "GPS-based check-in and check-out records every visit. Families receive real-time arrival notifications.",
  },
];

const caregiverBenefits = [
  {
    icon: DollarSign,
    title: "Set Your Own Rate",
    desc: "You decide what your time is worth. No agency dictating your pay.",
  },
  {
    icon: CalendarDays,
    title: "Choose Your Schedule",
    desc: "Work when it suits you — mornings, evenings, weekends. Full flexibility.",
  },
  {
    icon: CheckCircle2,
    title: "Review Every Offer",
    desc: "Before you accept a booking you see the address, time, recipient, and any notes. Take the offers that fit; pass on the ones that don't.",
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/[0.06] rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            Trusted Care for
            <br />
            <span className="text-primary">Your Loved Ones</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground">
            Find verified caregivers for companionship, errands, and everyday help — across
            Canada.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/signup?role=family">
              <Button size="lg" className="h-12 px-8 text-base">
                Find a Caregiver
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
            <Link href="/signup?role=caregiver">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Become a Caregiver
              </Button>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="size-4 text-primary" />
              Background Checked
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" />
              GPS-Verified Visits
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="size-4 text-primary" />
              Only 7.5% Fee
            </span>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="bg-muted/40 py-20 sm:py-28" id="how-it-works">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2>How KindredCare Works</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Simple for families. Empowering for caregivers.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Families track */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Heart className="size-3.5" />
                For Families
              </div>
              <div className="space-y-4">
                {familySteps.map((step) => (
                  <Card key={step.title} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <step.icon className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{step.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Caregivers track */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
                <Briefcase className="size-3.5" />
                For Caregivers
              </div>
              <div className="space-y-4">
                {caregiverSteps.map((step) => (
                  <Card key={step.title} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <step.icon className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{step.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES ─── */}
      <section className="py-20 sm:py-28" id="services">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2>Services for Every Need</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              From companionship to practical help — whatever your family needs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {services.map((svc) => (
              <div
                key={svc.title}
                className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
                  <svc.icon className="size-5" />
                </div>
                <p className="font-medium text-foreground">{svc.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{svc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TRUST & SAFETY ─── */}
      <section className="bg-muted/40 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2>Your Safety, Our Priority</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Every caregiver is verified before they can accept their first booking.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {trustPillars.map((pillar) => (
              <div key={pillar.title} className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success">
                  <pillar.icon className="size-7" />
                </div>
                <h4 className="text-base">{pillar.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card px-6 py-5 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Trust Score</span> — Every caregiver
              earns a composite score based on verification completeness, client reviews,
              reliability, and platform tenure. Families see the score before booking, so you always
              know what to expect.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOR CAREGIVERS ─── */}
      <section className="py-20 sm:py-28" id="for-caregivers">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2>
                Earn More,
                <br />
                <span className="text-accent">Work on Your Terms</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Traditional agencies take 30–40% of what families pay. On KindredCare, you keep{" "}
                <span className="font-semibold text-foreground">92.5%</span>.
              </p>

              <div className="mt-8 flex items-center gap-6 rounded-2xl bg-muted/60 p-5">
                <div className="text-center">
                  <p className="text-3xl font-bold text-accent">92.5%</p>
                  <p className="text-xs text-muted-foreground">KindredCare</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-muted-foreground/50">60–70%</p>
                  <p className="text-xs text-muted-foreground">Agencies</p>
                </div>
                <p className="ml-auto text-xs text-muted-foreground">
                  Your take-home
                  <br />
                  per dollar earned
                </p>
              </div>

              <div className="mt-8">
                <Link href="/signup?role=caregiver">
                  <Button
                    size="lg"
                    className="h-12 bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
                  >
                    Start Earning Today
                    <ArrowRight className="ml-1 size-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              {caregiverBenefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-5"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <benefit.icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{benefit.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <FaqSection />

      {/* ─── FINAL CTA ─── */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.05] via-primary/[0.02] to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/[0.06] rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <h2>Ready to Get Started?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join families and caregivers across Canada who are already using KindredCare.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/signup?role=family">
              <Button size="lg" className="h-12 px-8 text-base">
                Find a Caregiver
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
            <Link href="/signup?role=caregiver">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Become a Caregiver
              </Button>
            </Link>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            Takes less than 5 minutes to sign up
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
