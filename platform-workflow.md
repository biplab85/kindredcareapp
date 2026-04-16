# KindredCare Platform: End-to-End Workflow

## How the Caregiver Matching/Recruitment Engine Works

This document describes the step-by-step process for how agencies, caregivers, and seniors interact with the KindredCare platform, and how it integrates with agencies' existing tools.

---

## The Four User Personas

| Persona | Who They Are | What They Need |
|---|---|---|
| **Agency Admin / Coordinator** | The scheduling coordinator or owner at a small/mid home care agency (10-50 caregivers) | Faster recruitment, better matching, less manual work |
| **Caregiver** | PSW, home support worker, or nurse aide seeking work | Find work quickly, smooth onboarding, fair assignments |
| **Senior / Family Member** | End recipient of care (interacts through the agency, not directly with KindredCare in the B2B model) | Quality caregiver, consistency, safety |
| **LTC Operator** | Long-term care facility manager needing staff | Fill shifts fast, reduce turnover, compliance tracking |

---

## Step-by-Step Process

### STAGE 1: Agency Onboarding (One-Time Setup)

```
Agency discovers KindredCare
        |
        v
[1.1] Agency signs up (web portal)
        |
        v
[1.2] Agency imports existing data
        |   - Client roster (names, locations, care needs, schedules)
        |   - Existing caregiver pool (names, skills, certifications, availability)
        |   - Import via: CSV upload, API sync, or manual entry
        |
        v
[1.3] Agency configures preferences
        |   - Service area (geographic boundaries)
        |   - Shift types (hourly, live-in, overnight)
        |   - Required certifications by service type
        |   - Provincial compliance rules (auto-loaded for Ontario, BC, etc.)
        |   - Pay rate ranges
        |
        v
[1.4] Integration setup (if applicable)
        |   - Connect to AxisCare / CareSmartz360 via REST API
        |   - Connect to QuickBooks / payroll via integration
        |   - Connect to Certn for background checks
        |   - OR operate standalone (for agencies on spreadsheets)
        |
        v
[Agency is live]
```

**Integration Details:**

| Agency's Current Tool | How KindredCare Connects |
|---|---|
| Spreadsheets / paper | KindredCare becomes the primary system. CSV import for initial data. |
| AxisCare | REST API sync -- client/caregiver data flows bidirectionally. KindredCare handles recruitment + matching; AxisCare handles scheduling + billing. |
| CareSmartz360 | Open API integration -- same as AxisCare pattern. |
| AlayaCare | API + SQS event streaming. Less likely target (enterprise), but possible as a plugin. |
| ShiftCare | Limited API -- CSV-based sync or built-in connector if available. |
| No software at all | KindredCare is their first platform. Includes basic scheduling + matching. |

---

### STAGE 2: Caregiver Registration & Verification

```
Caregiver discovers KindredCare
(via agency invitation link, job board, immigration portal, or direct)
        |
        v
[2.1] Caregiver creates profile
        |   - Personal info (name, location, languages spoken)
        |   - Work preferences (full-time/part-time, shift types, travel radius)
        |   - Availability calendar (recurring weekly schedule + exceptions)
        |
        v
[2.2] Skills & experience tagging
        |   - Certifications (PSW, First Aid, CPR, CNA, etc.)
        |   - Upload certificates (OCR auto-extracts details)
        |   - Chronic disease experience tags:
        |       [ ] Alzheimer's/Dementia
        |       [ ] Diabetes management
        |       [ ] Cardiovascular care
        |       [ ] Palliative/end-of-life
        |       [ ] Mobility/transfer assistance
        |       [ ] Wound care
        |       [ ] Mental health support
        |   - Years of experience per condition
        |   - Personality traits (selected from predefined options)
        |   - Personal interests (for companionship matching)
        |
        v
[2.3] Background verification (automated via Certn API)
        |   - CPIC Criminal Record Check (initiated automatically)
        |   - Vulnerable Sector Check (flagged if required by province)
        |   - eKYC identity verification:
        |       - Document upload (passport, driver's license)
        |       - OCR extracts and validates document data
        |       - Facial verification (selfie vs document photo)
        |       - Address verification
        |   - AML screening (optional, recommended)
        |   - Results returned via webhook (typically 3-7 days for CPIC)
        |   - Status tracked in real-time: Pending -> In Progress -> Cleared / Flagged
        |
        v
[2.4] Reference check tracking
        |   - Caregiver submits 2+ professional references
        |   - System sends automated reference request emails
        |   - References complete a short online form
        |   - Status: Pending -> Completed
        |
        v
[2.5] Readiness score calculated
        |   - All pre-employment requirements tracked on a single dashboard:
        |       [x] Profile complete
        |       [x] Certifications uploaded and verified
        |       [x] Background check cleared
        |       [x] References completed
        |       [x] Availability set
        |       [ ] Orientation completed (agency-specific)
        |   - Caregiver is "Ready to Match" only when all items are green
        |   - KindredCare Trust Score assigned (composite of verifications + reviews over time)
        |
        v
[Caregiver enters the matchable pool]
```

