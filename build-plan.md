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
  Local development via `php artisan serve` (built-in PHP dev server) + DBngin (MySQL). No Docker. Backend served at `http://localhost:8000`. Frontend at `http://localhost:3000`.

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

> **Direction pivot (2026-04-29).** The marketplace was originally built around a demand-driven model (family posts a gig, caregivers respond). It has since been re-aligned to a **Fiverr-style supply-driven model**: caregivers publish gigs as productized service listings, families browse and book them. The tasks in §5.2 / §5.3 below describe the **legacy** work that shipped — they remain checked because the code is in production. The corrected direction now lives in `mvp-requirements.md` §4.4–4.5 and a follow-up code/schema rework is being planned separately. New work on gig flows must follow the Fiverr direction; do not extend the legacy `family_profile_id` shape.

### 5.1 Service Taxonomy

- [x] **Build service category management**
  Data layer built: `service_categories` table (name, slug, description, icon, tier_required, default_tasks, example_tasks, is_active, sort_order), `ServiceCategory` model, `ServiceCategorySeeder` with all 8 MVP categories, `ServiceCategoryResource` for API, `GET /api/service-categories` returns active and sorted. Feature tests cover seeder + endpoint shape + active/sort filtering.

- [x] **Build service category browsing UI**
  Family-facing `/services` page built with editorial-warmth aesthetic: oversized italicized headline, asymmetric card grid (featured first card spans 2 cols on lg), per-category accent colours (primary/accent/success), example tasks rendered as a typographic list, "Post a gig" CTA on each card linking to `/gigs/new?category={slug}`. Includes loading skeleton, error state, trust strip, and final CTA. Responsive, keyboard-navigable, WCAG AA. Header nav updated to point to `/services`.

### 5.2 Gig Posting (Family Side)

- [x] **Build gig creation form**
  `/gigs/new` 7-step form with community-bulletin aesthetic (§ step markers, asymmetric two-column with live newspaper preview on desktop, tape-corner review card). Steps: service → description + optional photo → location → schedule → preferences → budget → review. Family-role gated via AuthGuard. Posts to `POST /api/gigs`, redirects to `/gigs/{id}` on success. Zod-equivalent client validation mirrors backend. Backend implements all REST verbs: `Gig` model (family_profile_id, care_recipient_id, service_category_id, description, location, schedule, recurring pattern, preferences JSON, photo_path, status enum), `GigResource`, `StoreGigRequest` + `UpdateGigRequest` (min 1h duration enforced via Carbon diff with absolute), `GigController` store/index/show/update/destroy/cancel. Feature tests: 19 passing covering auth, validation, ownership, state transitions, photo lifecycle.

- [x] **Build location input with geocoding** *(MVP subset — Mapbox deferred to v1.1)*
  Durham Region neighbourhood picker (Oshawa, Whitby, Ajax, Pickering, Clarington) with hardcoded centre lat/long per community + free-text street address. Ships without Mapbox token provisioning. Upgrade to address autocomplete + static-map preview is a drop-in later.

- [x] **Build scheduling interface**
  One-time vs recurring toggle. One-time: date + time + duration (1/2/3/4/6/8h chips). Recurring: day-of-week chips + optional end date. Validates past-time and end-after-start on advance, not on render (React 19 purity). Min 1h enforced both client and server.

- [x] **Build gig listing page (family dashboard)**
  `/gigs` family-only dashboard with status filter tabs (all/open/matched/booked/completed/cancelled), upcoming vs past grouping by status, status badges, quick actions (view/edit/cancel/delete) gated by current status. `/gigs/{id}` detail page with editorial layout, sticky meta sidebar, "matching engine coming soon" placeholder. Deletes gig photo on destroy. Nav integration (top header link for signed-in family users) deferred to a broader nav refactor.

### 5.3 Gig Discovery (Caregiver Side)

- [x] **Build gig feed for caregivers**
  `/jobs` noticeboard page (caregiver-only) backed by `GET /api/gigs/feed`. Feed returns open future gigs in the caregiver's offered services (via `caregiver_service` pivot), sortable by `soonest` (default) or `nearest` (PHP Haversine against caregiver home). Service filter chips narrow further. Uses `CaregiverGigResource` that redacts the exact address to a "Near {Durham Region community}" label. Empty-state copy distinguishes "no notices anywhere" vs "filter excludes all". 8 feature tests (auth, filter, sort, redaction, past-gig exclusion, unknown-service rejection).

- [x] **Build gig detail view (caregiver-facing)**
  `/jobs/[id]` detail page consuming the same caregiver-facing resource from `GET /api/gigs/{id}` when the viewer is a caregiver who offers that service. Shows schedule, neighbourhood (not street), preferences, rate cap, and a privacy note about address disclosure on booking. "Apply" CTA is a disabled placeholder until Phase 6 matching lands. 3 feature tests for caregiver-view authorization (matching service → allowed; wrong service or cancelled → 403).

---

## Phase 6: Matching Engine (Weeks 10-12)

> **Direction pivot.** The legacy matcher takes a `Gig` (family request) and returns ranked caregivers. Under the Fiverr direction, the same scoring components stay valuable but the I/O inverts: input becomes `(care_recipient, family_location, ?category)` and output becomes ranked **gigs**. Migration tracked in the separate code-rework plan; the items below describe the legacy build.

- [x] **Implement hard filter logic**
  `MatchingEngine::passesHardFilters()` eliminates candidates on: full verification (all 4 VerificationRecords cleared), service-category pivot membership, travel radius via Haversine, rate cap (`preferences.rate_max`), gender against `users.gender`, language against `caregiver_profile.languages`, and weekly availability calendar. Candidate pool is narrowed at the SQL level (`whereHas('services')`) so PHP only iterates the qualifying set.

