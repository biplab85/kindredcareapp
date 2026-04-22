# KindredCare MVP Build Plan

> **Version:** 1.0
> **Date:** April 2026
> **Source:** `mvp-requirements.md`
> **Timeline:** ~29 weeks (7 months) from kickoff to public launch
> **Update this document:** Check off tasks as they are completed. Add notes and dates as needed.
> **Frontend rule:** Always use the `frontend-design` skill when working on any frontend task (components, pages, layouts, design system).

---

## Phase 1: Project Setup & Foundation (Weeks 1-4)

### 1.1 Development Environment

- [x] **Initialize project structure**
  Set up the repository with a Laravel application (backend API) and a Next.js application (frontend). Use a single repo with `/backend` and `/frontend` directories, or two separate repos. Initialize Laravel 12 via `composer create-project` and Next.js 16 via `create-next-app`.

- [x] **Configure CI/CD pipeline**
  Set up GitHub Actions with automated linting, type-checking, unit tests, and build steps. Configure branch protection rules for main and develop branches.

- [x] **Set up development environments**
  Local development via Laravel Herd (PHP + Nginx) + DBngin (MySQL). No Docker. Backend served at `http://kindredcare-v2.test`. Frontend at `http://localhost:3000`.

- [x] **Configure linting and formatting**
  Set up PHP CS Fixer and Larastan (PHPStan for Laravel) for the backend. Set up ESLint and Prettier for the Next.js frontend. Configure commit hooks (husky + lint-staged) so code style is enforced consistently from day one.

### 1.2 Infrastructure Provisioning

- [ ] **Provision cloud infrastructure** *(deferred — not needed for local dev)*
  Set up AWS account, configure ca-central-1 (Toronto) region, create VPC, subnets, and security groups. Use infrastructure-as-code (Terraform or CDK).

- [x] **Set up database**
  MySQL via DBngin. Database `kindredcare_v2` created. Laravel migrations run successfully.

- [x] **Set up cache layer**
  Using file-based cache and database queue driver (no Redis). Configured in `.env`.

- [x] **Set up file storage**
  Laravel Filesystem configured with local disk (default). S3 deferred to v1.1.

- [ ] **Set up CDN** *(deferred — not needed for MVP)*
  Configure CloudFront distribution for static assets. Set up custom domain and SSL certificates.

- [x] **Set up logging and monitoring**
  Provision error tracking (Sentry), structured logging pipeline, and application performance monitoring. Configure baseline alerts for errors and downtime.

- [x] **Configure environment variable management**
  Set up secrets management for API keys (Certn, Veriff, Stripe, Twilio, Mapbox, Brevo/Resend) across dev/staging/production environments via Laravel `.env` files and server-level environment variables.

### 1.3 Design System & UI Foundation

- [x] **Create design system and component library**
  Build foundational UI components: buttons, inputs, modals, cards, navigation, layout shells, loading states, and error states. Ensure WCAG 2.1 AA compliance from the start.

- [x] **Build responsive layout shell**
  Create the main application layout with responsive navigation for desktop and mobile browsers. Include header, sidebar (desktop), bottom nav (mobile), and content area.

- [x] **Implement large text / accessibility mode**
  Build a toggle for enlarged text and enhanced contrast for senior users. Ensure keyboard navigation works across all components.

- [x] **Design and build landing page**
  Create the public-facing marketing landing page explaining KindredCare, how it works, and calls-to-action for both families and caregivers to sign up.

### 1.4 Third-Party Account Setup

- [ ] **Apply for Stripe Connect platform account**
  Submit Stripe Connect application. This can take 1-2 weeks for approval — start early. Configure test mode immediately.

- [ ] **Set up Veriff account**
  Sign up for Veriff self-serve plan. Obtain API key and shared secret. Configure sandbox environment (free 15-day trial, 50 sessions). Test with Canadian passport and Ontario driver's license.

- [ ] **Sign Certn contract**
  Finalize background check provider agreement. Obtain OAuth credentials and configure test environment for CPIC, AML, and reference check flows.

- [ ] **Set up Twilio account**
  Create Twilio account, purchase Canadian phone number, and configure SMS sending for OTP and notifications.

- [ ] **Set up Mapbox or Google Maps account**
  Obtain API key for geocoding, distance calculations, and address autocomplete.

### 1.5 API Design

- [x] **Draft API specification**
  Define the full API contract covering auth, profiles, verification, gigs, bookings, payments, messaging, ratings, admin, and emergency endpoints. Use Laravel API Resources for response shapes and Form Requests for validation. Auto-generate API docs via Scribe or L5-Swagger. This is the handshake between the Laravel backend and Next.js frontend.

- [x] **Define service taxonomy seed data**
  Finalize the list of MVP service categories (companionship, errands, tech help, etc.) with descriptions, icons, and default task checklists for each.

- [x] **Define data validation rules**
  Document all input validation rules (field lengths, formats, required vs optional) for every form and API endpoint to ensure frontend and backend stay aligned.

---

## Phase 2: Authentication & User Management (Weeks 5-7)

### 2.1 Authentication