**For International Caregivers (Immigration Module):**

```
[2.6] Immigration pathway support (optional module)
        |   - Track immigration application status
        |   - Credential recognition guidance (province-specific)
        |   - Language assessment tracking (CLB Level 4+ required)
        |   - LMIA status tracking (if applicable)
        |   - Auto-flag when caregiver becomes work-authorized
        |   - Connect with agencies that have open positions matching their profile
```

---

### STAGE 3: Client Intake (Agency Enters Care Needs)

```
Agency receives a new client (senior needing care)
        |
        v
[3.1] Client profile creation
        |   - Demographics (age, gender, location, language)
        |   - Living situation (in-home, LTC facility, assisted living)
        |   - Emergency contacts / family members
        |
        v
[3.2] Care needs assessment
        |   - Primary conditions (tagged from same taxonomy as caregivers):
        |       [x] Alzheimer's/Dementia (Stage: Early / Moderate / Advanced)
        |       [x] Diabetes (Type 1 / Type 2)
        |       [ ] Cardiovascular
        |       [ ] Mobility issues
        |       etc.
        |   - Required services:
        |       [x] Personal care (bathing, dressing, grooming)
        |       [x] Medication reminders
        |       [x] Meal preparation
        |       [ ] Transportation
        |       [ ] Companionship
        |       [ ] Light housekeeping
        |       [ ] Wound care
        |       etc.
        |   - Required certifications (auto-suggested based on conditions)
        |   - Cognitive status / behavioral notes
        |
        v
[3.3] Schedule requirements
        |   - Days and times needed (e.g., Mon/Wed/Fri 9am-1pm)
        |   - Duration per visit
        |   - Recurring vs one-time
        |   - Start date and estimated end date
        |
        v
[3.4] Preferences (soft criteria)
        |   - Gender preference
        |   - Language / cultural preferences
        |   - Personality preferences (quiet/chatty, structured/flexible)
        |   - Specific interests for companionship (gardening, music, puzzles)
        |   - Continuity preference (same caregiver each visit vs flexible)
        |
        v
[Client profile is ready for matching]
```

**If agency uses AxisCare/CareSmartz360**: Client data syncs automatically via API. No double-entry needed.

---

### STAGE 4: AI-Powered Matching (The Core Engine)

This is where KindredCare's primary value lives. When an agency needs to fill a care assignment, the AI matching engine runs:

```
[4.1] Match request triggered
        |   - Agency clicks "Find Caregivers" for a client
        |   - OR a new client is entered and auto-match is enabled
        |   - OR an existing caregiver cancels and a replacement is needed
        |
        v
[4.2] AI matching algorithm runs
        |
        |   HARD FILTERS (must pass -- eliminates non-qualifying caregivers):
        |   ├── Is the caregiver "Ready to Match"? (all verifications complete)
        |   ├── Does the caregiver have required certifications?
        |   ├── Is the caregiver available during required hours?
        |   ├── Is the caregiver within the service area / travel radius?
        |   └── Does the caregiver meet any mandatory requirements (gender, language)?
        |
        |   WEIGHTED SCORING (ranks qualifying caregivers):
        |   ├── Condition experience match (40% weight)
        |   │     How closely does caregiver's chronic disease experience
        |   │     align with client's conditions? Years of experience matters.
        |   │     Example: Client has moderate Alzheimer's -- caregivers with
        |   │     3+ years dementia experience score highest.
        |   │
        |   ├── Geographic proximity (20% weight)
        |   │     Calculated commute time (not just distance).
        |   │     Shorter commute = higher score.
        |   │     Reduces "windshield time" which is a major retention factor.
        |   │
        |   ├── Continuity of care (15% weight)
        |   │     Has this caregiver served this client before?
        |   │     Continuity strongly correlates with client satisfaction.
        |   │
        |   ├── Personality & interest compatibility (10% weight)
        |   │     Matching personality traits and shared interests.
        |   │     Example: Client enjoys gardening + caregiver lists gardening
        |   │     as an interest = higher compatibility score.
        |   │
        |   ├── Trust Score (10% weight)
        |   │     Composite score from: verification level, past reviews,
        |   │     on-time rate, assignment completion rate.
        |   │
        |   └── Schedule optimization (5% weight)
        |         Does this assignment help the caregiver reach their
        |         preferred weekly hours without triggering overtime?
        |         Does it minimize gaps between assignments?
        |
        v
[4.3] Ranked results presented to coordinator
        |
        |   ┌─────────────────────────────────────────────────────┐
        |   │  MATCH RESULTS for: Mrs. Chen (Alzheimer's, Moderate) │
        |   │  Schedule: Mon/Wed/Fri 9am-1pm, Markham ON           │
        |   ├─────────────────────────────────────────────────────┤
        |   │  #1  Sarah M.  ── Match: 94%                        │
        |   │      5 yrs dementia exp | 8 min commute              │
        |   │      Trust Score: 4.8/5 | Previously served client   │
        |   │      [View Profile] [Assign] [Skip]                  │
        |   ├─────────────────────────────────────────────────────┤
        |   │  #2  Priya K.  ── Match: 87%                        │
        |   │      3 yrs dementia exp | 15 min commute             │
        |   │      Trust Score: 4.6/5 | Speaks Cantonese           │
        |   │      [View Profile] [Assign] [Skip]                  │
        |   ├─────────────────────────────────────────────────────┤
        |   │  #3  James T.  ── Match: 81%                        │
        |   │      2 yrs dementia exp | 12 min commute             │
        |   │      Trust Score: 4.5/5 | New to agency              │
        |   │      [View Profile] [Assign] [Skip]                  │
        |   └─────────────────────────────────────────────────────┘
        |
        |   The coordinator reviews AI recommendations but retains
        |   final decision authority. They can:
        |   - Assign the top match
        |   - Override and pick a different caregiver (with reason logged)
        |   - Post as an open shift for caregivers to claim
        |   - Request more matches (expand search radius / relax criteria)
        |
        v
[4.4] Assignment confirmed
        |   - Caregiver receives notification (push notification / SMS / email)
        |   - Caregiver accepts or declines
        |   - If declined, next-ranked caregiver is offered
        |   - If accepted, assignment is locked in
        |
        v
[Assignment syncs to agency's scheduling system via API]
```

**How the AI Improves Over Time:**

```
[4.5] Machine learning feedback loop
        |
        |   After each assignment, the system collects:
        |   - Did the caregiver complete the assignment? (yes/no)
        |   - Client satisfaction rating (1-5)
        |   - Caregiver satisfaction rating (1-5)
        |   - Was the caregiver on time? (EVV data)
        |   - Did the client request this caregiver again?
        |   - How long did the caregiver stay with this client?
        |
        |   This data feeds back into the matching algorithm:
        |   - Successful pairings increase similar match scores
        |   - Personality compatibility weights are refined
        |   - Commute tolerance thresholds are learned per caregiver
        |   - Condition-specific competency scores are validated
        |
        |   Over time, the algorithm learns what makes a
        |   successful caregiver-client pairing in each agency's
        |   specific context.
```

---

### STAGE 5: Service Delivery & Visit Verification