- [x] **Implement geographic distance scoring**
  Weight 30%. PHP Haversine (reused from `CaregiverGigResource::haversineKm`) with a linear falloff: `max(0, 100 - 100 * km/radius)`. MVP has plenty of headroom before `ST_Distance_Sphere()` is required; the existing `(latitude, longitude)` composite index covers the narrowing query. Upgrade to spatial SQL is a drop-in if pool size grows.

- [x] **Implement Trust Score scoring**
  Weight 30%. Computed on the fly by `TrustScoreCalculator` — no `trust_score` column. Composite weights from mvp-requirements §4.6: verification 40%, reviews 30% (neutral 100 until Phase 11), reliability 20% (neutral 100 until Phase 8), tenure 10% (capped at 365 days). Swap-in strategy documented in the service so Phase 11 callers don't change.

- [x] **Implement interest and language overlap scoring**
  Weight 20%. 70/30 split between language signal (pref-match scores 100, multi-language 60, empty 50 neutral) and care-recipient interest overlap (tag intersection over recipient count).

- [x] **Implement availability fit scoring**
  Weight 10%. Neutral 80 when availability is set, 60 when empty, pending real booking-adjacency signal once Phase 7/8 ship. The hard filter above still enforces the weekly calendar; this score is intentionally quality-of-fit, not binary.

- [x] **Implement rate alignment scoring**
  Weight 10%. At-or-under-budget earns 90–100 (small value-nudge for under-budget), over-budget already eliminated by the hard filter, missing cap yields a neutral 80.

- [x] **Build composite scoring and ranking**
  `MatchingEngine::matchesFor()` applies the 30/30/20/10/10 weights, takes top 10 by descending score, and returns `{ matches, pool_size, qualifying }`. Endpoint: `POST /api/gigs/{id}/matches` (family-owner gated, open-status gated), serialized via `CaregiverMatchResource` with every component exposed for transparency.

- [x] **Build match results UI**
  `src/app/gigs/[id]/matches/page.tsx` — editorial shortlist: mono § rank, photo + green verification pip, name, italic bio blockquote, signals (distance · experience · languages · trust), tiered match-% pill (90+ success-green, 70–89 primary-blue, <70 neutral), rate in tabular mono, three actions (View profile link, Book disabled with "soon" until Phase 7, Skip). Loading/empty/error states. Parent gig detail now routes families into this view when the gig is in matched mode.

- [x] **Build "open gig" posting option**
  New `gigs.posting_mode` enum (`matched` default, `open`). Families pick inside the Review step on `/gigs/new` — "Shortlist (curated)" vs "Open call (broadcast)". The caregiver feed filters on `posting_mode = open` so matched-mode gigs never leak to the public noticeboard; direct-URL access to a matched-mode gig is also denied for caregivers (Phase 7 invitation flow will open a per-caregiver path).

**Phase 6 QA:** backend 53 tests passing, `composer analyse` clean; frontend lint/typecheck/build all green.

---

## Phase 7: Booking Flow (Weeks 11-13)

> **Direction pivot.** Under the Fiverr direction, the booking entry point is **a chosen gig** (family clicks Book on a gig listing) rather than "family selects a caregiver from matches." `POST /api/bookings` carries `gig_id` plus the visit details (date/time, recipient, address, notes); the rate is locked from the gig. Cascade on decline becomes "family is offered the next-best gig from the original AI-ranked snapshot," not "next-ranked caregiver." Lifecycle, payment, and EVV stay the same. Items below describe the legacy build.

- [x] **Build booking creation flow**
  `/gigs/[id]/book/[caregiverUserId]` — ticket-stub receipt aesthetic: perforated dashed rule, mono tabular pricing, stable "Booking slip #GGGG-CCCC" id, Haversine-aware caregiver card with match score pill. Posts to `POST /api/bookings` with the full ranked queue (stashed via `sessionStorage` on the matches page so cascade has a snapshot), redirects to `/bookings/{id}` on success. `StoreBookingRequest` authorises family role + validates the ranked queue shape; controller defers to `BookingService::createFromMatch`.

- [x] **Implement payment authorization on booking** *(stub channel — real Stripe deferred to Phase 9)*
  `bookings.payment_status` enum: `not_required` → `authorized_stub` (on accept) → `captured_stub` / `released_stub` / `refunded_stub` on cancel/refund. Cents-everywhere schema (`hourly_rate_cents`, `subtotal_cents`, `platform_fee_cents = subtotal * 750/10000`, `caregiver_payout_cents`) so Phase 9 swaps only the adapter. `stripe_payment_intent_id` column is already on the table, nullable.

- [x] **Build caregiver booking notification and response**
  Five Laravel Notification classes — `BookingOffered` (caregiver), `BookingConfirmed` / `BookingDeclined` / `BookingExpired` / `BookingCancelled` (counterparty) — all `database + mail` channels. Mail uses the existing log driver per CLAUDE.md; Twilio SMS is a no-op until Phase 12. Response window: 4 hours scheduled / 15 minutes on-demand (start within 2 hours). Inline accept/decline on `/bookings` row + full reason form on the detail page, with a live countdown pill (30 s tick, overdue styling).

- [x] **Implement automatic fallback on decline**
  `bookings.fallback_queue` json column snapshots the remaining ranked user_ids at offer-creation time. On decline/expire, `BookingService::cascadeToNext` pops the next id, spawns a fresh `pending_caregiver` row at `match_rank + 1`, notifies the family with a cascading-decline email, and moves on. If the queue empties the gig returns to `open` and the family gets a `BookingExpired` notification instead.

- [x] **Build booking confirmation flow**
  On caregiver accept: status → `confirmed`, gig → `booked`, payment → `authorized_stub`, full address revealed to the caregiver (until then they only see the neighbourhood line per the Phase 5 promise), and both parties get mail + database entries. Timeline block on the detail page renders the sequence with `ping`-animated active dot and a `success`-tinted connector for completed steps.