- [x] **Implement email + password registration**
  Build signup flow for both family and caregiver roles using Laravel Fortify or custom auth controllers. Include email format validation, password strength requirements, and duplicate email detection. Laravel handles hashing and session creation.

- [x] **Implement email verification**
  Use Laravel's built-in `MustVerifyEmail` contract. Send verification email on signup with a signed URL. Block access to core features until email is verified.

- [x] **Implement phone number verification (SMS OTP)**
  Integrate Twilio SMS via Laravel Notifications to send OTP codes. Build the UI for entering and verifying the code. Required before any booking or verification step.

- [x] **Implement login flow**
  Build login using Laravel Sanctum for API token authentication (Next.js frontend) and session-based SPA auth. Include "remember me" option and session expiration handling.

- [x] **Implement password reset**
  Use Laravel's built-in password reset flow (Fortify). Sends secure reset link via email with token expiration and single-use enforcement out of the box.

- [x] **Implement two-factor authentication (TOTP)**
  Use Laravel Fortify's built-in two-factor authentication support. Optional for family users, mandatory for admin users. Supports authenticator apps (Google Authenticator, Authy).

- [x] **Build session management**
  Configure Laravel session handling with Sanctum token management. Implement idle timeout, ability to revoke all tokens from account settings, and active session listing.

### 2.2 User Account Management

- [x] **Build account settings page** *(auth pages built: signup, login, forgot-password, reset-password, verify-email, verify-phone, email-verified, dashboard placeholder)*
  Allow users to update email, phone, password, and notification preferences. Show connected payment methods for families and payout accounts for caregivers.

- [x] **Implement account deletion and data export**
  Build PIPEDA-compliant account deletion flow. Allow users to download their data as JSON/CSV before deletion. Implement 30-day anonymization and 7-year tax record retention.

- [x] **Implement role-based access control**
  Build Laravel middleware and Gates/Policies that enforce permissions based on user role (family, caregiver, admin). Prevent unauthorized access to role-specific routes and API endpoints.

---

## Phase 3: Profile Management (Weeks 6-8)

### 3.1 Caregiver Profile

- [x] **Build caregiver profile creation flow**
  Multi-step onboarding form: personal info, bio, photo upload, services offered, languages, interests, personality tags. Include progress indicator and save-as-draft capability.

- [x] **Build availability calendar**
  Create a weekly recurring schedule editor where caregivers set their available hours. Add support for specific-date exceptions (blocked or extra available days).

- [x] **Build rate and travel radius settings**
  Allow caregiver to set their hourly rate (within $18-$50 range) and travel radius (km from home address). Show a map preview of their service area.

- [x] **Build caregiver public profile page**
  Display caregiver's bio, photo, services, languages, interests, Trust Score, verification badges, and reviews. This is what families see when browsing or after a match.

- [x] **Build profile photo upload and moderation**
  Allow photo upload with image resizing and compression. Queue new photos for admin review before they go live.

### 3.2 Family / Senior Profile

- [x] **Build family profile creation flow**
  Simplified form: name, postal code, relationship to care recipient. If booking for someone else, collect care recipient details (name, age, language, interests, accessibility notes).

- [x] **Build care recipient management**
  Allow a family account to manage one or more care recipients. Each recipient has their own profile with preferences that feed into the matching engine.

- [x] **Build family public profile (caregiver-facing)**
  Display limited family info visible to caregivers after a booking is confirmed: care recipient first name, general location (city/neighbourhood, not exact address), languages, and interests.

### 3.3 Profile Completion System

- [x] **Build profile completion scoring engine (backend)**
  Calculate a percentage score based on weighted fields: bio (15%), photo (10%), DOB (5%), gender (3%), address (7%), services (10%), service experience (5%), overall experience (5%), languages (5%), certifications (8%), rate (5%), availability (7%), emergency contact (5%), references (7%), personality (2%), interests (1%). Return score + list of missing items via GET /api/me endpoint. Caregivers need 70% to be matchable.

- [x] **Build profile completion UI (frontend)**
  Circular progress ring on onboarding page that updates live as fields are filled. "Profile X% complete" card on caregiver dashboard with missing items checklist. Progress indicator on settings/profile edit page. Uses frontend-design skill.

---

## Phase 4: Verification Pipeline (Weeks 7-10)

### 4.1 Manual Verification System (MVP — no API keys needed)

- [x] **Build verification_records table and model**
  Migration for verification_records: caregiver_id, check_type (identity/cpic/aml/reference), status (not_started/pending_review/cleared/flagged/rejected), provider (manual/veriff/certn), admin_notes, reviewed_by, reviewed_at. This table tracks every verification step for every caregiver.

- [x] **Build caregiver document upload flow**
  Caregiver uploads: government ID photo (front + back), selfie photo, and optionally a Vulnerable Sector Check document. Stored locally. Status set to "pending_review" on upload. Frontend verification page at /verification with upload dropzones and status indicators.

- [x] **Build admin verification review queue**
  Admin dashboard page showing all caregivers with pending verification documents. For each caregiver: view uploaded documents, view profile, approve or reject each check type with admin notes. Bulk actions for efficiency. Filter by status (pending/cleared/flagged).