```
Day of the scheduled visit
        |
        v
[5.1] Caregiver receives shift reminder
        |   - Push notification 1 hour before shift
        |   - Includes: client name, address, care notes, special instructions
        |   - Navigation link to client location
        |
        v
[5.2] Check-in (Electronic Visit Verification)
        |   - Caregiver opens KindredCare app at client location
        |   - GPS verifies location matches client's address
        |   - Caregiver taps "Check In"
        |   - Timestamp and location recorded
        |   - (Optional) Family member receives notification: "Your caregiver has arrived"
        |
        v
[5.3] During visit
        |   - Caregiver can log tasks completed:
        |       [x] Medication reminder given
        |       [x] Meal prepared
        |       [x] Personal care assistance
        |       [x] Light housekeeping
        |       [ ] Notes: "Client was in good spirits, ate well"
        |   - Emergency alert button available
        |   - Caregiver can message coordinator through app if issues arise
        |
        v
[5.4] Check-out
        |   - Caregiver taps "Check Out"
        |   - GPS re-verifies location
        |   - Total hours auto-calculated
        |   - Visit summary generated:
        |       Start: 9:02 AM | End: 1:05 PM | Duration: 4h 3m
        |       Tasks: 4/5 completed
        |       Notes: "Client was in good spirits"
        |
        v
[5.5] Data flows automatically
        |
        |   ┌──────────────────┐     ┌──────────────────┐
        |   │  Agency's system  │     │   KindredCare    │
        |   │  (AxisCare, etc.) │◄────│   Visit Data     │
        |   │                   │     │                  │
        |   │  - Schedule       │     │  - Hours worked  │
        |   │    updated        │     │  - Tasks logged  │
        |   │  - Timesheet      │     │  - GPS verified  │
        |   │    populated      │     │  - Care notes    │
        |   └────────┬─────────┘     └──────────────────┘
        |            │
        |            v
        |   ┌──────────────────┐
        |   │    QuickBooks /   │
        |   │    Payroll        │
        |   │                   │
        |   │  - Invoice to     │
        |   │    client/funder  │
        |   │  - Payroll to     │
        |   │    caregiver      │
        |   └──────────────────┘
```

**Note on EVV in Canada:** EVV is NOT mandated in any Canadian province (unlike the US 21st Century Cures Act). However, it provides operational value for: accurate timesheets, reduced payroll disputes, family transparency, and quality assurance. Position it as an operational tool, not a compliance requirement.

---

### STAGE 6: Ongoing Management & Retention

```
[6.1] Dashboard for Agency Coordinator
        |
        |   ┌─────────────────────────────────────────────────────────┐
        |   │  KindredCare Agency Dashboard                           │
        |   ├─────────────────────────────────────────────────────────┤
        |   │                                                          │
        |   │  RECRUITMENT PIPELINE                                    │
        |   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
        |   │  │ New  │→│Screen│→│B.Check│→│Onboard│→│Active│          │
        |   │  │  12  │ │   8  │ │   5  │ │   3  │ │  42  │          │
        |   │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │
        |   │                                                          │
        |   │  TODAY'S ASSIGNMENTS                                     │
        |   │  28 shifts scheduled | 26 confirmed | 2 need coverage    │
        |   │  [View Open Shifts]                                      │
        |   │                                                          │
        |   │  ALERTS                                                  │
        |   │  ! 3 caregiver certifications expiring this month        │
        |   │  ! 1 background check result pending review              │
        |   │  ! 2 new caregiver applications received                 │
        |   │                                                          │
        |   │  RETENTION METRICS                                       │
        |   │  30-day retention: 88% (industry avg: 43%)               │
        |   │  90-day retention: 76% (industry avg: 33%)               │
        |   │  Avg client satisfaction: 4.6/5                          │
        |   │  Avg caregiver satisfaction: 4.3/5                       │
        |   │                                                          │
        |   └─────────────────────────────────────────────────────────┘
        |
        v
[6.2] Caregiver retention features
        |   - Gamified milestones (badges for: 10 shifts, 50 shifts, 100 shifts)
        |   - Points for: on-time arrivals, positive reviews, picking up open shifts
        |   - 30/60/90-day check-in reminders for coordinators
        |   - Satisfaction surveys sent to caregivers after shifts
        |   - Career progression tracking (certifications earned, skills developed)
        |   - Peer community / messaging between caregivers at the same agency
        |
        v
[6.3] Compliance tracking
        |   - Automated alerts when certifications are expiring
        |   - Provincial regulation tracking (auto-updated)
        |   - PIPEDA compliance tools for data handling
        |   - Annual earning statements generated for caregiver tax filing
        |   - Audit trail for all background checks and verifications
        |
        v
[6.4] Analytics & reporting
        |   - Recruitment funnel metrics (time-to-hire, cost-per-hire, source effectiveness)
        |   - Matching quality metrics (client satisfaction by match score)
        |   - Retention analytics (turnover by tenure, reason codes)
        |   - Financial metrics (revenue per caregiver, cost per visit)
        |   - Exportable reports for agency management
```

