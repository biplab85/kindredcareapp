"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { StarRating } from "@/components/ui/star-rating";
import { StepIndicator } from "@/components/ui/step-indicator";
import { LargeTextToggle } from "@/components/ui/large-text-toggle";
import {
  Heart,
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const onboardingSteps = [
  { label: "Profile", description: "Basic info" },
  { label: "Services", description: "What you offer" },
  { label: "Verification", description: "ID & background" },
  { label: "Go Live", description: "Start earning" },
];

export default function DesignSystemPage() {
  const [rating, setRating] = useState(0);
  const [currentStep, setCurrentStep] = useState(2);
  const [progress, setProgress] = useState(65);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="mb-2">KindredCare Design System</h1>
            <p className="text-muted-foreground text-lg">Component library and design tokens</p>
          </div>
          <LargeTextToggle />
        </div>

        {/* Colors */}
        <section className="mb-16">
          <h2 className="mb-6">Brand Colors</h2>
          <p className="text-muted-foreground mb-6">
            Derived from the KindredCare Global logo — blue for trust, red for the heart of care,
            green for growth and safety.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="h-20 rounded-xl bg-primary mb-2 shadow-sm" />
              <p className="text-sm font-medium">Primary</p>
              <p className="text-xs text-muted-foreground">Trust Blue · #2D82B7</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-accent mb-2 shadow-sm" />
              <p className="text-sm font-medium">Accent</p>
              <p className="text-xs text-muted-foreground">Heart Red · #E2533F</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-success mb-2 shadow-sm" />
              <p className="text-sm font-medium">Success</p>
              <p className="text-xs text-muted-foreground">Leaf Green · #36A365</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-warning mb-2 shadow-sm" />
              <p className="text-sm font-medium">Warning</p>
              <p className="text-xs text-muted-foreground">Warm Amber</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-info mb-2 shadow-sm" />
              <p className="text-sm font-medium">Info</p>
              <p className="text-xs text-muted-foreground">Sky Blue (primary tint)</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-destructive mb-2 shadow-sm" />
              <p className="text-sm font-medium">Destructive</p>
              <p className="text-xs text-muted-foreground">Deep Red</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-secondary border mb-2" />
              <p className="text-sm font-medium">Secondary</p>
              <p className="text-xs text-muted-foreground">Cool Grey</p>
            </div>
            <div>
              <div className="h-20 rounded-xl bg-muted mb-2" />
              <p className="text-sm font-medium">Muted</p>
              <p className="text-xs text-muted-foreground">Whisper Grey</p>
            </div>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Typography */}
        <section className="mb-16">
          <h2 className="mb-6">Typography</h2>
          <div className="space-y-4">
            <h1>Heading 1 — Trusted Care for Your Loved Ones</h1>
            <h2>Heading 2 — Find a Caregiver</h2>
            <h3>Heading 3 — How It Works</h3>
            <h4>Heading 4 — Verification Status</h4>
            <p className="text-lg">
              Body Large — KindredCare connects seniors with verified caregivers.
            </p>
            <p>Body — Every caregiver passes a criminal record check and identity verification.</p>
            <p className="text-sm text-muted-foreground">Small — Last updated 3 hours ago</p>
            <p className="text-xs text-muted-foreground">Caption — 7.5% platform fee applies</p>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Buttons */}
        <section className="mb-16">
          <h2 className="mb-6">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Find a Caregiver</Button>
            <Button variant="secondary">Browse Services</Button>
            <Button variant="outline">View Profile</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Report Issue</Button>
            <Button variant="link">Learn more</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Form Inputs */}
        <section className="mb-16">
          <h2 className="mb-6">Form Inputs</h2>
          <div className="max-w-md space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Enter your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
              <p className="text-xs text-muted-foreground">
                We&apos;ll send booking confirmations here.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-error">Email (with error)</Label>
              <Input id="email-error" type="email" aria-invalid="true" defaultValue="bad-email" />
              <p className="text-xs text-destructive">Please enter a valid email address.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" placeholder="Tell families about yourself..." rows={4} />
              <p className="text-xs text-muted-foreground">200-500 characters</p>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="terms" />
              <Label htmlFor="terms" className="text-sm font-normal">
                I agree to the Terms of Service and Privacy Policy
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="notifications" />
              <Label htmlFor="notifications" className="text-sm font-normal">
                Receive SMS notifications
              </Label>
            </div>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Badges */}
        <section className="mb-16">
          <h2 className="mb-6">Badges</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>
              <Shield className="size-3 mr-1" /> Basic Verified
            </Badge>
            <Badge variant="secondary">Companionship</Badge>
            <Badge variant="outline">
              <MapPin className="size-3 mr-1" /> Canada
            </Badge>
            <Badge variant="destructive">Flagged</Badge>
            <Badge className="bg-success text-success-foreground hover:bg-success/80">
              <CheckCircle2 className="size-3 mr-1" /> Cleared
            </Badge>
            <Badge className="bg-warning text-warning-foreground hover:bg-warning/80">
              <Clock className="size-3 mr-1" /> Pending
            </Badge>
            <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">New</Badge>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Cards */}
        <section className="mb-16">
          <h2 className="mb-6">Cards</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <Avatar className="size-14">
                  <AvatarImage src="" alt="Sarah M." />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    SM
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Sarah M.</CardTitle>
                    <Badge className="text-[0.65rem] px-1.5 py-0">
                      <Shield className="size-2.5 mr-0.5" /> Verified
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1">
                      <StarRating value={4.8} size="sm" readonly />
                      <span className="text-xs font-medium">4.8</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <MapPin className="size-3" /> 8 min away
                    </span>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  5 years experience in companionship and dementia care. Patient, kind, and loves
                  gardening.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <Badge variant="secondary" className="text-xs">
                    Companionship
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Walking
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Gardening
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" size="sm">
                    Book
                  </Button>
                  <Button variant="outline" size="sm">
                    View Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Companionship Visit</CardTitle>
                  <Badge className="bg-success text-success-foreground text-xs">Confirmed</Badge>
                </div>
                <CardDescription>Mon, Apr 21 · 9:00 AM – 12:00 PM</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Heart className="size-4 text-primary" />
                    <span>Caregiver: Sarah M.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    <span>Ajax, ON</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    <span>3 hours · $75.00 + $5.63 fee</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Alerts */}
        <section className="mb-16">
          <h2 className="mb-6">Alerts</h2>
          <div className="space-y-4 max-w-2xl">
            <Alert>
              <CheckCircle2 className="size-4 text-success" />
              <AlertTitle>Verification Complete</AlertTitle>
              <AlertDescription>
                Your background check has cleared. You&apos;re now ready to receive bookings.
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertTriangle className="size-4 text-warning" />
              <AlertTitle>Certification Expiring</AlertTitle>
              <AlertDescription>
                Your First Aid certification expires in 30 days. Please renew to maintain your
                verified status.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Payment Failed</AlertTitle>
              <AlertDescription>
                We couldn&apos;t process your payment. Please update your payment method.
              </AlertDescription>
            </Alert>
            <Alert>
              <Info className="size-4 text-info" />
              <AlertTitle>New Feature</AlertTitle>
              <AlertDescription>
                You can now set recurring schedules for regular bookings.
              </AlertDescription>
            </Alert>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Star Rating */}
        <section className="mb-16">
          <h2 className="mb-6">Star Rating</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Display (readonly)</p>
              <div className="flex items-center gap-6">
                <StarRating value={4.8} readonly showValue size="lg" />
                <StarRating value={3.5} readonly showValue />
                <StarRating value={2} readonly showValue size="sm" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Interactive (click to rate)</p>
              <StarRating value={rating} onChange={setRating} size="lg" showValue />
              {rating > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  You rated {rating} star{rating !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Step Indicator */}
        <section className="mb-16">
          <h2 className="mb-6">Step Indicator</h2>
          <div className="max-w-2xl space-y-6">
            <StepIndicator steps={onboardingSteps} currentStep={currentStep} />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                onClick={() => setCurrentStep(Math.min(onboardingSteps.length, currentStep + 1))}
                disabled={currentStep >= onboardingSteps.length}
              >
                Next
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                Step {currentStep} of {onboardingSteps.length}
              </span>
            </div>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Progress */}
        <section className="mb-16">
          <h2 className="mb-6">Progress</h2>
          <div className="max-w-md space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Profile Completion</p>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProgress(Math.max(0, progress - 20))}
              >
                -20%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProgress(Math.min(100, progress + 20))}
              >
                +20%
              </Button>
            </div>
          </div>
        </section>

        <Separator className="mb-16" />

        {/* Skeleton Loaders */}
        <section className="mb-16">
          <h2 className="mb-6">Skeleton Loaders</h2>
          <Card className="max-w-sm">
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator className="mb-16" />

        {/* Toast */}
        <section className="mb-16">
          <h2 className="mb-6">Toast Notifications</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Booking confirmed!", {
                  description: "Sarah M. accepted your booking for Mon, Apr 21.",
                })
              }
            >
              Success Toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error("Payment failed", { description: "Please update your payment method." })
              }
            >
              Error Toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.warning("Certification expiring", {
                  description: "Your First Aid cert expires in 30 days.",
                })
              }
            >
              Warning Toast
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.info("New gig available", {
                  description: "A companionship gig was posted near you.",
                })
              }
            >
              Info Toast
            </Button>
          </div>
        </section>

        {/* Avatars */}
        <section className="mb-16">
          <h2 className="mb-6">Avatars</h2>
          <div className="flex items-center gap-4">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                SM
              </AvatarFallback>
            </Avatar>
            <Avatar className="size-10">
              <AvatarFallback className="bg-accent/10 text-accent text-sm font-semibold">
                PK
              </AvatarFallback>
            </Avatar>
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                JT
              </AvatarFallback>
            </Avatar>
            <Avatar className="size-16">
              <AvatarFallback className="bg-success/10 text-success text-xl font-semibold">
                AR
              </AvatarFallback>
            </Avatar>
          </div>
        </section>
      </div>
    </div>
  );
}