- [x] **Build admin manual approve/reject flow**
  Admin clicks approve → verification_record status = "cleared", caregiver notified. Admin clicks reject → status = "rejected" with reason, caregiver notified with instructions to re-upload. Admin can flag for further review.

### 4.1b Automated Verification (when API keys are ready — deferred)

- [ ] **Integrate Veriff Web SDK** *(deferred — needs API key)*
  Embed Veriff SDK for automated ID verification. Replace manual document upload with Veriff's camera-based flow.

- [ ] **Build Veriff webhook receiver** *(deferred — needs API key)*
  Receive async results from Veriff. Validate HMAC-SHA256 signatures. Auto-update verification status.

- [ ] **Integrate Certn API for CPIC checks** *(deferred — needs API key)*
  Automated criminal record checks after identity verification passes.

- [ ] **Build Certn webhook receiver** *(deferred — needs API key)*
  Receive async background check results from Certn.

- [ ] **Integrate AML/sanctions screening** *(deferred — needs API key)*
  Automated AML screening bundled with Certn.

### 4.2 Reference Check System

- [ ] **Build automated reference check flow**
  When caregiver submits two reference contacts (already collected in onboarding Step 5), automatically send email questionnaires to each reference. Track submission status. References complete a short online form rating the caregiver. Results stored and visible to admin.

### 4.3 Verification Dashboard (Caregiver-Facing)

- [x] **Build verification status tracker**
  Show caregivers a real-time checklist of all verification steps with status indicators: Not Started, Pending Review, Cleared, Flagged, Rejected. Each item links to the relevant action (upload docs, re-upload, etc).

- [x] **Build "Ready to Match" gating logic**
  Prevent caregivers from appearing in search results or receiving bookings until all required verification items show as Cleared. Show clear messaging about what's still needed.

- [x] **Build verification badge display**
  Show a "Basic Verified" badge on caregiver profiles once all checks pass. Design the badge to be prominent and trustworthy on both the profile card and detail pages.

---

## Phase 5: Service Taxonomy & Gig Posting (Weeks 9-11)

### 5.1 Service Taxonomy

- [ ] **Build service category management**
  Create the data layer for service categories with names, descriptions, icons, tier requirements, and default task checklists. Seed with the MVP taxonomy (companionship, errands, tech help, etc.).

- [ ] **Build service category browsing UI**
  Allow families to browse and select from available service categories when posting a gig. Include category descriptions and example tasks.

### 5.2 Gig Posting (Family Side)

- [ ] **Build gig creation form**
  Multi-step form: select service category, describe the need (free text + optional photo), set location, set schedule (one-time or recurring), set preferences (gender, language, experience tags), set budget.

- [ ] **Build location input with geocoding**
  Integrate Mapbox or Google Maps for address autocomplete. Geocode the address to lat/long for storage and matching. Show a map preview of the gig location.

- [ ] **Build scheduling interface**
  Support one-time bookings (date + start time + duration) and recurring schedules (day-of-week pattern, start/end dates). Validate against reasonable constraints (no past dates, minimum 1-hour duration).

- [ ] **Build gig listing page (family dashboard)**
  Show all gigs posted by the family with status indicators: open, matched, booked, completed, cancelled. Allow editing of open gigs and cancellation of unbooked gigs.

### 5.3 Gig Discovery (Caregiver Side)

- [ ] **Build gig feed for caregivers**
  Show available open gigs that match the caregiver's services, location, and availability. Allow filtering and sorting by date, distance, rate, and service type.

- [ ] **Build gig detail view (caregiver-facing)**
  Display full gig details: service category, description, location (neighbourhood-level, not exact address until booked), schedule, rate, and family preferences.

---

## Phase 6: Matching Engine (Weeks 10-12)

- [ ] **Implement hard filter logic**
  Build the first pass of the matching engine that eliminates non-qualifying caregivers: verification status, service category match, availability overlap, geographic radius, rate range, gender, and language.

- [ ] **Implement geographic distance scoring**
  Use MySQL `ST_Distance_Sphere()` with SPATIAL INDEX to calculate distances between caregiver home and gig location. Convert distance to a 0-100 score (closer = higher). Weight at 30%.

- [ ] **Implement Trust Score scoring**
  Pull each caregiver's computed Trust Score and normalize to a 0-100 scale. Weight at 30%.

- [ ] **Implement interest and language overlap scoring**
  Calculate tag-match percentage between caregiver profile (interests, languages) and gig/family profile preferences. Weight at 20%.

- [ ] **Implement availability fit scoring**
  Score how well the gig fits into the caregiver's existing schedule (avoids overtime gaps, complements other bookings). Weight at 10%.

- [ ] **Implement rate alignment scoring**
  Score how close the caregiver's hourly rate is to the family's budget. Exact match = 100, further apart = lower score. Weight at 10%.

- [ ] **Build composite scoring and ranking**
  Combine all weighted scores into a single match percentage. Return top 10 ranked caregivers with their match scores.

- [ ] **Build match results UI**
  Display ranked caregiver matches to the family with match percentage, key profile highlights (distance, Trust Score, relevant experience), and actions: View Profile, Book, Skip.