- [x] **Build booking management dashboard**
  `/bookings` is role-aware under one URL. Tab bar: Upcoming / Active / Past, each mapped to a backend status shortcut (`upcoming` = pending+confirmed, `active` = in_progress, `past` = terminal). Row card surfaces per-role info — family sees caregiver name + rank badge + total, caregiver sees service category + neighbourhood + their payout. Inline accept/decline for pending offers. Detail view `/bookings/[id]` splits into receipt block + party block + sticky timeline/actions sidebar.

- [x] **Build booking cancellation flow**
  Both parties can cancel a pending-or-confirmed booking from the detail page's action block. Copy dynamically explains whether the 24-hour free-cancel window applies — `payment_status` becomes `captured_stub` (fee retained) when a family cancels inside 24 h, otherwise `released_stub`. Reason is optional (255 char textarea), and the gig snaps back to `open` so the family can re-match.

- [x] **Build calendar view for caregivers**
  `/caregiver/schedule` — appointment-book week grid, 7 columns, today highlighted with a primary tint. Confirmed visits render as "inked" success-tone cards (solid bg + ring), pending offers as "pencilled" accent-dashed outlines, terminal states struck-through in muted. Week nav shifts by 7 days; "Jump to this week" resets. Legend footer explains the ink/pencil/record states. Pulls both `upcoming` and `past` bookings so navigation backward still shows history.

**Phase 7 QA:** backend 72 tests / 337 assertions passing (19 new Booking feature tests: auth, create, double-booking rejection, past-gig rejection, accept, decline cascade, scheduler expiry, family + caregiver cancel paths, free-cancel window, late-cancel fee retention, address reveal gat/Users/tanzilur/Project/kindredcare_v2/build-plan.mding). `composer analyse` clean; frontend lint / typecheck / build all green. Scheduler registered: `bookings:expire-offers` runs every minute via `Schedule::command(...)->withoutOverlapping()`.

---

## Phase 8: Electronic Visit Verification (Weeks 12-14)

- [x] **Build shift reminder system**
  `SendShiftReminders` console command runs every 5 minutes with a ±10-minute anchor window around T-24h and T-1h before `scheduled_start`. New `ShiftReminder` notification class (database + mail channels) keyed by window (`24h` | `1h`). Dedupe via `reminder_24h_sent_at` / `reminder_1h_sent_at` columns on bookings, so a missed tick or a second run is idempotent. Twilio SMS stays a no-op until Phase 12. Wired into `routes/console.php` with `->everyFiveMinutes()->withoutOverlapping()`.

- [x] **Build check-in flow with GPS verification**
  `BookingService::checkIn(booking, actor, lat, lng)` enforces `status=confirmed` + caregiver ownership, computes haversine distance via the reused `CaregiverGigResource::haversineKm`, writes `check_in_at / _lat / _lng / _distance_m`, and transitions `status → in_progress`. `CHECK_IN_RADIUS_M = 200` is the clean-geofence, `CHECK_IN_FLAG_RADIUS_M = 500` is the admin-review cutoff. Denied-permission flows surface inline in `VisitStartPanel` with a Try Again CTA; `requestGeolocation()` in `@/lib/bookings` wraps `navigator.geolocation` with human-readable error mapping.

- [x] **Build family arrival notification**
  `BookingCheckedIn` notification (database + mail) fires on successful check-in inside the same DB transaction. Frontend surfaces an `ArrivalBanner` on the booking detail page with a perforated-stamp edge ("Anita arrived at 2:31 p.m. · VISIT IN PROGRESS / VISIT RECORDED"). Only rendered when the viewer is family and `visit.check_in_at` is set.

- [x] **Build task logging during visit**
  `UpdateBookingTasksRequest` validates a string array + optional notes; `BookingService::logTasks` gates on `status=in_progress`. UI is `VisitLiveLog` — numbered task checklist merged from `service_category.default_tasks` + any previously-ticked custom tasks, notes textarea, debounced autosave (700 ms via `useRef` timer, **no setState in useEffect** per React 19 rules), live "Saving…" → "Saved" indicator, pulsing green "VISIT — LIVE" header with elapsed-minutes readout.

- [x] **Build check-out flow with GPS verification**
  `BookingService::checkOut(booking, actor, lat, lng, tasks, notes)` requires `in_progress`, writes the check-out trio, flips `status → completed` and `payment_status → captured_stub` in one transaction, fires `VisitCompleted` notifications to both parties (single class with a `forFamily` flag — caregiver sees payout, family sees rate-prompt copy). End-visit re-requests geolocation; errors surface inline without unwinding the task state.

- [x] **Build visit summary generation**
  `VisitSummary` component (appears when `status=completed` for either viewer). Four-up stat grid (CHECKED IN / CHECKED OUT / ACTUAL / BOOKED) in font-mono tabular nums; task list with line-through on skipped defaults and a separate `§ 12` Visit Log section marker to fit the existing editorial grammar. Notes render as a primary-bordered pull-quote. Timeline gains "Visit started" and "Visit complete" entries with real timestamps when the data lands. Merge logic surfaces custom-tagged tasks alongside defaults so nothing the caregiver logged disappears.

- [x] **Build GPS anomaly detection**
  `BookingService::evaluateAnomalyFlags` runs idempotently on both check-in and check-out transitions. Codes: `check_in_far` (>500 m), `check_out_far` (>500 m), `short_duration` (actual minutes < 50% of `duration_minutes`). Persisted to `bookings.flagged_at` + `flag_reasons` json. Surfaced to both parties via `FlagPill` ("Flagged for admin review") in the Visit Summary; the admin-queue wiring lands in Phase 14.