---

## System Architecture: How It All Connects

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KINDREDCARE PLATFORM                         │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  RECRUITMENT │  │  AI MATCHING │  │    EVV &    │                │
│  │   ENGINE     │  │    ENGINE    │  │  VISIT MGT  │                │
│  │             │  │             │  │             │                │
│  │ - Job posts  │  │ - Hard filter│  │ - GPS check │                │
│  │ - Applicant  │  │ - Weighted   │  │   in/out    │                │
│  │   tracking   │  │   scoring    │  │ - Task log  │                │
│  │ - Screening  │  │ - ML feedback│  │ - Visit     │                │
│  │ - Onboarding │  │   loop       │  │   summary   │                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │
│         │                │                │                        │
│  ┌──────┴────────────────┴────────────────┴──────┐                 │
│  │              SHARED DATA LAYER                 │                 │
│  │                                                │                 │
│  │  Caregiver Profiles | Client Profiles          │                 │
│  │  Skills Taxonomy | Chronic Disease Tags        │                 │
│  │  Availability | Assignments | Visit History    │                 │
│  │  Trust Scores | Satisfaction Data              │                 │
│  └───────────────────┬───────────────────────────┘                 │
│                      │                                              │
│  ┌───────────────────┴───────────────────────────┐                 │
│  │              INTEGRATION LAYER (APIs)          │                 │
│  └──┬──────┬──────┬──────┬──────┬──────┬────────┘                 │
│     │      │      │      │      │      │                           │
└─────┼──────┼──────┼──────┼──────┼──────┼───────────────────────────┘
      │      │      │      │      │      │
      v      v      v      v      v      v
  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
  │Axis  ││Care  ││Certn ││Quick ││Indeed││Alaya │
  │Care  ││Smartz││(BG   ││Books ││(Job  ││Care  │
  │      ││360   ││Check)││      ││Board)││      │
  │Sched-││Sched-││      ││Pay-  ││      ││Enter-│
  │uling ││uling ││CPIC  ││roll/ ││Post- ││prise │
  │& Bill││& Bill││eKYC  ││Invoice││ings ││(API) │
  └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘

  Agency's existing        Third-party        Job boards
  management system         services          & channels
```

### Integration Patterns by Agency Size

**Pattern A: Agency on Spreadsheets (smallest agencies)**
```
KindredCare IS the system
        |
        ├── Recruitment: fully in KindredCare
        ├── Matching: fully in KindredCare
        ├── Scheduling: basic scheduling in KindredCare
        ├── EVV: KindredCare mobile app
        ├── Background checks: Certn via KindredCare
        ├── Billing: CSV export to QuickBooks
        └── Communication: KindredCare messaging + SMS
```

**Pattern B: Agency with AxisCare / CareSmartz360 (mid-size)**
```
KindredCare handles recruitment + matching
AxisCare/CareSmartz360 handles scheduling + billing
        |
        ├── New caregiver recruited in KindredCare
        ├── Once "Ready to Match," profile syncs to AxisCare via API
        ├── Client data syncs FROM AxisCare TO KindredCare
        ├── KindredCare runs match, recommends caregivers
        ├── Coordinator approves match
        ├── Assignment syncs BACK to AxisCare for scheduling
        ├── EVV data flows from KindredCare app to AxisCare
        └── AxisCare handles billing/payroll as usual
```

**Pattern C: Agency with AlayaCare (larger agencies)**
```
KindredCare as a recruitment/matching plugin
AlayaCare handles everything else
        |
        ├── KindredCare provides AI matching engine via API
        ├── AlayaCare calls KindredCare's matching API
        ├── Results displayed within AlayaCare's interface
        ├── All other operations remain in AlayaCare
        └── KindredCare charges per-match or monthly API fee