- [ ] **Build "open gig" posting option**
  Allow families to post a gig as open for any qualifying caregiver to claim (instead of selecting from matches). Qualifying caregivers see it in their gig feed.

---

## Phase 7: Booking Flow (Weeks 11-13)

- [ ] **Build booking creation flow**
  When family selects a caregiver from matches, show booking summary: service, date/time, duration, caregiver rate, platform fee (7.5%), total cost. Confirm and create booking.

- [ ] **Implement payment authorization on booking**
  On booking confirmation, authorize (hold) the full amount on the family's payment method via Stripe. Do not capture until service is delivered.

- [ ] **Build caregiver booking notification and response**
  Notify caregiver of new booking request via email, SMS, and in-app notification. Build accept/decline interface with a countdown timer (4 hours for scheduled, 15 minutes for on-demand).

- [ ] **Implement automatic fallback on decline**
  If a caregiver declines, automatically offer the booking to the next-ranked caregiver from the original match results. Continue down the list until accepted or exhausted.

- [ ] **Build booking confirmation flow**
  On acceptance, confirm the booking for both parties. Send confirmation emails and SMS with booking details: date, time, address, caregiver/family name, service description.

- [ ] **Build booking management dashboard**
  Allow both families and caregivers to view upcoming, active, and past bookings. Support cancellation with policy enforcement (24-hour notice for free cancellation).

- [ ] **Build booking cancellation flow**
  Handle cancellation by either party. Enforce cancellation policy: family cancellation <24h = no refund; caregiver cancellation <24h = reputation penalty. Release payment authorization on cancellation.

- [ ] **Build calendar view for caregivers**
  Show confirmed bookings on a calendar view integrated with the availability calendar. Auto-block availability for confirmed booking time slots.

---

## Phase 8: Electronic Visit Verification (Weeks 12-14)

- [ ] **Build shift reminder system**
  Send automated reminders to caregivers 24 hours and 1 hour before a scheduled booking via email, SMS, and in-app push notification.

- [ ] **Build check-in flow with GPS verification**
  Caregiver taps "Start Visit" in the app. Capture GPS coordinates and verify they are within 200m of the gig address. Record timestamp. Handle GPS permission denial gracefully with manual check-in fallback.

- [ ] **Build family arrival notification**
  On successful check-in, send a push/SMS notification to the family: "[Caregiver name] has arrived and started the visit."

- [ ] **Build task logging during visit**
  During an active visit, show the caregiver a checklist of tasks based on the service category. Allow checking off completed tasks and adding free-text notes.

- [ ] **Build check-out flow with GPS verification**
  Caregiver taps "End Visit." Re-verify GPS location. Calculate total visit duration. Generate a visit summary with start/end times, tasks completed, and notes.

- [ ] **Build visit summary generation**
  After check-out, generate a visit summary visible to both parties. Include timestamps, duration, completed tasks, caregiver notes, and GPS verification status.

- [ ] **Build GPS anomaly detection**
  Flag visits where: check-in GPS is >500m from the gig address, check-out GPS is >500m, or visit duration is <50% of booked duration. Route flagged visits to admin review queue.

---

## Phase 9: Payment Processing (Weeks 13-15)

### 9.1 Family Payments

- [ ] **Integrate Stripe for family payment methods**
  Build the payment method management flow: add credit/debit card, Apple Pay, Google Pay via Stripe Elements. Store Stripe Customer ID against the family profile.

- [ ] **Implement payment capture on check-out**
  On successful visit check-out, capture the previously authorized payment amount. Handle partial captures if visit was shorter than booked.

- [ ] **Build automatic refund for no-shows**
  If the caregiver does not check in within 30 minutes of the scheduled start time, automatically release the payment authorization and refund the family.

- [ ] **Build dispute-triggered payment hold**
  If a family opens a dispute within 48 hours of check-out, freeze the payout to the caregiver until the dispute is resolved by admin.

### 9.2 Caregiver Payouts

- [ ] **Integrate Stripe Connect Express onboarding**
  Build the flow for caregivers to set up their Stripe Connect Express account (bank details, identity verification via Stripe). Embed the Stripe onboarding link in the caregiver profile setup.

- [ ] **Implement platform fee split**
  Configure Stripe Connect to automatically deduct 7.5% platform fee from each booking payment, retaining it in the KindredCare platform account and paying the remainder to the caregiver.

- [ ] **Implement 24-hour payout hold**
  After payment capture, hold funds for 24 hours before releasing to the caregiver's Stripe account. This creates a dispute window for the family.

- [ ] **Build caregiver earnings dashboard**
  Show caregivers their earnings: per-booking breakdown, pending payouts, completed payouts, total earnings this month/year. Include a payout history table.

### 9.3 Tax & Financial Reporting

- [ ] **Build annual earnings statement generator**
  Generate year-end earnings reports for caregivers showing total gross earnings, platform fees deducted, and net payouts. Formatted for T4A filing purposes.

- [ ] **Build platform revenue reporting**
  Admin-facing report showing gross transaction volume, commission revenue, refunds, and net revenue by period (daily/weekly/monthly).

---

## Phase 10: Messaging System (Weeks 13-15)