**Phase 8 QA:** backend 87 tests / 390 assertions passing (11 new `BookingEvvTest` feature tests: check-in auth + too-far flag + wrong-status rejection + wrong-actor rejection + missing-coords validation, check-out happy path + check-out-far flag + short-duration flag + requires-in-progress, task logging auth, shift-reminder command fires 24h + 1h + dedupes on second run). `composer analyse` clean, Pint clean; frontend `npm run lint` / `typecheck` / `format:check` / `build` all green. Browser walkthrough confirmed: Start Visit → Live Log with task autosave → End Visit → Completed Summary (with auto-generated `short_duration` flag) → Family arrival banner → Multi-flag visit with all three anomaly reasons rendering in the `FlagPill`.

**Timezone bug fixed before starting Phase 8:** `MatchingEngine::availableAt` compared UTC-stored gig times against local-wall-clock caregiver availability, which broke matching for any gig whose UTC weekday differed from the local Toronto weekday. Added `OPERATING_TIMEZONE = 'America/Toronto'` constant and explicit `setTimezone()` before extracting weekday + minutes. Regression test `test_availability_is_checked_in_operating_timezone` in `GigMatchesTest` confirms a UTC-Tue 01:00 gig (= local Mon 21:00 EDT) now matches a caregiver with only Monday-evening availability.

---

## Phase 9: Payment Processing (Weeks 13-15)

### 9.1 Family Payments

- [x] **Integrate Stripe for family payment methods** *(backend + frontend shell complete — Stripe Elements tokenization deferred until the publishable key + `@stripe/stripe-js` install land together)*
  `config/services.php` reads `STRIPE_KEY` / `STRIPE_SECRET` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_API_VERSION` from env. New `StripePaymentService` wraps `ensureCustomer` / `createSetupIntent` / `listPaymentMethods` / `detachPaymentMethod` / `authorizeForBooking` / `captureForBooking` / `cancelAuthorization` / `refundForBooking`. Every method first checks `isConfigured()` — when false, returns sentinel values that let `BookingService` fall through to the Phase 7 stub channel. `family_profiles` gained `stripe_customer_id` (unique) + `default_payment_method_id` columns. Endpoints: `POST /api/payments/setup-intent` → 503 + explanatory `meta.stripe_configured=false` when Stripe isn't configured, issues a SetupIntent client_secret when it is; `GET /api/me/payment-methods`, `DELETE /api/me/payment-methods/{pm}`, `PATCH /api/me/payment-methods/default`. Frontend `/settings/payment-methods` page renders a calm "Stripe setup pending" card (rotated CreditCard icon + Sparkles badge + 3-bullet promise list) when `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is absent OR the backend reports unconfigured; in the configured state it shows a ticket-stub saved-cards list with perforated left edges, default-pulled-forward primary ring, Make-default/Remove inline actions, and an AddCardForm with a designed placeholder for the Elements slot (backend SetupIntent round-trip already succeeds; only `@stripe/stripe-js` + `@stripe/react-stripe-js` npm install blocks the tokenization half).

- [x] **Implement payment capture on check-out** *(real Stripe path + stub fallback both live)*
  `BookingService::accept` now calls `StripePaymentService::authorizeForBooking` which creates a PaymentIntent with `capture_method='manual'` against the family's `default_payment_method_id`. Returns null when Stripe is unconfigured → payment_status lands on `authorized_stub`; returns a PI when configured → persists `stripe_payment_intent_id` + sets `authorized`. `BookingService::checkOut` calls `captureForBooking` with a pro-rated `amount_to_capture` computed by the new `computeCaptureAmount` helper: if `check_in_at → check_out_at < duration_minutes`, capture is pro-rated at `hourly_rate_cents × actualMinutes / 60` (mvp-reqs §4.9 partial-capture requirement). Cancel paths route through `captureForBooking` (fee-retained late cancel) or `cancelAuthorization` (free cancel / no-show), with `cancelledPaymentStatus()` picking the real-Stripe or stub-channel variant based on whether `stripe_payment_intent_id` is populated.

- [x] **Build automatic refund for no-shows** *(scheduler + service method live)*
  New `BookingService::markNoShow(Booking)` transitions `confirmed → no_show` when the threshold has elapsed, calls `StripePaymentService::cancelAuthorization` (no-op fallback on stub channel), records `cancelled_by='system'` + a system reason, and returns the gig to `open` so the family can re-match. New `Booking::NO_SHOW_THRESHOLD_MINUTES = 30` constant governs the cutoff. `bookings:handle-no-shows` console command runs every minute via `Schedule::command(...)->everyMinute()->withoutOverlapping()` — finds confirmed bookings where `scheduled_start < now()-30min AND check_in_at IS NULL` and delegates to `markNoShow`. Idempotent: second run finds zero candidates because status already flipped.

- [x] **Build dispute-triggered payment hold** *(endpoint + freeze live; admin resolution ships with Phase 14)*
  New `booking_disputes` table with reporter_user_id, reason_code (open-ended enum: no_show/late_arrival/early_leave/scope_creep/property_damage/theft/safety/quality/fraud/other), description, evidence_paths JSON, status (open/under_review/resolved/dismissed), and resolution fields (resolved_by/resolved_at/resolution_code/resolution_refund_cents/resolution_note). `POST /api/bookings/{id}/dispute` gated to family role + within `Booking::DISPUTE_WINDOW_HOURS = 48` of `check_out_at` + `status=completed`. `BookingService::openDispute` validates the reason code against `BookingDispute::REASON_CODES`, creates the row, and flips `booking.payment_status → held_pending_dispute` — the new terminal pre-resolution state that Phase 9.2's payout clock will skip. Caregiver-initiated disputes and admin resolution UI are wired in Phase 14 where the dispute queue surfaces.