```

---

## Complete Journey Example

**Scenario: Durham Home Care (25 caregivers) needs to fill a new client assignment**

```
DAY 1: Client Intake
  Agency receives referral for Mrs. Patel, 78, moderate Alzheimer's
  Coordinator enters client profile in KindredCare:
  - Location: Ajax, ON
  - Conditions: Alzheimer's (moderate), Type 2 diabetes
  - Needs: Personal care, medication reminders, meal prep
  - Schedule: Mon-Fri, 8am-12pm
  - Preferences: Female caregiver, speaks Hindi or English

DAY 1: AI Matching (Existing Pool)
  KindredCare scans 25 active caregivers:
  - 8 pass hard filters (available, certified, in area)
  - Top 3 ranked by weighted scoring
  - #1 match: Anita S. (91% match, 3yr dementia exp, speaks Hindi, 10 min away)
  Coordinator assigns Anita. She accepts via app notification.

  Meanwhile, KindredCare flags: "You have 8 qualifying caregivers for this
  type of assignment. Consider recruiting 2-3 more with dementia experience
  to improve coverage."

DAY 1-2: Assignment Syncs
  Assignment details push to AxisCare (the agency's scheduling tool)
  via API. Shows up on the weekly schedule automatically.

DAY 3: First Visit
  8:00 AM - Anita receives shift reminder with Mrs. Patel's care notes
  8:02 AM - Anita arrives, opens app, taps "Check In" (GPS verified)
  8:02-11:58 - Anita provides care, logs tasks in app
  11:58 AM - Anita taps "Check Out," adds note: "Good first visit"
  12:00 PM - Visit summary auto-generated, syncs to AxisCare timesheet
  12:01 PM - Mrs. Patel's daughter receives notification: "Visit complete"

DAY 3: Parallel -- New Caregiver Recruitment
  KindredCare's recommendation triggered the coordinator to post a new
  job for dementia-experienced caregivers.

  A caregiver named Maria applies through the agency's KindredCare page.
  - Auto-screened: meets basic requirements
  - Coordinator gets notification: "New qualified applicant"
  - Within 2 hours: coordinator sends screening questions via app
  - Maria responds same day
  - Background check auto-initiated via Certn API

DAY 7: Maria's background check clears
  - All verifications complete
  - Maria marked "Ready to Match"
  - She's now in the matchable pool for future assignments
  - KindredCare already identifies 3 clients she'd be a strong match for

DAY 30: Feedback Loop
  - Anita has completed 20 visits with Mrs. Patel
  - Client satisfaction: 4.8/5
  - Caregiver satisfaction: 4.5/5
  - ML model records: "Hindi-speaking caregiver + Hindi-speaking client
    with Alzheimer's = high satisfaction" -- boosts similar matches
  - Anita earns a "30-Day Streak" badge
  - Coordinator receives retention alert: "Anita is approaching 90 days.
    Schedule a check-in to discuss her experience."
```

---

## Revenue Flow Per Transaction

```
For each visit processed through KindredCare:

  Senior/Family pays agency: $35/hour (set by agency)
         |
         v
  Agency keeps: $35/hour (their normal revenue)
  Agency pays KindredCare: $99-$199/month SaaS fee
         |
         v
  When a NEW caregiver is matched and retained 30+ days:
  Agency pays KindredCare: $25-$50 per successful match
         |
         v
  When a background check is run:
  Agency pays KindredCare: Certn cost + 20-30% markup

  KindredCare does NOT take a cut of the caregiver's pay
  KindredCare does NOT charge the senior/family directly
  KindredCare is an agency tool, not a middleman
```

---

## Key Differentiator: What Agencies Can't Do Today

| Current Reality | With KindredCare |
|---|---|
| Recruitment and operations are disconnected systems | Single pipeline from job post to first shift |
| Matching is manual (coordinator's mental model) | AI-ranked recommendations with data-driven scoring |
| Background checks are a separate manual process | Auto-initiated, tracked, and cleared in one system |
| No condition-specific matching exists | Chronic disease taxonomy with experience-weighted scoring |
| Caregiver data re-entered when moving from applicant to active | Profile flows seamlessly from recruitment to assignment |
| Average time from application to first shift: 2-4 weeks | Target: 5-7 days |
| Coordinator is the single point of failure for matching knowledge | Institutional knowledge captured in the algorithm |
| No feedback loop between match quality and future assignments | ML continuously improves matching based on outcomes |
| Retention tracking is manual or nonexistent | Automated 30/60/90 day check-ins, satisfaction tracking |