- [ ] **Build real-time messaging backend**
  Implement real-time messaging using Laravel Reverb (WebSocket server) and Laravel Broadcasting. Messages flow between family and caregiver within the context of a booking. Store all messages server-side with timestamps.

- [ ] **Build messaging UI**
  Build a chat-style interface accessible from the booking detail page. Show message history, support text messages and photo/file attachments (max 5MB).

- [ ] **Implement personal info redaction**
  Auto-detect and redact phone numbers, email addresses, and URLs from messages before the booking is confirmed. This prevents off-platform payment arrangements.

- [ ] **Build message notifications**
  Send push notifications (web push) and optional email/SMS notifications for new messages. Respect user notification preferences.

- [ ] **Build message moderation tools (admin)**
  Allow admins to search and view message threads by booking ID during dispute resolution. Include flagging capability for inappropriate content.

---

## Phase 11: Ratings, Reviews & Trust Score (Weeks 14-16)

### 11.1 Ratings & Reviews

- [ ] **Build post-visit rating prompt**
  After a completed visit, prompt both the family and the caregiver to rate the other party (1-5 stars) and leave an optional written review. Show the prompt in-app and via email.

- [ ] **Implement review visibility rules**
  Reviews become visible on the profile after both parties have rated, OR after 7 days — whichever comes first. This prevents retaliatory review gaming.

- [ ] **Build review display on profiles**
  Show reviews on caregiver and family profiles with star ratings, text, date, and service category. Show average rating and total review count prominently.

- [ ] **Build review flagging and moderation**
  Allow either party to flag a review as inappropriate or retaliatory. Route flagged reviews to admin moderation queue with the ability to hide or remove.

### 11.2 Trust Score

- [ ] **Implement Trust Score calculation engine**
  Build the composite scoring logic: verification completeness (40%), client reviews (30%), reliability (20%), tenure (10%). Recalculate on every relevant event (new review, completed booking, verification update).

- [ ] **Build Trust Score display**
  Show Trust Score prominently on caregiver profile cards and detail pages. Use a visual indicator (e.g., gauge, number out of 100, or tier label). Show "New" label for caregivers with <3 reviews.

- [ ] **Build reliability tracking**
  Track on-time check-in rate, booking completion rate, and cancellation rate per caregiver. Feed these into the reliability component of the Trust Score.

---

## Phase 12: Notifications System (Weeks 14-16)

- [ ] **Build notification preferences management**
  Allow users to configure which notifications they receive and via which channel (in-app, email, SMS). Default all on for MVP.

- [ ] **Implement in-app notification center**
  Build a notification bell/inbox UI showing recent notifications. Include read/unread status, timestamps, and deep links to the relevant page (booking, message, review, etc.).

- [ ] **Implement email notification templates**
  Create Laravel Blade email templates (via Laravel Notifications + Brevo or Resend as mail driver) for all key events: signup welcome, booking request, booking confirmation, shift reminder, visit started, visit completed, payment received, review prompt, verification update.

- [ ] **Implement SMS notifications**
  Send SMS via Twilio for high-priority events: booking confirmation, shift reminder (1 hour before), caregiver arrival, emergency alerts.

- [ ] **Implement web push notifications**
  Set up service worker for web push notifications on mobile browsers. Support notification subscription and delivery for real-time events.

---

## Phase 13: Emergency & Safety Features (Weeks 17-18)

- [ ] **Build panic button**
  Add a prominent, always-accessible emergency button during active visits for caregivers. On press: capture GPS, send immediate alert to KindredCare safety team dashboard, and offer option to call 911 directly.

- [ ] **Build silent panic mode**
  Allow the panic button to be activated silently (no visible alert to the other party). GPS is shared and alert is sent without any on-screen indication.

- [ ] **Build safety team alert dashboard**
  Create a real-time alert feed for the safety team showing panic button activations, GPS location, caregiver name, booking details, and contact info for both parties.

- [ ] **Build incident reporting form**
  Create an incident report form accessible from any booking (during or after). Include incident type selection (safety, abuse, property damage, other), description, severity, and optional photo upload.

- [ ] **Build pre-visit safety checklist**
  Before a visit starts, show the caregiver a brief safety confirmation: "Do you feel safe proceeding with this assignment?" with options to confirm or flag a concern.

- [ ] **Build incident escalation workflow**
  Route submitted incidents to the admin queue with triage tools. Support assigning to team members, tracking status (open, investigating, resolved), and recording resolution notes.

---

## Phase 14: Admin Dashboard (Weeks 17-20)

### 14.1 User Management

- [ ] **Build user search and browse**
  Allow admins to search for users by name, email, phone, or ID. Show user profiles with role, status, verification history, booking history, and ratings.

- [ ] **Build account suspension and reactivation**
  Allow admins to suspend a user account (with reason) immediately. Suspended caregivers are removed from matching; suspended families cannot book. Support reactivation.

- [ ] **Build account deletion (admin-initiated)**
  Allow admins to delete accounts in cases of fraud, abuse, or user request. Enforce data retention rules (anonymize, preserve tax records).

### 14.2 Verification Management