**Phase 9.1 QA:** backend 101 tests / 426 assertions passing (14 new `PaymentsTest` feature tests: service degraded-path coverage, booking stub-fallthrough, setup-intent 503 + caregiver-forbidden, payment-methods list empty when unconfigured, set-default persistence, no-show command picks/skips based on threshold + reopens gig + idempotent, dispute happy path + outside-window rejection + pending-booking rejection + caregiver-forbidden + unknown-reason validation). `composer analyse` clean, Pint clean; frontend `npm run lint` / `typecheck` / `format:check` / `build` all green. The stub channel from Phase 7 still passes every pre-existing test unchanged, so production code degrades gracefully when `STRIPE_KEY` is empty.

**Deferred-on-keys:** real Stripe Elements tokenization in `AddCardForm` (needs `@stripe/stripe-js` + `@stripe/react-stripe-js` npm install alongside the publishable key — designed placeholder is in place so nothing looks broken meanwhile); webhook receiver for `payment_intent.*` and `setup_intent.succeeded` events (needs webhook signing secret). Matches the Phase 4 precedent for Veriff/Certn.

### 9.2 Caregiver Payouts

- [x] **Integrate Stripe Connect Express onboarding** *(backend + frontend complete; real account creation requires platform Stripe keys)*
  `caregiver_profiles` gained `stripe_connect_account_id` (unique) + `payouts_enabled` (boolean mirror of the Stripe flag) + `connect_onboarded_at`. `StripePaymentService` extended with `ensureConnectAccount` (creates an Express account with `type=express`, `country=CA`, `card_payments` + `transfers` capabilities requested), `createConnectOnboardingLink` (one-shot hosted AccountLink URL with return/refresh URLs keyed off `config('app.frontend_url')`), and `refreshConnectAccountStatus` (pulls latest from Stripe and mirrors `payouts_enabled` + `details_submitted` onto the local row). New `CaregiverConnectController` surfaces `GET /api/me/stripe-connect/status`, `POST /api/me/stripe-connect/onboarding`, `POST /api/me/stripe-connect/refresh` — all gated on `isConfigured()` with a 503 + explanatory meta when unconfigured. Frontend `/settings/payouts` page (caregiver-only) has five distinct states — Loading / Error / Stripe pending (rotated Banknote icon + Sparkles badge matching the payment-methods pending card) / Not connected (Landmark icon + "Have ready" checklist + primary Start CTA that redirects to Stripe's hosted flow) / Connected-but-not-enabled (accent-toned, dual Continue + Refresh CTAs) / Fully enabled (success-tinted with CheckCircle2 + onboarded date + "Manage on Stripe"). On return from Stripe, `?status=complete`/`?status=refresh` query params trigger a one-shot `refreshConnectStatus()` so the UI reflects reality.

- [x] **Implement platform fee split** *(architecture in place — transfers go out platform-side in 24h-hold job, not via `application_fee_amount`)*
  Architectural choice per risks.md §4: the PaymentIntent stays on the platform account (not a destination charge), and the payout portion is transferred to the caregiver's Connect account via a separate `Transfer` after the 24-hour hold. This gives us full control over dispute-freeze timing (can't happen with `transfer_data.destination`) and keeps all money on the platform until we decide to release it. The platform fee is computed at booking-creation time and stored as `platform_fee_cents` (existing field from Phase 7); `caregiver_payout_cents = subtotal_cents - platform_fee_cents`. `StripePaymentService::transferToCaregiver(Booking)` creates a `Transfer` with `source_transaction=stripe_payment_intent_id` so Stripe ties the transfer to the original charge for accounting. Degrades to a no-op when Stripe isn't configured or the caregiver hasn't completed Connect onboarding — the `ReleasePayouts` command writes a `payout_transferred_at` timestamp either way so the stub channel still shows "released" in the earnings UI.

- [x] **Implement 24-hour payout hold** *(scheduler + freeze-on-dispute complete)*
  New `Booking::PAYOUT_HOLD_HOURS = 24` constant. `BookingService::checkOut` sets `bookings.payout_at = now()->addHours(24)` alongside the payment capture. New `bookings.payout_transferred_at` + `bookings.stripe_transfer_id` columns track the outcome. `bookings:release-payouts` scheduled command runs every 5 minutes via `Schedule::command(...)->everyFiveMinutes()->withoutOverlapping()` — selects captured bookings whose `payout_at < now()` AND no `payout_transferred_at` yet, then pre-filters out bookings with an open `BookingDispute` row before calling `StripePaymentService::transferToCaregiver` on each. Dispute-opened bookings have `payout_at` nulled by `BookingService::openDispute` and `payment_status` flipped to `held_pending_dispute` — double belt-and-suspenders so admin resolution (Phase 14) is the only way out. Idempotent: second run finds zero candidates because `payout_transferred_at` is now set.

- [x] **Build caregiver earnings dashboard** *(done — lifetime/month/year/pending rollup + ticket-stub history rows)*
  New `EarningsController` with `GET /api/me/earnings` returning `{ totals: { lifetime_cents, this_month_cents, this_year_cents, pending_cents }, history: [...] }`. Aggregation traverses `payment_status IN (captured, captured_stub, held_pending_dispute)` bookings for the caregiver, computes `pending` as anything not yet transferred OR currently held, and constructs a per-booking history with `payout_status` derived as `released` / `pending` / `held`. Frontend `/caregiver/earnings` page has a four-up stat grid (Pending cell gets a primary ring + primary-tinted kicker for emphasis, others sit quieter) plus a payout history list where each row reuses the exact perforated-left-edge ticket-stub vocabulary from the Phase 9.1 saved-cards design. Status pills use `CheckCircle2`+success for released / `Clock`+muted for pending / `AlertTriangle`+accent for held. Pending rows surface a "Releases {date}" hint when `payout_at` is still in the future; released rows surface a "Transferred {date}" confirmation. Empty state: a dashed-outline card with a `Wallet` icon.

