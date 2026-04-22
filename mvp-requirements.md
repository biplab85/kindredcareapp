# KindredCare MVP Requirements

> **Version:** 1.0
> **Date:** April 2026
> **Status:** Ready for implementation planning
> **Based on:** `final-thoughts.md`, `platform-workflow.md`, `business-plan.pdf`

---

## 1. MVP Goal & Hypothesis

### Core Hypothesis
> Canadian families of seniors will pay a 7.5% commission to access an AI-matched, trust-verified marketplace of caregivers offering companionship and non-medical gig services, and caregivers will accept 7.5% as the platform fee in exchange for flexible work and access to a steady stream of gigs.

### What the MVP Must Prove
1. **Demand exists**: Families will post gig requests and complete bookings
2. **Supply exists**: Caregivers will onboard, complete verification, and accept gigs
3. **Trust works**: Families feel safe enough to book based on the verification system
4. **Matching is useful**: AI recommendations are accepted more often than ignored
5. **Payment flow works end-to-end**: From booking → service delivery → payout, with platform taking 7.5%

### What the MVP Does NOT Need to Prove
- National scale
- LTC subscription revenue
- Medical/personal care services
- Chronic disease specialization
- Machine learning feedback loop (rule-based matching is sufficient for MVP)
- Mobile-native apps (mobile web is acceptable)

---

## 2. MVP Scope Decision

### Launch Geography
**Durham Region, Ontario** (Oshawa, Whitby, Ajax, Pickering, Clarington) — aligning with Spark Centre base.

### Launch Services (Non-Medical Only)
Per `final-thoughts.md` Phase 1 marketing strategy, MVP launches with:

| Category | Services |
|---|---|
| Companionship | Conversation, reading aloud, storytelling, hobby partner, social outings |
| Practical Help | Grocery shopping, errands, tech help, administrative help, mail sorting |
| Wellness & Lifestyle | Walking companion, gardening assistance, meal prep (no food handler cert required for MVP), light housekeeping |
| Transportation | Non-emergency drives (requires valid driver's license + personal auto insurance disclosure) |

**Explicitly OUT of MVP scope:**
- Personal care (bathing, dressing, toileting)
- Medication administration/reminders
- Wound care, medical support
- Dementia/Alzheimer's specialized care
- Palliative care
- Live-in / overnight care
- LTC operator on-demand staffing

These services require Enhanced/Professional verification tiers and higher liability coverage. They are deferred to v1.1+ once MVP demand is validated.

### Launch Verification Tier
**Basic Tier only** for MVP:
- Email + phone verification (OTP)
- Identity verification (government ID + selfie with liveness) via Veriff
- Basic CPIC criminal record check via Certn
- 2 automated reference checks
- AML/sanctions screening (bundled with Certn)
- Self-reported skills, availability, and rate

**Enhanced and Professional tiers deferred** to v1.1.

### Launch Platforms
- **Responsive web application** (desktop + mobile browser) for families and caregivers
- **Admin dashboard** (web) for KindredCare operations team

Native mobile apps (iOS/Android) deferred to v1.1. Mobile web must be fully functional on smartphones.

---

## 3. User Personas (MVP)

### Persona 1: Family Member / Senior
- **Who**: Adult child (40-65) managing care for aging parent, OR independent senior (65+) booking help for themselves
- **Needs**: Quick access to trusted help for companionship and practical tasks
- **Technical comfort**: Moderate to low — UI must be simple, large text option, clear CTAs

### Persona 2: Gig Caregiver
- **Who**: University student, retiree, stay-at-home parent, new immigrant, career changer — anyone with time, empathy, and a clean background
- **Needs**: Flexible work, fair pay, clear gig expectations, prompt payment
- **Technical comfort**: Moderate — comfortable with gig apps (Uber, DoorDash, etc.)

### Persona 3: KindredCare Admin
- **Who**: KindredCare operations/safety team
- **Needs**: Dispute resolution, caregiver verification review, incident response, platform monitoring

**NOT in MVP**: LTC operators (deferred to v1.2).

---

## 4. Core Features (MVP Scope)

### 4.1 Accounts & Authentication
- Email + password signup
- Phone number verification (SMS OTP)
- Email verification
- Password reset flow
- Session management (Laravel session with Sanctum API tokens)
- Role-based access: `family`, `caregiver`, `admin`
- Two-factor authentication (TOTP) — optional for family, required for admin
- Account deletion / data export (PIPEDA compliance)

### 4.2 Caregiver Onboarding & Verification

**Stage 1: Profile creation**
- Full name, DOB, address, postal code, primary language, other languages
- Bio / self-introduction (200-500 chars)
- Profile photo upload (with moderation review)
- Services offered (multi-select from the MVP service taxonomy)
- Availability calendar (recurring weekly + specific date exceptions)
- Hourly rate (caregiver-set, min $18, max $50 for MVP)
- Interests and personality traits (tags from predefined list)
- Travel radius (km from home address)

**Stage 2: Verification (Basic tier only for MVP)**
- Identity verification via Veriff SDK
  - Government ID upload (passport, Ontario driver's license, or PR card)
  - Selfie with liveness detection
  - OCR extraction of ID data (name, DOB, document number, expiry)
  - Facial match confidence score
  - 95% first-attempt pass rate, 6-second average decision
- Address verification (bundled with IDV provider)
- AML/sanctions screening (via Certn)
- Basic CPIC criminal record check (via Certn API, async webhook)
- Reference check (caregiver submits 2 references; automated email questionnaire)
- Driver's license verification (only if offering transportation)
- **Status tracking**: each check shows Pending / In Progress / Cleared / Flagged

**Stage 3: Readiness dashboard**
- All verification items shown as checklist
- Caregiver cannot be booked until ALL items are `Cleared`
- "Pending VSC" badge shown if caregiver submits a Vulnerable Sector Check document (optional for MVP, improves Trust Score)

**Stage 4: Go live**
- Admin performs final approval review for first 100 caregivers (manual gatekeeping for MVP)
- After 100: auto-approval if all checks pass
- Caregiver receives "Basic Verified" badge

### 4.3 Family/Senior Onboarding
- Simplified signup (name, email, phone, postal code)
- Relationship to care recipient (self, parent, spouse, other family, friend)
- Care recipient profile (if not self):
  - Name, age, postal code, primary language
  - Interests and preferences
  - Accessibility notes (mobility aids, hearing/vision needs) — optional
- Identity verification (simplified):
  - Optional for MVP (can book with payment method verification only)
  - Required before first booking: email + phone verified + valid payment method
- Payment method: credit card (via Stripe), Apple Pay, Google Pay

### 4.4 Service Request (Family Posts a Gig)

Family flow:
1. Select service category (from MVP taxonomy)
2. Describe need (free text, 200-500 chars) + optional uploaded photo (e.g., grocery list)
3. Set location (address or "care recipient's address on file")
4. Set schedule:
   - One-time: specific date + time + duration
   - Recurring: weekly/biweekly pattern, start date, end date (optional)
5. Set preferences (all optional):
   - Gender preference
   - Language preference
   - Specific experience tags
6. Set budget (accept caregiver's rate, or propose a rate)
7. Review and post

System response:
- Generate unique gig ID
- Trigger matching engine (see 4.5)
- Show ranked list of matched caregivers OR option to "auto-book top match"

### 4.5 AI Matching Engine (MVP — Rule-Based)

> For MVP, use **rule-based matching with weighted scoring**. Machine learning feedback loop is deferred to v1.1. The architecture must support future ML enhancement.

**Hard filters (must pass):**
- Caregiver has `Basic Verified` status
- Caregiver offers the requested service category
- Caregiver is available at the requested date/time (from their calendar)
- Caregiver's service area covers the request location (within travel radius)
- Caregiver's rate is within family's budget (or family accepts caregiver's rate)
- Gender match (if family specified)
- Language match (if family specified)

**Weighted scoring (to rank qualifying caregivers):**

| Factor | Weight | Data source |
|---|---|---|
| Geographic proximity | 30% | Distance from caregiver's home to gig location (km → score) |
| Trust Score | 30% | Composite (see 4.6) |
| Interest/language overlap | 20% | Tag matching between caregiver profile and gig/family profile |
| Availability fit | 10% | How well the gig fits the caregiver's broader availability |
| Rate alignment | 10% | How close the caregiver's rate is to the family's budget |

**Output:** Top 10 caregivers ranked, shown with match score (e.g., "91% match").

Coordinator (family) can:
- Select and book directly
- Post as an open gig for any qualifying caregiver to claim
- Expand filters and re-run

### 4.6 Trust Score (MVP)

Composite score (0-100) shown on caregiver profiles:

| Component | Weight | Source |
|---|---|---|
| Verification completeness | 40% | Basic tier = 80; Basic + optional VSC document = 100 |
| Client reviews | 30% | Average rating (1-5 stars) × 20, once 3+ reviews exist |
| Reliability | 20% | On-time % + completion % (starts at 100 for new caregivers) |
| Tenure | 10% | Days active on platform (capped at 365 days for MVP) |

Caregivers with <3 reviews show as "New" with verification-based score only.

### 4.7 Booking Flow

1. Family selects caregiver from matches
2. Booking summary screen: service, date/time, duration, total estimated cost (rate × duration + 7.5% fee), caregiver profile link
3. Family confirms booking → payment authorized (not captured) via Stripe
4. Caregiver receives notification (email + SMS + in-app)
5. Caregiver accepts (within 4 hours for scheduled; within 15 min for on-demand) OR declines
6. If declined: automatically offer to next-ranked caregiver
7. If accepted: booking confirmed, both parties receive confirmation
8. Calendar events added to caregiver's dashboard

### 4.8 Electronic Visit Verification (EVV)

**On day of gig:**
1. Caregiver receives reminder (1 hour before)
2. Caregiver taps "Start Visit" in the app:
   - GPS verifies location within 200m of gig address
   - Timestamp recorded
   - If GPS fails/denies: manual check-in with flag for admin review
3. Family receives notification: "[Caregiver name] has arrived"
4. During visit:
   - Caregiver can log completed tasks (checklist generated from service category)
   - Add notes (optional, visible to family)
   - Message family via in-app chat (if needed)
5. Caregiver taps "End Visit":
   - GPS re-verified
   - Visit duration calculated
   - Visit summary generated

**Dispute handling:**
- If GPS shows caregiver >500m from gig location during "active" visit → flag for admin
- If visit duration < 50% of booked duration → admin review before payment release

### 4.9 Payment Processing

**Technology:** Stripe Connect (Standard or Express accounts for caregivers)

**Flow:**
1. On booking confirmation: family's payment method is **authorized** (hold placed, not charged)
2. On successful check-in: transaction proceeds
3. On check-out: payment is **captured** (family charged)
4. Funds enter escrow (Stripe Connect platform balance) for 24-hour hold period
5. After 24 hours (if no dispute): payment split
   - 7.5% retained by KindredCare
   - Remainder paid out to caregiver's Stripe Connect account
6. Caregiver payout to bank: Stripe standard payout schedule (2-3 business days)

**Refund / dispute:**
- Caregiver no-show: automatic 100% refund within 1 hour of scheduled start time
- Visit issues: family can open dispute within 48 hours of check-out; payment held until resolved
- Platform keeps 7.5% commission only on successful, uncontested visits

**Tax compliance:**
- Annual earnings statement generated for caregivers (for T4A filing)
- Platform issues T4A for any caregiver earning >$500/year
- GST/HST handling: deferred to v1.1 pending CRA ruling (MVP services are companionship/errands which are GENERALLY taxable — platform absorbs uncertainty by keeping gross prices inclusive)

### 4.10 Ratings & Reviews (Two-Way)

**After every completed visit:**
- Family rates caregiver (1-5 stars + optional written review)
- Caregiver rates family/gig (1-5 stars + optional written review)
- Reviews visible on profiles after the other party also rates, OR after 7 days (whichever is first)
- Both parties can flag inappropriate reviews for admin moderation

**Caregiver protections:**
- Families with ratings <3.5 average over 5+ bookings are flagged
- Retaliatory rating detection: caregiver can dispute rating with context; admin reviews

### 4.11 In-App Messaging

- Text-only messaging between family and caregiver after booking is confirmed (not before)
- All messages logged server-side (for dispute resolution + evidence preservation)
- Personal contact info (phone, email) is **auto-redacted** from messages until booking is confirmed (prevents off-platform payment arrangements)
- Photos and file attachments supported (max 5MB per file)
- Push notifications for new messages

### 4.12 Emergency / Safety Features

- **Panic button** prominent in caregiver app during active visit
  - Triggers alert to KindredCare safety team
  - Shares real-time GPS
  - Optional silent mode (no visible indication)
  - Ability to dial 911 directly
- Safety team response SLA: within 5 minutes
- **Incident reporting** form accessible from every booking (post-visit)
- **Pre-visit safety checklist** for caregivers: confirm they feel safe proceeding with the assignment

### 4.13 Admin Dashboard

For KindredCare operations team:
- User management (search, view, suspend, delete family/caregiver accounts)
- Verification review queue (pending caregiver approvals)
- Incident report queue (triage, assign, resolve)
- Dispute resolution interface (view booking details, messages, GPS data, evidence)
- Refund issuance (manual)
- Basic analytics dashboard:
  - Active caregivers / families
  - Bookings this week/month
  - Revenue (gross transaction volume, commission)
  - Trust Score distribution
  - Geographic heatmap (Durham Region)
- System alerts (GPS anomalies, flagged reviews, incident reports)
- Audit log (all admin actions timestamped and attributed)

---

## 5. Non-Functional Requirements

### 5.1 Security
- Passwords: bcrypt hashing (min 10 rounds)
- All traffic: HTTPS only (TLS 1.3)
- Sensitive data at rest: AES-256 encryption
- API rate limiting (per IP and per user)
- OWASP Top 10 protections (SQL injection, XSS, CSRF, etc.)
- Vulnerability scanning in CI/CD
- Security incident response plan documented

### 5.2 Privacy & Compliance (Canada-specific)
- **PIPEDA compliance**:
  - Designated Privacy Officer
  - Privacy policy published, linked from every page
  - Express consent flows for biometric data (ID verification)
  - Data access and deletion request handling (30-day SLA)
  - Breach notification capability (OPC within "as soon as feasible")
- **Quebec Law 25 deferred** — MVP does not launch in Quebec until Privacy Impact Assessment + CAI biometric notification complete
- **Biometric data**:
  - Raw ID images and selfies deleted after verification (or within 30 days)
  - Only verification result (pass/fail) + provider reference ID stored
- **Data retention schedule**:
  - Active accounts: retained
  - Deleted accounts: anonymized after 30 days, full purge after 7 years (tax records)
  - Messages/GPS: 180 days
  - Visit records: 7 years
  - Incident reports: indefinite (legal)

### 5.3 Performance
- Page load (P95): < 2 seconds
- API response (P95): < 500ms
- Matching engine response: < 3 seconds for 10 results
- EVV check-in success rate: > 98%
- Uptime target: 99.5% (MVP), 99.9% post-launch

### 5.4 Accessibility
- WCAG 2.1 Level AA compliance
- Large text option (for senior users)
- Keyboard navigation fully supported
- Screen reader compatible
- Bilingual UI: English + French (French deferred to v1.1 if Quebec launch not in MVP)

### 5.5 Observability
- Structured logging (JSON) with correlation IDs
- Error tracking (Sentry or equivalent)
- Application performance monitoring (Datadog, New Relic, or equivalent)
- Business metrics dashboard (bookings, revenue, Trust Score, etc.)
- Alerting on: error rate spikes, payment failures, panic button triggers

### 5.6 Scalability
- Horizontal scaling capability (stateless application servers)
- Database read replicas
- Async job processing for: background checks, OCR, email/SMS, payouts
- Target: 1,000 concurrent users, 100 concurrent bookings (MVP); 10x headroom

---

## 6. Tech Stack (Recommended)

> Stack finalized by CTO. Rationale: Laravel ships auth, queues, notifications, scheduling, and mail out of the box — faster path to MVP with fewer libraries to assemble.

### Frontend
- **Framework**: Next.js 16 (React, TypeScript)
- **Styling**: Tailwind CSS
- **Component library**: shadcn/ui or Radix
- **State management**: React Query (server) + Zustand (client)
- **Forms**: React Hook Form + Zod

### Backend
- **Framework**: Laravel 12 (PHP 8.3)
- **API style**: RESTful API (Laravel API Resources + Form Requests) + Laravel Reverb for real-time messaging/notifications
- **Authentication**: Laravel Sanctum (API tokens for mobile web + SPA authentication)
- **Queues**: Laravel Queue (Redis driver) for async jobs — verification webhooks, payouts, emails, SMS
- **Scheduling**: Laravel Task Scheduling — shift reminders, payout processing, certification expiry alerts
- **Notifications**: Laravel Notifications (email, SMS via Twilio, database, broadcast via Reverb)
- **File storage**: Laravel Filesystem (local disk for MVP — profile photos, documents)
- **Testing**: Pest PHP

### Database
- **Primary**: MySQL 8.0+ (with spatial index support for geographic queries)
- **Cache**: Redis (sessions, queues, rate limiting)
- **Search**: MySQL full-text search for MVP; Meilisearch deferred to v1.1

### Infrastructure
- **Cloud**: AWS (Toronto region — ca-central-1 for PIPEDA data residency)
- **Compute**: AWS Fargate (containers) or Laravel Forge / Laravel Vapor
- **Storage**: Local disk (server storage for MVP); S3 migration deferred to v1.1 when scaling requires it
- **CDN**: CloudFront (for static frontend assets)
- **Email**: Brevo or Resend
- **SMS**: Twilio
- **Push notifications**: Web Push API (for mobile web PWA)

### Third-Party Integrations
- **Identity verification**: Veriff (primary IDV provider)
- **Background checks**: Certn (CPIC, AML, reference checks)
- **Payments**: Stripe Connect (via Laravel Cashier + Stripe SDK)
- **Maps / geocoding**: Mapbox or Google Maps
- **Monitoring**: Sentry (via Sentry Laravel SDK) + Laravel Telescope (dev)

### CI/CD & DevOps
- **Version control**: GitHub
- **CI/CD**: GitHub Actions
- **Backend quality**: PHP CS Fixer (formatting), Larastan / PHPStan (static analysis), Pest (testing)
- **Frontend quality**: ESLint, Prettier
- **Infrastructure as code**: Terraform or AWS CDK
- **Environments**: dev, staging, production
- **Feature flags**: Laravel Pennant or self-hosted (Unleash)

---

## 7. Data Model (High-Level)

### Core Entities

```
User
  - id, email, phone, role (family/caregiver/admin), created_at, status
  - MFA settings, password hash, last_login

FamilyProfile (extends User where role=family)
  - display_name, relationship_to_recipient
  - payment_methods (Stripe customer ID)
  - care_recipients (array)

CareRecipient (may equal the family user, or a managed senior)
  - name, age, postal_code, language, interests, accessibility_notes

CaregiverProfile (extends User where role=caregiver)
  - display_name, dob, address, postal_code, geo_point
  - bio, photo_url
  - services_offered (array of service_category_ids)
  - hourly_rate, travel_radius_km
  - languages, interests, personality_tags
  - availability_schedule (JSON structure)
  - verification_status (per check)
  - trust_score (computed)
  - stripe_connect_account_id

ServiceCategory
  - id, name, tier_required (basic/enhanced/professional)
  - description, default_task_checklist

VerificationRecord
  - caregiver_id, check_type (id/cpic/aml/reference/address)
  - provider (shufti_pro/certn/etc.), provider_reference_id
  - status (pending/in_progress/cleared/flagged)
  - raw_result_encrypted, completed_at

Gig (Service Request)
  - id, family_id, care_recipient_id
  - service_category_id, description, location_address, geo_point
  - scheduled_start, scheduled_end, is_recurring
  - recurrence_pattern, status
  - preferences (JSON: gender, language, rate_range)

Booking
  - id, gig_id, caregiver_id, family_id
  - status (pending/confirmed/active/completed/cancelled/disputed)
  - rate, platform_fee_pct, total_amount
  - stripe_payment_intent_id
  - check_in_timestamp, check_in_geo
  - check_out_timestamp, check_out_geo
  - tasks_completed (JSON), caregiver_notes
  - family_rating, family_review, caregiver_rating, caregiver_review

Message
  - id, booking_id, sender_id, receiver_id
  - content, attachments, sent_at, read_at

Incident
  - id, reporter_id, booking_id, type (safety/abuse/property/other)
  - description, severity, status, resolution, created_at

AdminAuditLog
  - admin_id, action, target_type, target_id, metadata, timestamp
```

### Geographic Queries
Use MySQL spatial functions for:
- "Caregivers within X km of gig location" — `ST_Distance_Sphere()` with SPATIAL INDEX on geo columns
- Service area bounding box queries (future: complex service boundaries)
- Distance calculations for matching score

---

## 8. API Surface (Key Endpoints)

Full OpenAPI spec to be written in design phase. High-level surface:

**Auth**: `POST /auth/signup`, `/auth/login`, `/auth/verify-phone`, `/auth/reset-password`

**Profiles**: `GET/PATCH /me`, `GET /caregivers/:id`, `GET /caregivers?filters`

**Caregiver verification**:
`POST /verification/id-document` (returns Veriff session URL)
`POST /verification/webhook/veriff` (webhook receiver)
`POST /verification/cpic` (initiate Certn check)
`POST /verification/webhook/certn`
`GET /verification/status`

**Gigs**: `POST /gigs`, `GET /gigs`, `GET /gigs/:id`, `POST /gigs/:id/matches`

**Bookings**: `POST /bookings`, `GET /bookings`, `PATCH /bookings/:id/accept`, `/decline`, `/check-in`, `/check-out`, `/cancel`

**Payments**: `POST /payments/setup-intent`, `POST /bookings/:id/refund`, `GET /payouts`

**Messages**: `GET /bookings/:id/messages`, `POST /bookings/:id/messages`

**Ratings**: `POST /bookings/:id/review`

**Emergency**: `POST /emergency/panic` (triggers safety team alert)

**Admin**: `GET /admin/verifications/pending`, `POST /admin/verifications/:id/approve`, `/reject`, `GET /admin/incidents`, etc.

---

## 9. Third-Party Integration Spec

### 9.1 Veriff (Identity Verification)
- Server-side API for session creation (REST with HMAC-SHA256 signature)
- Web SDK embedded in caregiver onboarding flow
- Webhook endpoint for verification results
- Data handling: raw documents never stored on KindredCare servers (Veriff-hosted), only verification result (pass/fail) + reference ID stored
- Sandbox: free 15-day trial, 50 sessions, no credit card required
- Pricing: $0.80-$1.89 USD per verification
- Supports: PASSPORT, DRIVERS_LICENSE, RESIDENCE_PERMIT, ID_CARD for Canada

### 9.2 Certn (Background Checks)
- OAuth 2.0 authentication
- API calls for: identity verification, basic CPIC, AML screening, reference checks
- Webhook endpoint for async results
- Package: Essential tier for MVP
- Pricing: ~$35 per caregiver pipeline

### 9.3 Stripe Connect
- Platform account (KindredCare) with Connect enabled
- Caregivers onboard to Stripe Connect Express accounts
- Family payments via Stripe Payment Intents
- Platform fee: 7.5% via `application_fee_amount`
- Payouts: scheduled (Stripe default) or manual
- Webhook endpoints for: payment success, payment failure, dispute, payout

### 9.4 Twilio (SMS)
- Phone verification OTP
- Booking confirmations
- Shift reminders
- Emergency notifications

### 9.5 Mapbox (Maps & Geocoding)
- Address autocomplete
- Geocoding (address → lat/long)
- Distance matrix (caregiver home → gig location)
- Static map images for booking confirmations

---

## 10. Success Metrics (MVP Launch → 6 Months)

### Leading indicators (Months 1-2)
- 50+ caregivers signed up
- 30+ caregivers fully verified
- 20+ family signups
- First 10 completed bookings

### Lagging indicators (Months 3-6)
- 100+ verified caregivers
- 75+ active families
- 200+ completed bookings/month
- Average booking rating: >= 4.5/5
- Caregiver retention (30-day): >= 80%
- Family repeat booking rate: >= 50%
- Net Promoter Score (NPS): >= 50
- Zero major safety incidents (abuse, injury)
- Payment dispute rate: < 5%

### Technical metrics
- System uptime: >= 99.5%
- Page load P95: < 2s
- Booking completion rate (post-confirmation): >= 90%
- Caregiver verification completion rate: >= 70%

---

## 11. Launch Checklist

### Pre-launch (Legal & Compliance)
- [ ] KindredCare incorporated (Ontario) — Corporation structure per business plan
- [ ] Terms of Service drafted by Canadian lawyer (platform liability focus)
- [ ] Privacy Policy drafted (PIPEDA compliance)
- [ ] Designated Privacy Officer appointed
- [ ] Service Level Agreement (SLA) template for premium customers
- [ ] Platform liability insurance purchased:
  - [ ] Commercial General Liability ($5M)
  - [ ] Professional Liability / E&O ($2M)
  - [ ] Cyber Liability ($2M)
  - [ ] Directors & Officers ($1M)
- [ ] CRA business number registered
- [ ] Stripe Connect application approved
- [ ] CRA GST/HST ruling request submitted (non-blocking for MVP — can operate while pending)

### Pre-launch (Technical)
- [ ] All MVP features implemented and tested
- [ ] Penetration test completed, critical issues resolved
- [ ] Load testing: sustain 100 concurrent bookings
- [ ] Disaster recovery plan documented and tested
- [ ] Monitoring and alerting configured
- [ ] Admin team trained on dashboard and incident response
- [ ] Runbooks for: payment failures, GPS failures, verification webhooks, emergency alerts

### Pre-launch (Operations)
- [ ] Safety team on-call rotation established (24/7 for panic button)
- [ ] Incident response playbook finalized
- [ ] Certn and Veriff contracts signed, API credentials provisioned
- [ ] First 10 caregivers recruited and verified (seed supply)
- [ ] First 5 beta families identified (seed demand)
- [ ] Customer support email + phone line live
- [ ] Partnership with Spark Centre for local launch events

### Soft launch (Week 1-4)
- [ ] Invite-only beta in Durham Region
- [ ] Weekly feedback sessions with beta users
- [ ] Bug triage and rapid iteration
- [ ] Safety incidents: zero tolerance, immediate response

### Public launch (Month 2)
- [ ] Marketing campaign per business plan Advertising & Promotion section:
  - [ ] Press release
  - [ ] SEO-optimized landing pages
  - [ ] Google Ads + Facebook campaigns targeting Durham Region
  - [ ] Partnerships with Durham College, Ontario Tech University (caregiver supply)
  - [ ] Outreach to Durham Region senior associations
- [ ] Caregiver referral program ($25/successful referral)
- [ ] Family referral program ($20 first-booking credit)

---

## 12. Out of Scope (Deferred to v1.1+)

Explicitly not in MVP (documented so they are not forgotten):

### v1.1 Candidates
- Enhanced and Professional verification tiers
- Personal care, medication reminders, mobility assistance
- Dementia/Alzheimer's chronic disease specialization
- Native iOS and Android apps
- French language UI
- Quebec market launch (requires Law 25 compliance + CAI biometric notification)
- Machine learning feedback loop for matching
- Caregiver gamification (badges, points, milestones)
- Career progression tracking
- Video KYC option for seniors
- Live video health check-ins

### v1.2 Candidates
- LTC operator on-demand staffing ($240/month subscription)
- BC and Alberta provincial expansion
- Palliative / end-of-life care services
- Respite care matching
- Integration with existing agency software (AxisCare, CareSmartz360)

### v2.0+ Candidates
- Remote health monitoring integration (vital signs, heart rate, etc.)
- Chatbot onboarding (mentioned in business plan)
- Ontario Health Team partnerships
- Health Technologies Fund / CAN Health Network pursuit
- AI-powered care plan generation

---

## 13. Risks & Mitigations

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Cold-start two-sided marketplace | High | High | Seed supply-side first (10 caregivers before marketing). Hyper-local launch reduces chicken-and-egg. Offer first-booking credit to families. |
| Caregiver verification friction → low conversion | High | Medium | Simplified Basic tier. Admin-supported onboarding for first 100 caregivers. Clear progress indicators. |
| Safety incident in first months | Critical | Low-Medium | Basic tier excludes personal care (lower risk services only). Panic button + 24/7 safety team from day 1. Mandatory Certn CPIC. |
| Stripe Connect approval delay | Medium | Medium | Apply during dev phase, not at launch. Have backup plan (manual payouts via Interac e-Transfer as temporary measure). |
| Certn / Veriff integration delays | Medium | Low | Sandbox testing early in dev phase. Have backup provider identified (ShuftiPro for IDV if Veriff doesn't work out, Sterling for background). |
| Gig worker misclassification (DPWRA prescribed service addition) | Medium | Low-Medium | Monitor Ontario regulations quarterly. Build flexibility into pay/rating systems to accommodate future compliance. |
| Low marketing conversion | Medium | Medium | Partner with Spark Centre for community events. Leverage founders' immigrant networks. Referral programs both sides. |
| Payment disputes | Medium | Medium | Clear refund policy in ToS. Hold funds in escrow for 24hr before payout. GPS + EVV creates strong evidence trail. |

---

## 14. Team & Responsibilities

Per `final-thoughts.md` and business plan:

| Role | Person | MVP Responsibility |
|---|---|---|
| CEO | Sarmin Akter | Caregiver recruitment, community outreach, agency/association partnerships, policy |
| COO | Dr. Tanzila Rawnuck | Service taxonomy validation, healthcare contacts, quality standards, LTC relationship seeding (for v1.2) |
| CFO | MD Jahangir Alom | Stripe Connect setup, payment infrastructure, IRAP/SR&ED applications, CRA compliance, insurance procurement |
| CTO | New hire (20yr) | Architecture, team leadership, Certn/Veriff integration, matching engine, all MVP technical execution |

### Additional Hires (MVP Period)
- 1 Full-stack engineer (contract, 6-month engagement)
- 1 Part-time safety/operations lead (for verification review and incident response)
- Part-time designer (UI/UX for 2 months)

---

## 15. Budget Estimate

| Line Item | 6-Month MVP Cost (CAD) |
|---|---|
| CTO salary (equity-weighted, reduced cash) | $36,000 |
| Full-stack contractor | $48,000 |
| Designer (part-time, 2mo) | $8,000 |
| Safety/ops lead (part-time) | $12,000 |
| AWS infrastructure | $6,000 |
| Stripe fees (gross of transaction volume) | Variable |
| Certn (per-check, pass-through to caregivers) | Pass-through |
| Veriff | $2,000 |
| Twilio, Mapbox, SES | $1,500 |
| Monitoring (Sentry, Datadog) | $3,000 |
| Legal (ToS, privacy policy, lawyer review) | $10,000 |
| Insurance (first year policies) | $8,000 |
| Marketing (Phase 1 launch) | $24,000 |
| Contingency (15%) | $24,000 |
| **Total** | **~$183,000** |

**Funding sources:**
- Co-founder investment: $200K
- NRC IRAP (apply Month 1): $250-500K
- SR&ED tax credits: claimed annually (35% federal + 10% Ontario on R&D)

Net runway after MVP launch: positive, assuming IRAP approval.

---

## 16. Timeline

| Phase | Duration | Key Deliverables |
|---|---|---|
| **Design & setup** | Weeks 1-4 | Infrastructure provisioned, CI/CD pipeline, design system, API spec, Certn/Veriff contracts |
| **Core build** | Weeks 5-16 | Auth, profiles, verification flow, matching engine, booking, payments, EVV, messaging |
| **Admin & safety** | Weeks 17-20 | Admin dashboard, incident flow, panic button, moderation tools |
| **Hardening** | Weeks 21-24 | Security audit, load testing, accessibility audit, docs |
| **Beta (soft launch)** | Weeks 25-28 | Invite-only Durham Region beta, 20 caregivers + 10 families |
| **Public launch** | Week 29+ | Marketing kick-off, open registration |

**Total build time: ~7 months from kickoff to public launch.**

---

## 17. Open Questions (Need Decisions)

These require stakeholder decisions before or during build:

1. ~~**Tech stack final choice**~~: **DECIDED** — Laravel 12 (PHP 8.3) + MySQL 8.0+ + Next.js 16 frontend
2. **Hosting region**: AWS ca-central-1 (Toronto) vs Montreal — tied to Quebec expansion timeline
3. ~~**ShuftiPro vs Veriff**~~: **DECIDED** — Veriff as primary IDV provider ($0.80-$1.89/check, 95% pass rate, free sandbox). ShuftiPro as backup if needed.
4. **Caregiver insurance**: Required as part of onboarding, OR optional with discount? Recommend requiring basic CGL ($2M) as mandatory — need to finalize group rate with Zensurance or Duuo
5. **Transportation services in MVP?**: Included in scope above but commercial auto insurance is complex — may need to defer to v1.1
6. **LTC operator portal**: Per business plan, $240/mo subscription is a meaningful revenue stream (~20%) — confirmed deferred to v1.2 OR is there pressure to include in MVP?
7. **Chatbot onboarding**: Mentioned in business plan — deferred or included? Recommend deferring; use standard forms for MVP
8. **T4A / GST-HST handling**: Tax compliance complexity — recommend engaging accountant early; ok to defer GST/HST to v1.1

---

## 18. Appendix: Alignment with Source Documents

**`final-thoughts.md` alignment:**
- ✅ Gig marketplace model (not B2B agency tool)
- ✅ 7.5% commission (matches final doc and business plan)
- ✅ Phase 1 marketing focus: non-medical gig services in Durham Region
- ⚠️ Final doc says "build everything at once" — MVP deliberately scopes this down. Architecture supports future expansion without re-architecture, but features are scoped to Basic tier only. CTO to validate this trade-off.

**`platform-workflow.md` alignment:**
- ✅ Caregiver onboarding flow (Stage 2 in workflow doc → Section 4.2 here)
- ✅ AI matching with hard filters + weighted scoring (Section 4.5)
- ✅ EVV with GPS check-in/check-out (Section 4.8)
- ✅ Payment flow per visit (Section 4.9)
- ⚠️ Workflow doc shows chronic disease tagging — deferred to v1.1 for MVP
- ⚠️ Workflow doc shows LTC operator flow — deferred to v1.2

**`business-plan.pdf` alignment:**
- ✅ AI-powered matching (core differentiator)
- ✅ OCR + eKYC (Veriff) for caregiver verification
- ✅ Electronic Visit Verification (EVV)
- ✅ Payment processing (Stripe)
- ✅ Trust Score / verification badge
- ✅ Rating and review system
- ✅ 7.5% commission + $240/mo LTC subscription
- ⚠️ Remote health monitoring deferred (v2.0 per business plan "future development")
- ⚠️ Chatbot onboarding deferred (v1.1)
- ⚠️ LTC subscription deferred to v1.2 (business plan lists it as 20% of revenue — important to add early but non-blocking for MVP hypothesis)

---

*This document is the source of truth for MVP scope. Any scope change must be reviewed and approved by CEO + CTO and documented here.*