- [ ] **Build verification review queue**
  Show all caregiver verifications pending admin review (for the first 100 caregivers, per MVP requirements). Display verification results from Veriff and Certn alongside the caregiver profile.

- [ ] **Build approve/reject verification flow**
  Allow admins to approve or reject verification results with an optional note. On approval, update caregiver status to "Basic Verified." On rejection, notify caregiver with reason and retry options.

- [ ] **Build flagged verification handling**
  Show caregivers whose verification was automatically flagged (non-clear CPIC, failed identity match, AML hit). Provide tools to investigate and make a decision.

### 14.3 Booking & Dispute Management

- [ ] **Build booking browser**
  Allow admins to search and filter bookings by status, date range, caregiver, family, or service category. Show booking detail view with all associated data (messages, GPS logs, tasks, payments).

- [ ] **Build dispute resolution interface**
  For disputed bookings, show all evidence: messages, GPS check-in/check-out data, visit duration, task log, caregiver notes, and both parties' statements. Allow admin to resolve with refund, partial refund, or no action.

- [ ] **Build manual refund tool**
  Allow admins to issue full or partial refunds for any completed booking directly via the Stripe API. Log all refund actions in the audit trail.

### 14.4 Analytics & Reporting

- [ ] **Build core metrics dashboard**
  Display key metrics: total active caregivers, total active families, bookings this week/month, gross transaction volume, commission revenue, average rating, and Trust Score distribution.

- [ ] **Build geographic heatmap**
  Show a map of Durham Region with booking density, caregiver distribution, and service demand hotspots. Helps identify where more caregiver supply is needed.

- [ ] **Build booking trend charts**
  Show booking volume over time (daily/weekly/monthly), broken down by service category. Include comparison to prior periods.

### 14.5 System Administration

- [ ] **Build audit log viewer**
  Show a searchable, filterable log of all admin actions: who did what, to which user/booking, when, with metadata. Essential for accountability and compliance.

- [ ] **Build system alert feed**
  Aggregate all system alerts in one view: GPS anomalies, flagged reviews, payment failures, verification webhook errors, panic button activations, and incident reports.

- [ ] **Build admin user management**
  Allow super-admin to create, edit, and deactivate admin accounts. Enforce mandatory TOTP for all admin accounts.

---

## Phase 15: Security, Compliance & Privacy (Weeks 21-23)

### 15.1 Security Hardening

- [ ] **Conduct security audit of authentication flows**
  Review signup, login, password reset, and session management for vulnerabilities. Verify bcrypt configuration, token security, and session expiration logic.

- [ ] **Implement API rate limiting**
  Add per-IP and per-user rate limiting on all API endpoints. Configure stricter limits on auth endpoints (login, password reset) to prevent brute force attacks.

- [ ] **Implement input validation and sanitization**
  Verify all API endpoints validate and sanitize input. Check for SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities across the entire application.

- [ ] **Implement sensitive data encryption at rest**
  Verify that all sensitive data fields (personal info, verification results, messages) are encrypted at rest using AES-256. Verify local storage directory permissions are secure.

- [ ] **Configure Content Security Policy headers**
  Set CSP, HSTS, X-Frame-Options, and other security headers on all responses. Prevent clickjacking, XSS, and mixed content issues.

- [ ] **Conduct penetration test**
  Engage an external security firm or use automated penetration testing tools to identify vulnerabilities. Prioritize and resolve all critical and high-severity findings.

### 15.2 Privacy & PIPEDA Compliance

- [ ] **Build privacy policy and ToS pages**
  Publish the lawyer-reviewed Privacy Policy and Terms of Service. Link from every page footer, signup flow, and account settings.

- [ ] **Implement consent management**
  Record explicit consent for biometric data collection (ID verification), terms of service acceptance, and marketing communications. Store consent records with timestamps.

- [ ] **Implement data access request flow**
  Allow users to request a copy of all personal data held by the platform. Generate and deliver a downloadable data export within 30 days.

- [ ] **Implement data deletion request flow**
  Allow users to request account deletion. Anonymize personal data within 30 days while retaining financial records for 7 years per CRA requirements.

- [ ] **Implement biometric data handling policy**
  Verify that raw ID images and selfies from Veriff are never stored on KindredCare servers. Confirm that only pass/fail results and provider reference IDs are retained.

- [ ] **Implement breach notification capability**
  Build the internal process and email templates for notifying affected users and the OPC in the event of a data breach. Document the response plan.

---

## Phase 16: Testing & Quality Assurance (Weeks 21-24)

### 16.1 Automated Testing

- [ ] **Write unit tests for matching engine**
  Test hard filter logic, individual scoring functions, and composite ranking with a variety of caregiver/gig combinations. Cover edge cases: zero matches, tied scores, boundary distances.

- [ ] **Write unit tests for Trust Score calculation**
  Test score computation with different combinations of verification status, review counts, reliability metrics, and tenure values.

- [ ] **Write unit tests for payment flow**
  Test authorization, capture, refund, split, and payout logic. Cover edge cases: failed authorization, partial capture, dispute hold, no-show refund.

- [ ] **Write integration tests for verification pipeline**
  Test the end-to-end flow from verification initiation through webhook receipt to status update. Use Veriff and Certn sandbox environments.