**Phase 9.2 QA:** backend 111 tests / 458 assertions passing (10 new `PayoutsTest` feature tests: Connect status unconfigured reporting, onboarding 503 gate, family-forbidden on caregiver endpoints, release-payouts eligible vs too-soon selection, idempotency, dispute-frozen skip, checkOut schedules 24h hold correctly, earnings totals rollup with three status variants, scoping to own bookings, family-forbidden on earnings). `composer analyse` clean (three nullable-access cleanups along the way), Pint clean. Frontend `npm run lint` / `typecheck` / `format:check` / `build` all green — `/settings/payouts` and `/caregiver/earnings` compile as static routes.

**Deferred-on-keys:** real Stripe Express account creation + transfer execution (needs `STRIPE_KEY` + `STRIPE_SECRET` and a platform Connect application); Stripe webhook handlers for `account.updated` / `transfer.created` / `transfer.failed` (needs `STRIPE_WEBHOOK_SECRET`). The rest of the path — onboarding UI, status display, 24-hour hold scheduling, earnings rollup, dispute freeze — is live and works end-to-end on the stub channel today.

### 9.3 Tax & Financial Reporting

- [x] **Build annual earnings statement generator**
  New `EarningsStatementController` at `GET /api/me/earnings/statement/{year}` (numeric route constraint) — caregiver-only, rejects years before 2024 or more than one year ahead of current. Aggregates bookings where `payment_status IN (captured, captured_stub, held_pending_dispute)` and `check_out_at` falls in the requested year, returns `{year, year_start, year_end, caregiver: {name,email,postal_code}, totals: {gross_cents, fee_cents, net_cents, visits}, t4a: {box_048_cents, threshold_cents, over_threshold}, generated_at}`. T4A Box 048 = gross earnings (not net) — that's what the CRA wants reported. Threshold pinned to $500 per Income Tax Regulation 200, over/under flag drives the slip-issued call-out in the UI. Frontend `/caregiver/earnings/statement/[year]` page is a formal carbon-copy-receipt layout: masthead with "Earnings statement · T4A Box 048" kicker + KindredCare / Durham Region geo-anchor, formal dl recipient block, gross-earnings number as the hero (font-mono 5xl/6xl in a primary-tinted card), dashed perforation, four-up Gross/Platform fee/Net/Visits breakdown with Net cell ringed in primary, dedicated T4A block with over/under-threshold pill, generated_at footer. Rotated corner "stamp" badge (primary-ringed circle with year) provides a tactile receipt feel. Print story: `print:hidden` on nav chrome + Back + Print button + paper wash; small `@media print` rule hides `nav, aside, [data-print-hide]` and tightens the card border to solid black so `window.print()` produces a clean receipt.

- [x] **Build platform revenue reporting**
  New `Admin\RevenueController` at `GET /api/admin/revenue` under the existing `auth:sanctum + admin` middleware group. Accepts `period=daily|weekly|monthly` (default monthly) + `from` / `to` ISO dates (default: year-start → now). PHP-side bucketing keeps the query driver-agnostic (MySQL in prod, SQLite in tests) — Phase 14.4 can drop to SQL window functions when data volume demands. Returns `{period, from, to, series: [{bucket, label, visits, gmv_cents, commission_cents, refunds_cents, net_cents}], totals: {...}}`. `net_cents = commission_cents − refunds_cents` at both per-bucket and aggregate level. Refunds identified via `payment_status IN (refunded, refunded_stub)` — separate query so a period with only refunds still creates the bucket. Frontend `/admin/revenue` page: Period pill group + From/To date inputs (controlled components with explicit `reload()` on change, not `useEffect`-on-state-change), four-up stat grid with Commission ringed in primary (the platform's actual revenue), ticket-stub per-bucket rows reusing the earnings dashboard's perforated-left-edge vocabulary — refund-heavy buckets tint in accent. Empty state: dashed-outline card "No revenue *in this window*." Phase 14.4 will layer charts + cohort views on top of this endpoint.

**Phase 9.3 QA:** backend 123 tests / 493 assertions passing (12 new `FinancialReportingTest` feature tests: annual statement auth + scope + aggregation + T4A threshold flag + year-range validation; admin revenue monthly/daily bucketing + period param + family/caregiver/guest rejection + invalid period 422 + refund subtraction). `composer analyse` clean, Pint clean; frontend `npm run lint` / `typecheck` / `format:check` / `build` all green. Both new routes (`/caregiver/earnings/statement/[year]`, `/admin/revenue`) compile as static server-rendered routes.

---

## Phase 9 Overall Status

Phase 9 (Payment Processing) is **code-complete on all three sub-sections** (9.1 Family Payments, 9.2 Caregiver Payouts, 9.3 Tax & Financial Reporting). Every flow works end-to-end on the stub-channel fallback when Stripe keys aren't configured, and lights up for real charges/transfers/disputes the moment they are. The five stub payment states (`authorized_stub` / `captured_stub` / `released_stub` / `refunded_stub` / plus the shared `held_pending_dispute`) and their real-Stripe twins share one state machine, so promotion from stub to real is a config flip not a refactor.

**Deferred-on-keys across all of Phase 9:**
- Stripe Elements tokenization in the Add-a-card form (needs `@stripe/stripe-js` install + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- Live Stripe Express account creation + Transfer execution (needs `STRIPE_SECRET` + platform Connect application approval)
- Stripe webhook receiver for `payment_intent.*` / `setup_intent.succeeded` / `account.updated` / `transfer.*` events (needs `STRIPE_WEBHOOK_SECRET`)
- Admin dispute resolution UI (Phase 14 — the endpoint + freeze logic is already here)
- Real T4A slip email generation + CRA electronic filing (v1.1)

---

## Phase 10: Messaging System (Weeks 13-15)

- [x] **Build real-time messaging backend**
  Implement real-time messaging using Laravel Reverb (WebSocket server) and Laravel Broadcasting. Messages flow between family and caregiver within the context of a booking. Store all messages server-side with timestamps.

- [x] **Build messaging UI**
  Build a chat-style interface accessible from the booking detail page. Show message history, support text messages and photo/file attachments (max 5MB).

- [x] **Implement personal info redaction**
  Auto-detect and redact phone numbers, email addresses, and URLs from messages before the booking is confirmed. This prevents off-platform payment arrangements.

- [x] **Build message notifications**
  Send push notifications (web push) and optional email/SMS notifications for new messages. Respect user notification preferences.

- [x] **Build message moderation tools (admin)**
  Allow admins to search and view message threads by booking ID during dispute resolution. Include flagging capability for inappropriate content.

---

## Phase 11: Ratings, Reviews & Trust Score (Weeks 14-16)

### 11.1 Ratings & Reviews

- [x] **Build post-visit rating prompt**
  After a completed visit, prompt both the family and the caregiver to rate the other party (1-5 stars) and leave an optional written review. Show the prompt in-app and via email.

- [x] **Implement review visibility rules**
  Reviews become visible on the profile after both parties have rated, OR after 7 days — whichever comes first. This prevents retaliatory review gaming.

- [x] **Build review display on profiles**
  Show reviews on caregiver and family profiles with star ratings, text, date, and service category. Show average rating and total review count prominently.

- [x] **Build review flagging and moderation**
  Allow either party to flag a review as inappropriate or retaliatory. Route flagged reviews to admin moderation queue with the ability to hide or remove.

### 11.2 Trust Score

- [x] **Implement Trust Score calculation engine**
  Build the composite scoring logic: verification completeness (40%), client reviews (30%), reliability (20%), tenure (10%). Recalculate on every relevant event (new review, completed booking, verification update).

- [x] **Build Trust Score display**
  Show Trust Score prominently on caregiver profile cards and detail pages. Use a visual indicator (e.g., gauge, number out of 100, or tier label). Show "New" label for caregivers with <3 reviews.

- [x] **Build reliability tracking**
  Track on-time check-in rate, booking completion rate, and cancellation rate per caregiver. Feed these into the reliability component of the Trust Score.

---

## Phase 12: Notifications System (Weeks 14-16)

- [x] **Build notification preferences management** *(marketing email + SMS toggles via Phase 15 consent management; transactional notifications are not user-configurable by design)*
  Allow users to configure which notifications they receive and via which channel (in-app, email, SMS). Default all on for MVP.

- [x] **Implement in-app notification center**
  Build a notification bell/inbox UI showing recent notifications. Include read/unread status, timestamps, and deep links to the relevant page (booking, message, review, etc.).

- [x] **Implement email notification templates**
  Create Laravel Blade email templates (via Laravel Notifications + Brevo or Resend as mail driver) for all key events: signup welcome, booking request, booking confirmation, shift reminder, visit started, visit completed, payment received, review prompt, verification update.

- [ ] **Implement SMS notifications**
  Send SMS via Twilio for high-priority events: booking confirmation, shift reminder (1 hour before), caregiver arrival, emergency alerts.

- [ ] **Implement web push notifications**
  Set up service worker for web push notifications on mobile browsers. Support notification subscription and delivery for real-time events.

---

## Phase 13: Emergency & Safety Features (Weeks 17-18)

- [x] **Build panic button**
  Add a prominent, always-accessible emergency button during active visits for caregivers. On press: capture GPS, send immediate alert to KindredCare safety team dashboard, and offer option to call 911 directly.

- [x] **Build silent panic mode**
  Allow the panic button to be activated silently (no visible alert to the other party). GPS is shared and alert is sent without any on-screen indication.

- [x] **Build safety team alert dashboard**
  Create a real-time alert feed for the safety team showing panic button activations, GPS location, caregiver name, booking details, and contact info for both parties.

- [x] **Build incident reporting form**
  Create an incident report form accessible from any booking (during or after). Include incident type selection (safety, abuse, property damage, other), description, severity, and optional photo upload.

- [x] **Build pre-visit safety checklist**
  Before a visit starts, show the caregiver a brief safety confirmation: "Do you feel safe proceeding with this assignment?" with options to confirm or flag a concern.

- [x] **Build incident escalation workflow**
  Route submitted incidents to the admin queue with triage tools. Support assigning to team members, tracking status (open, investigating, resolved), and recording resolution notes.

---

## Phase 14: Admin Dashboard (Weeks 17-20)

### 14.1 User Management

- [x] **Build user search and browse**
  Allow admins to search for users by name, email, phone, or ID. Show user profiles with role, status, verification history, booking history, and ratings.

- [x] **Build account suspension and reactivation**
  Allow admins to suspend a user account (with reason) immediately. Suspended caregivers are removed from matching; suspended families cannot book. Support reactivation.

- [x] **Build account deletion (admin-initiated)**
  Allow admins to delete accounts in cases of fraud, abuse, or user request. Enforce data retention rules (anonymize, preserve tax records).

### 14.2 Verification Management

- [x] **Build verification review queue**
  Show all caregiver verifications pending admin review (for the first 100 caregivers, per MVP requirements). Display verification results from Veriff and Certn alongside the caregiver profile.

- [x] **Build approve/reject verification flow**
  Allow admins to approve or reject verification results with an optional note. On approval, update caregiver status to "Basic Verified." On rejection, notify caregiver with reason and retry options.

- [x] **Build flagged verification handling**
  Show caregivers whose verification was automatically flagged (non-clear CPIC, failed identity match, AML hit). Provide tools to investigate and make a decision.

### 14.3 Booking & Dispute Management

- [x] **Build booking browser**
  Allow admins to search and filter bookings by status, date range, caregiver, family, or service category. Show booking detail view with all associated data (messages, GPS logs, tasks, payments).

- [x] **Build dispute resolution interface**
  For disputed bookings, show all evidence: messages, GPS check-in/check-out data, visit duration, task log, caregiver notes, and both parties' statements. Allow admin to resolve with refund, partial refund, or no action.

- [x] **Build manual refund tool**
  Allow admins to issue full or partial refunds for any completed booking directly via the Stripe API. Log all refund actions in the audit trail.

### 14.4 Analytics & Reporting

- [x] **Build core metrics dashboard**
  Display key metrics: total active caregivers, total active families, bookings this week/month, gross transaction volume, commission revenue, average rating, and Trust Score distribution.

- [x] **Build geographic heatmap** *(text-based demand-density view shipped via `/api/admin/demand-density`; Mapbox visual heatmap deferred to v1.1)*
  Show a map of Durham Region with booking density, caregiver distribution, and service demand hotspots. Helps identify where more caregiver supply is needed.

- [x] **Build booking trend charts**
  Show booking volume over time (daily/weekly/monthly), broken down by service category. Include comparison to prior periods.

### 14.5 System Administration

- [x] **Build audit log viewer**
  Show a searchable, filterable log of all admin actions: who did what, to which user/booking, when, with metadata. Essential for accountability and compliance.

- [x] **Build system alert feed**
  Aggregate all system alerts in one view: GPS anomalies, flagged reviews, payment failures, verification webhook errors, panic button activations, and incident reports.

- [x] **Build admin user management** *(create / edit / deactivate shipped; mandatory TOTP enforcement deferred to Phase 15 hardening)*
  Allow super-admin to create, edit, and deactivate admin accounts. Enforce mandatory TOTP for all admin accounts.

---

## Phase 15: Security, Compliance & Privacy (Weeks 21-23)

### 15.1 Security Hardening

- [x] **Conduct security audit of authentication flows**
  Review signup, login, password reset, and session management for vulnerabilities. Verify bcrypt configuration, token security, and session expiration logic.

- [x] **Implement API rate limiting**
  Add per-IP and per-user rate limiting on all API endpoints. Configure stricter limits on auth endpoints (login, password reset) to prevent brute force attacks.

- [x] **Implement input validation and sanitization**
  Verify all API endpoints validate and sanitize input. Check for SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities across the entire application.

- [x] **Implement sensitive data encryption at rest**
  Verify that all sensitive data fields (personal info, verification results, messages) are encrypted at rest using AES-256. Verify local storage directory permissions are secure.

- [x] **Configure Content Security Policy headers**
  Set CSP, HSTS, X-Frame-Options, and other security headers on all responses. Prevent clickjacking, XSS, and mixed content issues.

- [ ] **Conduct penetration test** *(deferred — requires external security firm engagement)*
  Engage an external security firm or use automated penetration testing tools to identify vulnerabilities. Prioritize and resolve all critical and high-severity findings.

### 15.2 Privacy & PIPEDA Compliance

- [x] **Build privacy policy and ToS pages** *(scaffolded with placeholder content — final wording requires lawyer review before public launch)*
  Publish the lawyer-reviewed Privacy Policy and Terms of Service. Link from every page footer, signup flow, and account settings.

- [x] **Implement consent management**
  Record explicit consent for biometric data collection (ID verification), terms of service acceptance, and marketing communications. Store consent records with timestamps.

- [x] **Implement data access request flow**
  Allow users to request a copy of all personal data held by the platform. Generate and deliver a downloadable data export within 30 days.

- [x] **Implement data deletion request flow**
  Allow users to request account deletion. Anonymize personal data within 30 days while retaining financial records for 7 years per CRA requirements.

- [x] **Implement biometric data handling policy**
  Verify that raw ID images and selfies from Veriff are never stored on KindredCare servers. Confirm that only pass/fail results and provider reference IDs are retained.

- [x] **Implement breach notification capability**
  Build the internal process and email templates for notifying affected users and the OPC in the event of a data breach. Document the response plan.

---

## Phase 16: Testing & Quality Assurance (Weeks 21-24)

### 16.1 Automated Testing

- [x] **Write unit tests for matching engine**
  Test hard filter logic, individual scoring functions, and composite ranking with a variety of caregiver/gig combinations. Cover edge cases: zero matches, tied scores, boundary distances.

- [x] **Write unit tests for Trust Score calculation**
  Test score computation with different combinations of verification status, review counts, reliability metrics, and tenure values.

- [x] **Write unit tests for payment flow**
  Test authorization, capture, refund, split, and payout logic. Cover edge cases: failed authorization, partial capture, dispute hold, no-show refund.

- [x] **Write integration tests for verification pipeline** *(stub-channel coverage; live Veriff/Certn sandbox tests block on Phase 4 API keys)*
  Test the end-to-end flow from verification initiation through webhook receipt to status update. Use Veriff and Certn sandbox environments.

- [x] **Write integration tests for booking lifecycle**
  Test the full lifecycle: caregiver publishes gig → family browses + books → caregiver accepts → check-in → check-out → payment captured → payout → rated. Include cancellation and decline paths.

- [ ] **Write end-to-end tests for critical user journeys**
  Automate browser-based tests for: caregiver signup and verification, caregiver gig publishing, family browse + book, booking and visit completion, and payment receipt.

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
  Create a simple guide for families: how to add a care recipient, how to browse the gig marketplace and use filters/AI matching, how to read caregiver profiles, how booking and payment work, and how to leave a review.

- [ ] **Write caregiver gig-listing guide**
  Create a simple guide for caregivers on writing a great gig: choosing the right service category, picking a competitive hourly rate, what to put in the description, photos that help conversion, when to pause vs delete a gig.

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
| 5. Service Taxonomy & Gig Listings | 9-11 | 3 weeks | Categories, caregiver-published gigs, family marketplace browse (legacy build was family-posts-gig; pending migration to Fiverr direction) |
| 6. Matching Engine | 10-12 | 3 weeks | Hard filters, weighted scoring, ranked gigs for the family's care recipient |
| 7. Booking Flow | 11-13 | 3 weeks | Book a chosen gig, accept/decline, confirm, cancel, calendar |
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