- [ ] **Write integration tests for booking lifecycle**
  Test the full lifecycle: gig posted → matched → booked → accepted → check-in → check-out → payment captured → payout → rated. Include cancellation and decline paths.

- [ ] **Write end-to-end tests for critical user journeys**
  Automate browser-based tests for: caregiver signup and verification, family signup and gig posting, booking and visit completion, and payment receipt.

### 16.2 Manual Testing & QA

- [ ] **Conduct mobile browser testing**
  Test on iOS Safari, Android Chrome, and Samsung Internet. Verify all flows work correctly on small screens: signup, booking, EVV check-in/check-out, messaging, panic button.

- [ ] **Conduct accessibility audit**
  Test with screen readers (VoiceOver, NVDA), keyboard-only navigation, and the large text mode. Fix all WCAG 2.1 AA violations.

- [ ] **Conduct load testing**
  Simulate 100 concurrent bookings and 1,000 concurrent users. Verify page load stays under 2 seconds and API response under 500ms at P95.

- [ ] **Conduct payment flow testing with real Stripe test cards**
  Test all payment scenarios using Stripe test card numbers: successful payment, declined card, insufficient funds, 3D Secure authentication, and dispute/chargeback flows.

- [ ] **Conduct GPS verification testing**
  Test EVV check-in/check-out on multiple devices. Verify GPS accuracy, permission handling, fallback for denied permissions, and anomaly flagging.

---

## Phase 17: Documentation & Operations Prep (Weeks 23-24)

- [ ] **Write operational runbooks**
  Document step-by-step procedures for: payment failure recovery, verification webhook failures, GPS anomaly investigation, caregiver suspension, emergency incident response, and system outage recovery.

- [ ] **Write admin dashboard user guide**
  Create a guide for the KindredCare operations team covering all admin dashboard features, dispute resolution procedures, and verification review workflows.

- [ ] **Write caregiver onboarding guide**
  Create user-facing documentation or in-app tooltips explaining each verification step, what documents are needed, how long each step takes, and what to do if a check fails.

- [ ] **Write family getting-started guide**
  Create a simple guide for families: how to post a gig, how to read caregiver profiles, how booking and payment work, and how to leave a review.

- [ ] **Configure production monitoring and alerting**
  Finalize alerting rules for production: error rate thresholds, payment failure rate, panic button triggers, uptime checks, and certificate expiration. Set up on-call notification routing.

- [ ] **Set up disaster recovery**
  Document and test database backup restoration, service failover, and recovery procedures. Verify automated backups run on schedule.

---

## Phase 18: Beta Launch (Weeks 25-28)

### 18.1 Beta Preparation

- [ ] **Recruit seed caregivers (target: 20)**
  CEO/COO personally recruit 20 caregivers in Durham Region. Assist them through the full onboarding and verification process. Ensure diverse service coverage across the taxonomy.

- [ ] **Recruit beta families (target: 10)**
  Identify 10 families in Durham Region through Spark Centre network, senior associations, or personal connections. Provide guided onboarding and set expectations for beta feedback.

- [ ] **Deploy to production environment**
  Deploy the full application to the production AWS environment. Run final smoke tests on production. Configure production monitoring and alerting.

- [ ] **Enable invite-only access**
  Restrict registration to invitation codes. Issue codes to seed caregivers and beta families only. Disable public signup until public launch.

### 18.2 Beta Operations

- [ ] **Monitor first 10 bookings closely**
  Track the first 10 bookings end-to-end. Monitor for issues in matching, booking, check-in/check-out, payment, and rating flows. Fix bugs immediately.

- [ ] **Conduct weekly beta feedback sessions**
  Hold weekly calls or in-person sessions with beta caregivers and families. Collect structured feedback on usability, trust, matching quality, and pain points.

- [ ] **Triage and fix beta bugs**
  Track all reported issues. Prioritize by severity (blocking, major, minor). Fix blocking and major issues within 48 hours.

- [ ] **Validate payment end-to-end**
  Confirm that real payments are processing correctly: family is charged, platform fee is deducted, caregiver receives payout, and earnings reports are accurate.

- [ ] **Validate safety features in real conditions**
  Have beta caregivers test the panic button, incident reporting form, and pre-visit safety checklist during real visits. Verify that alerts reach the safety team.

- [ ] **Measure and report beta success metrics**
  Track beta KPIs: bookings completed, average rating, caregiver on-time rate, payment success rate, verification completion rate, and NPS score from beta users.

---

## Phase 19: Public Launch Preparation (Weeks 27-29)

### 19.1 Marketing Setup

- [ ] **Finalize and publish marketing landing page**
  Ensure the landing page clearly explains KindredCare for both families and caregivers. Include testimonials from beta users (with permission), service taxonomy overview, and clear signup CTAs.

- [ ] **Set up Google Ads campaigns**
  Create campaigns targeting Durham Region families searching for senior care, companionship, and caregiver services. Set daily budget per marketing plan.

- [ ] **Set up Facebook/Instagram campaigns**
  Create targeted campaigns for: adult children of seniors (family side) and students/retirees/immigrants seeking flexible work (caregiver side) in Durham Region.

- [ ] **Build SEO-optimized content pages**
  Create pages targeting key search terms: "senior companionship Durham Region", "caregiver jobs Oshawa", "home help for elderly Ajax", etc.

- [ ] **Set up referral program**
  Build caregiver referral flow ($25 credit per successful referral) and family referral flow ($20 first-booking credit). Track referral codes and payouts.

### 19.2 Operations Readiness

- [ ] **Establish safety team on-call rotation**
  Set up 24/7 on-call schedule for panic button and emergency incident response. Configure alert routing to on-call personnel.

- [ ] **Set up customer support channels**
  Launch support email and phone line. Create canned responses for common questions. Define SLAs: 24-hour email response, immediate phone for safety issues.

- [ ] **Open public registration**
  Remove invite-only restriction. Enable self-service signup for both caregivers and families. Monitor registration rate and verification pipeline throughput.

- [ ] **Prepare launch press release**
  Draft and distribute press release to Durham Region media, Spark Centre channels, and senior care industry publications.

- [ ] **Coordinate Spark Centre launch event**
  Plan a local launch event at Spark Centre for community outreach, live demos, and caregiver/family signup. Coordinate with CEO and COO for in-person presence.

---

## Phase 20: Post-Launch & Iteration (Weeks 29+)

- [ ] **Monitor launch week metrics daily**
  Track signups (both sides), verification completion rate, bookings, payment success, and support ticket volume. Address any issues immediately.

- [ ] **Establish weekly metrics review cadence**
  Set up a weekly team review of: active users, bookings, revenue, Trust Score distribution, geographic coverage, and user feedback. Identify trends and action items.

- [ ] **Build and prioritize v1.1 backlog**
  Based on beta and launch feedback, build the prioritized backlog for v1.1 features: enhanced verification tiers, personal care services, native mobile apps, French UI, gamification.

- [ ] **Monitor caregiver supply vs family demand**
  Track the supply-demand balance by service category and location. If demand outpaces supply in specific categories, focus caregiver recruitment marketing on those gaps.

- [ ] **Collect and act on user feedback**
  Set up an in-app feedback mechanism and regular check-ins with active users. Prioritize feedback that impacts trust, matching quality, and payment reliability.

- [ ] **File IRAP and SR&ED applications**
  CFO files NRC IRAP application (Month 1 post-launch if not already submitted). Begin documenting R&D activities for SR&ED tax credit claims.

---

## Summary: Phase Timeline

| Phase | Weeks | Duration | Key Outcome |
|---|---|---|---|
| 1. Project Setup & Foundation | 1-4 | 4 weeks | Repo, infra, design system, third-party accounts, API spec |
| 2. Auth & User Management | 5-7 | 3 weeks | Signup, login, OTP, roles, account management |
| 3. Profile Management | 6-8 | 3 weeks | Caregiver profiles, family profiles, care recipients |
| 4. Verification Pipeline | 7-10 | 4 weeks | Veriff, Certn, AML, references, verification dashboard |
| 5. Service Taxonomy & Gig Posting | 9-11 | 3 weeks | Categories, gig creation, gig feed |
| 6. Matching Engine | 10-12 | 3 weeks | Hard filters, weighted scoring, ranked results |
| 7. Booking Flow | 11-13 | 3 weeks | Book, accept/decline, confirm, cancel, calendar |
| 8. EVV | 12-14 | 3 weeks | GPS check-in/out, task logging, visit summary |
| 9. Payment Processing | 13-15 | 3 weeks | Stripe Connect, capture, split, payout, refund |
| 10. Messaging | 13-15 | 3 weeks | Real-time chat, redaction, notifications |
| 11. Ratings & Trust Score | 14-16 | 3 weeks | Two-way ratings, Trust Score engine, display |
| 12. Notifications | 14-16 | 3 weeks | Email, SMS, push, in-app center, preferences |
| 13. Emergency & Safety | 17-18 | 2 weeks | Panic button, incidents, safety dashboard |
| 14. Admin Dashboard | 17-20 | 4 weeks | User mgmt, verification queue, disputes, analytics |
| 15. Security & Compliance | 21-23 | 3 weeks | Pentest, PIPEDA, encryption, rate limiting |
| 16. Testing & QA | 21-24 | 4 weeks | Unit, integration, E2E, mobile, accessibility, load |
| 17. Docs & Ops Prep | 23-24 | 2 weeks | Runbooks, guides, monitoring, DR |
| 18. Beta Launch | 25-28 | 4 weeks | 20 caregivers, 10 families, bug fixes, validation |
| 19. Public Launch Prep | 27-29 | 3 weeks | Marketing, support, referrals, open registration |
| 20. Post-Launch | 29+ | Ongoing | Metrics, feedback, v1.1 backlog, IRAP/SR&ED |

> **Note:** Phases overlap intentionally. Frontend and backend work can run in parallel within each phase. Phases 2-3, 5-6, 8-9-10, 11-12, 13-14, and 15-16-17 are designed to run concurrently.

---

*Last updated: April 2026. Update task checkboxes as work is completed.*
