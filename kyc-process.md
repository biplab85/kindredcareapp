# KYC & Identity Verification Process for KindredCare

## Complete Research Document: Know Your Customer (KYC) and Identity Verification for a Canadian Caregiver Gig Marketplace

**Last Updated:** February 2026
**Platform:** KindredCare -- Connecting Seniors with Caregivers in Canada
**Scope:** Verification of both caregivers AND seniors/families

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [KYC/Identity Verification Providers Available in Canada](#2-kycidentity-verification-providers-available-in-canada)
3. [Types of Verification and Their Details](#3-types-of-verification-and-their-details)
4. [Pricing Breakdown](#4-pricing-breakdown)
5. [Processing Times](#5-processing-times)
6. [Documents That CAN Be Verified](#6-documents-that-can-be-verified)
7. [Documents That CANNOT Be Verified or Have Limitations](#7-documents-that-cannot-be-verified-or-have-limitations)
8. [Canadian Legal Requirements for KYC](#8-canadian-legal-requirements-for-kyc)
9. [Recommended KYC Flow for KindredCare](#9-recommended-kyc-flow-for-kindredcare)
10. [Technical Integration Details](#10-technical-integration-details)
11. [Appendix: Sources and References](#11-appendix-sources-and-references)

---

## 1. Executive Summary

KindredCare operates as a gig marketplace connecting seniors (a legally defined "vulnerable population") with caregivers across Canada. This creates a dual verification obligation:

- **Caregivers** must undergo rigorous identity and background verification because they work with vulnerable persons
- **Seniors/families** need lighter verification for platform integrity, fraud prevention, and payment processing

### Key Findings

| Finding | Detail |
|---------|--------|
| **Recommended primary IDV provider** | Veriff (best price/performance for document + facial) or Persona (most customizable flows) |
| **Recommended background check provider** | Certn (Canadian company, CPIC access, API-first) |
| **Vulnerable Sector Checks** | Cannot be done online -- must be done in-person at local police station |
| **Cost per caregiver (full pipeline)** | Estimated $75--$150 CAD depending on check depth |
| **Cost per senior (basic verification)** | Estimated $2--$10 CAD |
| **Biggest legal risk** | Quebec's Law 25 (strictest privacy law in North America) |
| **Biggest operational challenge** | VSC processing times (4 days to 4+ months depending on jurisdiction) |
| **Global IDV cost trend** | Average $0.28/check in North America (2025), declining to $0.21 by 2029 |

---

## 2. KYC/Identity Verification Providers Available in Canada

### 2.1 Provider Comparison Table

| Provider | HQ | Focus | Canada Coverage | ID Docs Supported | Pricing Model | API | Mobile SDK |
|----------|-----|-------|----------------|-------------------|---------------|-----|------------|
| **Certn** | Victoria, BC | Background checks, CPIC, IDV | Excellent (Canadian company) | 13,500+ from 240+ countries | Per-check ($4.99--$68.95 CAD) | REST + OAuth | Web-based (limited) |
| **ShuftiPro** | London, UK | eKYC, AML, biometrics | Good (230+ countries) | 3,000+ | Custom quote | REST, webhooks | Android, iOS, Flutter, React Native |
| **Jumio** | Palo Alto, CA | Enterprise IDV, AML | Good (200+ countries) | 5,000+ templates | Custom quote (enterprise) | REST | iOS, Android |
| **Onfido** (now Entrust) | London, UK | IDV, biometrics | Good (supports Canada) | Extensive | Custom quote ($60K+ median annual) | REST | iOS, Android |
| **Persona** | San Francisco, CA | Customizable IDV workflows | Good (200+ countries) | Extensive | From $250/mo + per-check | REST, webhooks | Mobile SDK |
| **Trulioo** | Vancouver, BC | Global eIDV, KYB | Excellent (Canadian, 450+ data sources) | 14,000+ | From $99/mo + per-check | REST | iOS, Android |
| **iComply** | Vancouver, BC | KYC/AML compliance | Excellent (Canadian, FINTRAC-focused) | Supports global docs | From $1/entity/year | REST, SDKs | Embedded SDKs |
| **Veriff** | Tallinn, Estonia | Fast IDV at scale | Good (230+ countries) | 12,000+ | $0.80--$1.89/verification | REST | iOS, Android |

### 2.2 Detailed Provider Profiles

#### Certn (Victoria, BC) -- RECOMMENDED for Background Checks

**Why Certn for KindredCare:**
- Canadian company with direct CPIC database access
- Authorized to provide basic and enhanced criminal record checks
- API-first design with OAuth authentication
- Includes identity verification as a prerequisite for criminal checks
- Offers employment verification and reference checks
- Supports Quebec Court Record Check (SOQUIJ) for Quebec-specific coverage

**Key capabilities:**
- Basic Canadian Criminal Record Check (CPIC Level 1)
- Enhanced Canadian Criminal Record Check (CPIC Level 2 + PIP)
- Identity Verification (document + biometric facial recognition)
- Global Sanctions / AML screening (adverse media, sanctions lists, PEP lists, sex offender registries, terrorist lists)
- Employment Verification
- Education Verification
- Reference Checks
- Credit Reports

**Limitations:**
- Cannot perform Vulnerable Sector Checks (VSC) -- these must be done in-person at local police
- Enhanced IDV currently only available for Canada and US documents
- Mobile experience is web-based, not native SDK
- International background checks can be slow
- Per-user reviews: costs are not always known until after a check is run

**Pricing (CAD):**
- Basic CPIC: ~$29.99 + $4.99 IDV = ~$35
- Packages: Essential, Pro, Elite (contact for pricing)
- Low volume (up to 100/year): starts at $10/check
- High volume (100+/year): custom pricing
- No setup fees, no minimums

#### ShuftiPro -- RECOMMENDED for eKYC (mentioned in business plan)

**Why ShuftiPro for KindredCare:**
- Specifically mentioned in the KindredCare business plan for eKYC
- AI-powered identity verification with real-time processing
- Strong biometric capabilities (facial verification, liveness detection)
- Supports 230+ countries and 150+ languages -- critical for verifying immigrant caregivers
- Comprehensive document coverage (3,000+ document types)

**Key capabilities:**
- Facial Verification with liveness detection
- Document Verification (OCR + authenticity)
- Name, DoB, Address Verification
- 2-Factor Authentication
- Consent Verification
- AML Screening (ongoing monitoring available)
- KYB (Know Your Business) services

**Integration options:**
- Native Android, iOS, Flutter, React Native SDKs
- Web SDK (JavaScript, works in SPAs and traditional web)
- Server-side libraries: PHP, Node.js, .NET, Java, Python
- Webhook/callback support for real-time status updates
- Sandbox mode for testing

**Limitations:**
- UK-headquartered (data residency considerations under PIPEDA)
- Pricing not publicly listed
- No direct CPIC access (need separate provider for criminal checks)

#### Trulioo (Vancouver, BC)

**Why consider Trulioo:**
- Canadian company (Vancouver) -- strong data residency story
- Massive data source network (450+ sources across 195 countries)
- Can verify 5 billion+ individuals
- Electoral rolls and telco records for enhanced matching
- ISO 27001 and SOC 2 Type II certified
- No-code Workflow Studio for non-technical teams
- iBeta Level 2 biometric certification

**Key capabilities:**
- Electronic Identity Verification (eIDV) -- matches personal details against electronic data sources
- Identity Document Verification (OCR + fraud forensics + biometric selfie)
- Address cleansing and verification
- Person Match (deterministic and probabilistic)

**Limitations:**
- Difficulty with rural Canadian addresses (PO boxes, legal land descriptions, rural routes)
- Starting from $99/month before per-check costs
- Custom pricing not publicly available
- No direct criminal record check capability

#### Veriff -- RECOMMENDED for Budget-Conscious IDV

**Why Veriff for KindredCare:**
- Most transparent and competitive self-serve pricing ($0.80--$1.89/verification)
- 98% automation rate with 6-second average decision time
- 95% first-attempt pass rate (critical for senior users)
- 12,000+ documents from 230+ countries
- Free 15-day trial (50 sessions, no credit card)
- 48 languages supported
- White-label customization on Premium plan

**Pricing tiers:**
- Essential: $0.80/verification
- Plus: $1.39/verification
- Premium: $1.89/verification (includes human verification specialists)
- Enterprise: custom pricing for 1,000+/month

**Key capabilities:**
- AI + human verification specialists (Premium)
- iBeta conformant liveness detection
- Risk Insights, FaceBlock, CrossLinks for fraud detection
- Video recording for session monitoring
- PDF export, bulk data export
- Session deletion via API (PIPEDA compliance)

**Limitations:**
- No background check capability (need separate provider)
- No CPIC access
- Estonian company (data residency considerations)
- Some users report higher costs compared to simpler ID check tools

#### Persona -- RECOMMENDED for Customizable Flows

**Why Persona for KindredCare:**
- Highly customizable "Lego-like" verification flows
- No-code visual flow builder
- Can create different verification paths for caregivers vs. seniors
- Used by major gig platforms (Lyft, Etsy)
- Encrypted "Vault" for PII storage
- GDPR and ISO 27001 certified

**Pricing:**
- Free-forever plan available (limited)
- Essential: from $250/month
- Growth and Enterprise: custom pricing
- Note: Prices have increased 50%+ in recent years

**Limitations:**
- San Francisco-based (data residency considerations)
- No direct CPIC access
- Pricing trending upward

#### Jumio

**Why consider Jumio:**
- Processed 1 billion+ transactions globally
- Deepfake-resistant liveness detection
- 5,000+ ID templates across 200+ countries
- 500+ data sources for database validation
- Strong enterprise support

**Limitations:**
- No public pricing (enterprise-focused, likely expensive)
- No free plan
- End-user friction on edge-case documents
- Manual-review bottlenecks reported

#### Onfido (now Entrust IDV)

**Why consider Onfido:**
- Acquired by Entrust (April 2024) -- strong enterprise backing
- Broad document and biometric support
- Address verification for 20+ countries including Canada

**Limitations:**
- High cost barrier ($10,000+ minimum per some reports)
- Median annual spend ~$60,475
- Enterprise-focused, not ideal for startups
- Now under Entrust brand, potential service changes

#### iComply (Vancouver, BC)

**Why consider iComply:**
- Canadian company focused on FINTRAC compliance
- Edge computing for biometric processing (data stays on device)
- Military-grade encryption (TLS1.2, SSL, AES256)
- PIPEDA, GDPR, SOC2, ISO 27001 compliant
- Can reduce compliance costs by up to 90%
- One line of code integration
- $1/entity/year starting price

**Limitations:**
- Smaller company, less market presence
- Primarily focused on financial services compliance
- May be over-engineered for a care marketplace

---

## 3. Types of Verification and Their Details

### 3.1 Identity Verification (eKYC)

| Aspect | Details |
|--------|---------|
| **What it checks** | Government-issued ID document authenticity + facial biometric match + liveness detection |
| **How it works** | User photographs ID document, then takes a selfie; AI extracts data via OCR, checks document forensics, matches face to photo on ID, performs liveness check to confirm real person |
| **Processing time** | Real-time (6--30 seconds for automated; up to 24 hours with manual review) |
| **Cost** | $0.80--$5.00 per verification (varies by provider and tier) |
| **Documents needed** | Government-issued photo ID (passport, driver's license, PR card) |
| **What can go wrong** | Poor lighting/camera quality, expired documents, name mismatches, non-Latin scripts failing OCR, deepfake attempts, liveness detection failures on older devices |
| **KindredCare relevance** | **CRITICAL** -- Required for both caregivers and seniors; prerequisite for criminal checks |

**Liveness detection methods:**
- Active liveness: User performs actions (turn head, blink, smile)
- Passive liveness: AI analyzes video stream without user prompts
- Video-based: Full video recording analyzed for spoofing indicators

**Deepfake concerns (2025--2026):**
- AI-generated deepfakes increased 900% in Europe (early 2025)
- Synthetic identity fraud surged 378% in Q1 2025
- iBeta Level 2 certification is the gold standard for liveness detection

### 3.2 CPIC Criminal Record Check (Level 1)

| Aspect | Details |
|--------|---------|
| **What it checks** | Canadian Police Information Centre (CPIC) national criminal records database using name + date of birth |
| **What it finds** | Indictable, hybrid, and summary offences for which a pardon has not been granted |
| **Processing time** | 15 minutes to 72 hours (online providers); 4--14 business days (police stations) |
| **Cost** | $25 (RCMP federal fee) + local fees; ~$29.99--$35 via Certn; ~$19.99 via Fastkey; $30--$75 at police stations |
| **Documents needed** | Full legal name, date of birth, address history; must complete identity verification first |
| **What can go wrong** | Common name matches causing delays, incomplete address history, name changes not captured, pardoned records not yet updated |
| **KindredCare relevance** | **CRITICAL for all caregivers** -- Minimum acceptable background check |

**Also known as:** Level 1 Criminal Record Check, CRC, Police Record Check, CPIC1, Police Background Check, Police Clearance Certificate

### 3.3 Enhanced Criminal Record Check (Level 2)

| Aspect | Details |
|--------|---------|
| **What it checks** | Everything in basic CPIC PLUS: CPIC investigative data bank, Public Safety Portal (PIP), and in some cases local police indices and court registries |
| **Additional records found** | Criminal convictions (unpardoned), conditional/absolute discharges, probation, wanted person info, accused person info, peace bonds, judicial orders, warrants, withdrawn/dismissed/stayed charges |
| **Processing time** | Same day to 5 business days (online); longer at police stations |
| **Cost** | $40--$70 CAD via online providers; higher at police stations |
| **Documents needed** | Same as basic CPIC + identity verification |
| **What can go wrong** | "Not Clear" result with no details (Enhanced checks only return Clear/Not Clear, not specifics); requires follow-up with local police for details |
| **KindredCare relevance** | **RECOMMENDED for Enhanced/Professional tier caregivers** -- Provides broader criminal history picture |

**Also known as:** CPIC2, Criminal Record and Judicial Matters Check (CRJMC), Enhanced Police Check, ECPIC

### 3.4 Vulnerable Sector Check (VSC / Level 3)

| Aspect | Details |
|--------|---------|
| **What it checks** | Everything in Enhanced check PLUS: check for record suspensions (pardons) for sexual offences |
| **Who needs it** | Anyone in a position of trust/authority over children or vulnerable persons (seniors qualify as vulnerable) |
| **Processing time** | 4 business days (Toronto, current) to 20 business days (typical); up to 4+ months if fingerprinting required; up to 120 business days if RCMP flags a possible match |
| **Cost** | $20 (Toronto) + $25 (RCMP federal fee) = $45 minimum; varies by jurisdiction ($40--$100+ total) |
| **Documents needed** | Valid government-issued photo ID, address history (4+ years), agency/organization code from requesting organization |
| **Critical limitation** | **CANNOT be done online or through third-party vendors** -- Must be completed in-person at local police service where applicant resides |
| **What can go wrong** | Extreme processing delays; applicant must live in jurisdiction; may require fingerprinting (random or triggered); each position requires separate VSC; people outside Canada cannot apply |
| **KindredCare relevance** | **MOST IMPORTANT CHECK** -- Seniors are legally a vulnerable population; caregivers should ideally have a VSC. However, KindredCare cannot directly facilitate this -- caregivers must obtain independently |

**Key operational challenge for KindredCare:** VSCs cannot be processed through Certn or any online provider. KindredCare will need to:
1. Require caregivers to submit existing VSC documents
2. Verify the VSC document's authenticity (date, issuing authority, applicant match)
3. Set recency requirements (e.g., VSC must be less than 6 months old)
4. Allow provisional platform access while VSC is being processed (with clear disclosure to families)

**Provincial VSC considerations:**
- BC: Criminal Records Review Program is the authorized body
- Ontario: Must apply through police where postal code begins
- Alberta/RCMP jurisdictions: Apply through local RCMP detachment
- Quebec: May require SOQUIJ court record check in addition

### 3.5 AML (Anti-Money Laundering) Screening

| Aspect | Details |
|--------|---------|
| **What it checks** | Global sanctions lists, Politically Exposed Persons (PEP) lists, adverse media, terrorist registries, sex offender registries, most wanted lists |
| **Processing time** | Real-time (seconds) for automated screening |
| **Cost** | $0.01--$5.00 per screening depending on provider and volume |
| **Documents needed** | Full name, date of birth, nationality |
| **What can go wrong** | False positives from common names, outdated lists, incomplete international coverage |
| **KindredCare relevance** | **MODERATE** -- Not legally required unless KindredCare processes payments (then FINTRAC obligations may apply). Recommended for additional safety screening. |

**FINTRAC relevance for KindredCare:**
- If KindredCare facilitates payments between families and caregivers, it may qualify as a Payment Service Provider (PSP) under the new Retail Payment Activities Act (RPAA)
- PSPs must register with the Bank of Canada (enforcement began September 2025)
- Under Bill C-2 (Strong Borders Act, June 2025), penalties for non-compliance can reach $20M CAD
- KindredCare should consult with legal counsel to determine if FINTRAC reporting obligations apply

### 3.6 Address Verification

| Aspect | Details |
|--------|---------|
| **What it checks** | Confirms applicant's residential address against authoritative databases (credit bureaus, electoral rolls, utility records, postal data) |
| **Processing time** | Real-time (seconds) for database checks; 1--5 days for document-based verification |
| **Cost** | $0.50--$3.00 per verification (often bundled with IDV) |
| **Documents needed** | For database: name + address; For document: utility bill, bank statement, government correspondence |
| **What can go wrong** | Rural addresses (PO boxes, rural routes) are harder to verify; recent movers may not be in databases; roommates/shared housing; Quebec addresses may require different data sources |
| **KindredCare relevance** | **RECOMMENDED for caregivers** -- Verifies they are located where they claim; important for matching with nearby seniors |

**Canadian-specific challenge:** Trulioo and other providers report difficulty verifying rural Canadian addresses, including PO boxes, legal land descriptions, and rural route addresses. This is relevant for KindredCare serving seniors in rural areas.

### 3.7 Reference Checks (Automated vs. Manual)

| Aspect | Automated | Manual |
|--------|-----------|--------|
| **How it works** | System sends questionnaire to references via email/SMS; references complete online | Human reviewer calls references by phone |
| **Processing time** | 1--3 days (depends on reference responsiveness) | 3--7 days per reference |
| **Cost** | $5--$15 per reference | $25--$50 per reference |
| **Accuracy** | Standardized questions, consistent scoring | More nuanced, can probe deeper |
| **Fraud risk** | References could be fabricated contacts | Phone verification of employer helps |
| **KindredCare relevance** | Good for Basic tier | Recommended for Enhanced/Professional tier |

**Providers offering automated reference checks:**
- Certn (automated reference checking included in packages)
- Credibled (Canadian company, automation-focused)
- Sterling BackCheck

**KindredCare recommendation:** Use automated reference checks for Basic tier (minimum 2 references). For Enhanced/Professional tier, combine automated with at least one manual phone verification to confirm the reference is a legitimate past employer/client.

### 3.8 Social Media Screening

| Aspect | Details |
|--------|---------|
| **What it checks** | Public social media profiles for concerning content (violence, discrimination, illegal activity) |
| **Processing time** | 24--72 hours |
| **Cost** | $10--$30 per screening |
| **Legal status in Canada** | **HIGHLY PROBLEMATIC** -- Quebec CAI explicitly advises against it as "unjustified intrusion on privacy rights" (March 2025 guidelines) |
| **Human rights risk** | Social media reveals protected characteristics (religion, ethnicity, sexual orientation, family status) that cannot legally be used in hiring decisions |
| **KindredCare relevance** | **NOT RECOMMENDED** -- Legal risks outweigh benefits, especially for a platform operating in Quebec |

**Quebec's March 2025 CAI Guidelines specifically state:**
- Information on social media profiles is "generally not relevant to evaluating professional competencies"
- Social media information "may be inaccurate, outdated, or unrelated to professional abilities"
- Consulting candidates' social media profiles is considered an "unjustified intrusion on privacy rights"
- The CAI and Quebec Human Rights Commission issued a joint open letter in March 2025 emphasizing these restrictions

**National considerations:**
- PIPEDA requires collection to be limited to what is necessary
- Human rights legislation prohibits using social media to discriminate based on protected characteristics
- OPC has noted that requiring social media passwords is "generally not considered appropriate"

**Alternative approach:** Instead of social media screening, rely on comprehensive criminal background checks, reference checks, and platform review systems to identify problematic caregivers.

### 3.9 Credit Checks

| Aspect | Details |
|--------|---------|
| **What it checks** | Credit history, payment patterns, outstanding debts, bankruptcies |
| **Processing time** | Real-time to 24 hours |
| **Cost** | $10--$20 per check |
| **Legal requirements** | Must be "demonstrably relevant to the role"; requires written informed consent; must notify candidate if declining based on credit info |
| **KindredCare relevance** | **NOT RECOMMENDED for caregivers** -- Difficult to justify under PIPEDA's proportionality test unless caregiver handles client finances |

**When a credit check MIGHT be justified:**
- Caregiver role includes financial management for the senior (paying bills, managing household budget)
- Caregiver has access to seniors' financial accounts or assets
- Live-in caregiver positions where financial trust is integral

**When a credit check is NOT justified:**
- Standard personal care (bathing, dressing, mobility)
- Companionship and social support
- Meal preparation and light housekeeping
- Most caregiver roles on KindredCare

### 3.10 International Criminal Record Checks

| Aspect | Details |
|--------|---------|
| **What it checks** | Criminal records from the applicant's country(ies) of previous residence |
| **Processing time** | 1--18 weeks depending on country; FBI clearance: 1--4 weeks; Most countries: 2--8 weeks |
| **Cost** | $50--$200+ per country; varies significantly by jurisdiction |
| **Documents needed** | Fingerprints (often ink-based for international), passport, proof of residency in that country |
| **What can go wrong** | Some countries have unreliable databases; processing delays; translation requirements; authentication/apostille needed; some countries simply don't provide these certificates |
| **KindredCare relevance** | **IMPORTANT** -- Many caregivers in Canada are immigrants; international checks fill gaps not covered by CPIC |

**Countries with known challenges:**
- Countries without centralized criminal record databases
- Countries requiring in-person applications only
- Countries with unreliable or incomplete records
- Countries with significant processing delays (can exceed 6 months)

**KindredCare approach for international caregivers:**
1. Require CPIC check for all Canadian criminal history
2. Request police clearance certificates from countries where they lived 6+ months as an adult
3. Accept that some international checks may not be obtainable -- document the attempt
4. Use global sanctions/PEP screening as supplementary check

### 3.11 Video KYC (Live Video Verification)

| Aspect | Details |
|--------|---------|
| **What it checks** | Live video call with an agent who verifies ID documents, facial match, and liveness in real-time |
| **Processing time** | Up to 10 minutes per session |
| **Cost** | $3--$15 per session (higher than automated IDV due to human agent involvement) |
| **Documents needed** | Government-issued photo ID, camera-enabled device |
| **FINTRAC acceptance** | FINTRAC allows remote document verification corroborated through selfie or live video stream |
| **KindredCare relevance** | **OPTIONAL PREMIUM** -- Could be used for highest trust tier or when automated IDV fails; especially useful for seniors who struggle with automated processes |

**Market growth:** Global video KYC market projected to reach $1.03B by 2033 (15% CAGR).

**Benefits for KindredCare:**
- Human touch for seniors who find automated verification difficult
- Agent can guide users through the process
- Stronger fraud prevention (live interaction harder to spoof)
- Complete audit trail for compliance

**Providers offering video KYC:** KYCAID, Ondato, Shufti Pro, iDenfy, Apizee

---

## 4. Pricing Breakdown

### 4.1 Per-Check Pricing Comparison

| Check Type | Certn (CAD) | Veriff | ShuftiPro | Trulioo | Persona |
|-----------|-------------|--------|-----------|---------|---------|
| **Identity Verification (doc + facial)** | $4.99 | $0.80--$1.89 USD | Custom quote | Custom quote (from $99/mo base) | From $250/mo base |
| **Basic CPIC** | ~$29.99 | N/A | N/A | N/A | N/A |
| **Enhanced CPIC** | ~$40--$60 (est.) | N/A | N/A | N/A | N/A |
| **VSC** | N/A (must be in-person) | N/A | N/A | N/A | N/A |
| **AML/Sanctions Screening** | Included in packages | Add-on | Included in KYC | Included in eIDV | Add-on |
| **Employment Verification** | Included in Pro/Elite | N/A | N/A | N/A | N/A |
| **Reference Check** | Included in packages | N/A | N/A | N/A | N/A |
| **Address Verification** | Included in packages | Add-on | Included | Included | Add-on |
| **International Criminal** | $50--$200+ per country | N/A | N/A | N/A | N/A |

### 4.2 Global Identity Verification Cost Trends (Juniper Research 2025)

| Region | 2025 Cost/Check (USD) | 2029 Forecast | Change |
|--------|----------------------|---------------|--------|
| **North America** | ~$0.28 | ~$0.21 | -23% |
| **Western Europe** | ~$0.24 | ~$0.19 | -19% |
| **Latin America** | ~$0.19 | ~$0.17 | -11% |
| **Central & Eastern Europe** | ~$0.24 | ~$0.18 | -25% |
| **Global Average** | $0.20 | $0.17 | -15% |

**Note:** These are wholesale/average figures. Retail pricing from specific vendors (Veriff, Persona, etc.) is higher because it includes value-added features like fraud detection, liveness, and compliance tooling.

**Industry trend warning:** Despite global averages declining, individual vendor prices (especially Stripe Identity and Persona) have increased 50%+ as VC-backed companies pursue sustainable growth. Budget accordingly.

### 4.3 Volume Discounts

| Provider | Volume Discount Details |
|----------|----------------------|
| **Certn** | Low volume (up to 100/year) from $10; High volume (100+/year) custom pricing; Periodic promotional discounts (e.g., 25% off for new customers) |
| **Veriff** | Enterprise pricing for 1,000+/month; Self-serve tiers with per-check rates |
| **Persona** | Free-forever plan for testing; Volume discounts on Growth and Enterprise plans |
| **Trulioo** | Custom enterprise pricing; Bulk verification discounts |
| **ShuftiPro** | Custom quote based on volume; 15-day free trial |
| **Jumio** | Reduces per-transaction rates for high volumes; Custom quotes only |

### 4.4 Monthly Platform Fees vs. Per-Check Pricing

| Provider | Monthly Base Fee | Per-Check Fee | Free API Access? |
|----------|-----------------|---------------|------------------|
| **Certn** | None (no setup, no minimums) | From $4.99/check | Yes -- per-check billing only |
| **Veriff** | $49/mo commitment on self-serve | $0.80--$1.89/check | Yes -- included in self-serve |
| **Persona** | From $250/mo | Volume-based | Free plan available |
| **Trulioo** | From $99/mo | Custom per-check | No -- monthly minimum |
| **ShuftiPro** | Custom | Custom | 15-day free trial; contact for pricing |
| **iComply** | From $1/entity/year | Custom | One line of code integration |
| **Jumio** | Custom (no free plan) | Custom | No -- enterprise only |
| **Onfido/Entrust** | Custom ($10K+ minimums reported) | Custom | No -- enterprise only |

### 4.5 Estimated Cost Per Caregiver (Full Pipeline)

| Verification Step | Cost (CAD, est.) | Required? |
|-------------------|-----------------|-----------|
| Identity Verification (doc + facial) | $2--$7 | Yes (all tiers) |
| Basic CPIC Criminal Record Check | $30--$35 | Yes (all tiers) |
| Enhanced CPIC Check | $40--$70 | Enhanced/Pro tier |
| Vulnerable Sector Check | $20--$100 (caregiver pays, varies by city) | Strongly recommended |
| AML/Sanctions Screening | $0.01--$5 | Yes (all tiers) |
| Address Verification | $1--$3 | Yes (all tiers) |
| Reference Check (2 automated) | $10--$30 | Yes (all tiers) |
| Employment Verification | $5--$15 | Enhanced/Pro tier |
| International Criminal Check | $50--$200 per country | If applicable |
| **Total (Basic tier)** | **$43--$80** | |
| **Total (Enhanced tier)** | **$78--$160** | |
| **Total (Professional tier, no international)** | **$108--$235** | |

### 4.6 Estimated Cost Per Senior/Family (Basic Verification)

| Verification Step | Cost (CAD, est.) | Required? |
|-------------------|-----------------|-----------|
| Identity Verification (doc + facial) | $2--$7 | Yes |
| Address Verification | $1--$3 | Optional |
| Payment Method Verification | Handled by payment processor | Yes |
| **Total** | **$2--$10** | |

---

## 5. Processing Times

### 5.1 Processing Time Summary

| Check Type | Best Case | Typical | Worst Case |
|-----------|-----------|---------|------------|
| **Identity Verification (automated)** | 6 seconds | 30 seconds | 24 hours (manual review) |
| **Identity Verification (video KYC)** | 5 minutes | 10 minutes | 30 minutes |
| **Basic CPIC (online provider)** | 15 minutes | 1--24 hours | 72 hours (if criminal history exists) |
| **Basic CPIC (police station)** | Same day | 4--14 business days | 20+ business days |
| **Enhanced CPIC (online)** | Same day | 1--5 business days | 10+ business days |
| **Vulnerable Sector Check** | 4 business days (Toronto current) | 10--20 business days | 4+ months (if fingerprints required); 120 business days (RCMP flag) |
| **AML/Sanctions Screening** | Instant | Seconds | Minutes |
| **Address Verification (database)** | Instant | Seconds | 24 hours |
| **Reference Check (automated)** | Same day | 1--3 days | 7+ days (unresponsive references) |
| **Reference Check (manual)** | 1 day | 3--7 days | 14+ days |
| **Employment Verification** | Same day | 1--5 days | 10+ days |
| **International Criminal Check** | 1 week | 2--8 weeks | 18+ weeks (some countries) |
| **FBI Clearance (for US residents)** | 1 week | 2--4 weeks | 18 weeks (rare) |

### 5.2 CPIC Processing by Province (Approximate)

| Province | Basic CPIC (Police Station) | VSC | Notes |
|----------|---------------------------|-----|-------|
| **Ontario (Toronto)** | 14 business days | 4 business days (current) | No rush service; apply at police where postal code begins with "M" |
| **Ontario (Other)** | 5--15 business days | 10--20 business days | Varies by police service |
| **British Columbia** | 5--10 business days | Handled by BC Criminal Records Review Program | VSC through provincial program, not local police |
| **Alberta** | 5--10 business days | 10--20 business days | RCMP detachments; Edmonton Police has separate process |
| **Quebec** | 5--15 business days | 10--20 business days | Also consider SOQUIJ court record check |
| **Manitoba / Saskatchewan** | 5--15 business days | 10--20 business days | RCMP detachments in most areas |
| **Atlantic Provinces** | 5--15 business days | 10--20 business days | Smaller services may be faster |

**Note:** Online providers like Certn can return basic CPIC results in 15 minutes to 24 hours because they have authorized electronic access to CPIC databases. Police station processing is slower due to manual handling.

### 5.3 Recommended Timelines for KindredCare Onboarding

| Verification Stage | When in Onboarding | Target Completion |
|-------------------|-------------------|-------------------|
| Identity Verification | During sign-up | Instant (real-time) |
| AML/Sanctions Screening | During sign-up | Instant (real-time) |
| Address Verification | During sign-up | Instant (real-time) |
| Basic CPIC | After IDV completes | Within 24 hours |
| Reference Checks (automated) | After IDV completes | Within 3 days |
| Enhanced CPIC | After basic CPIC (if required) | Within 5 days |
| VSC Verification | Caregiver provides existing VSC | Ongoing (verify document upon receipt) |
| International Checks | If applicable | Within 2--8 weeks |

**Provisional access strategy:** Allow caregivers to create profiles and browse opportunities after IDV + Basic CPIC clear. Display verification badges progressively as additional checks complete. Clearly disclose to families which checks have/haven't been completed for each caregiver.

---

## 6. Documents That CAN Be Verified

### 6.1 Canadian Documents

| Document | Accepted for IDV? | OCR Extractable Fields | Notes |
|----------|-------------------|----------------------|-------|
| **Canadian Passport** | Yes (universally accepted) | Full name, DOB, nationality, passport number, expiry, photo | Most universally accepted ID in Canada |
| **Provincial Driver's Licence** | Yes (widely accepted) | Full name, DOB, address, licence number, class, expiry, photo | Must comply with provincial naming policy; Enhanced DL doubles as WHTI travel doc |
| **Permanent Resident (PR) Card** | Yes | Full name, DOB, PR number, expiry, photo | Must pair with Canadian-issued second ID for some applications |
| **Canadian Citizenship Certificate** | Yes (supporting) | Full name, DOB, citizenship number | Less common for IDV; good as supporting document |
| **Canadian Birth Certificate** | Yes (supporting, no photo) | Full name, DOB, place of birth, parents' names | Cannot be used as sole ID (no photo); foundational evidence |
| **NEXUS Card** | Yes | Full name, DOB, photo | Trusted Traveller Program; limited holders |
| **Secure Certificate of Indian Status** | Yes | Full name, DOB, registration number, photo | Accepted across federal programs |
| **Work Permit (IMM 1442)** | Yes (supporting) | Full name, DOB, permit conditions, expiry | Important for verifying international caregiver work authorization |
| **Study Permit** | Yes (supporting) | Full name, DOB, permit conditions, expiry | Relevant for international student caregivers |
| **International Passport** | Yes | Full name, DOB, nationality, passport number, expiry, photo | Widely accepted; quality of OCR depends on issuing country |
| **International Driver's Licence** | Varies by provider | Full name, DOB, address, licence number, photo | Some providers support limited countries; less reliable OCR |

### 6.2 OCR Extraction Capabilities

Modern IDV platforms (Veriff, ShuftiPro, Trulioo) can extract:

| Field | Extraction Rate | Notes |
|-------|----------------|-------|
| Full name | 98%+ | Latin scripts highly accurate; non-Latin scripts vary |
| Date of birth | 99%+ | Standardized formatting helps |
| Document number | 98%+ | Machine-readable zone (MRZ) makes this very reliable for passports |
| Expiry date | 98%+ | |
| Address (if on document) | 90--95% | Varies by document type; driver's licences most reliable |
| Photo extraction | 99%+ | For facial matching |
| MRZ data | 99%+ | Passports and travel documents |
| Barcode data | 95%+ | North American driver's licences |
| NFC chip data | 99%+ | For NFC-enabled documents (e-passports); requires compatible device |

---

## 7. Documents That CANNOT Be Verified or Have Limitations

### 7.1 Documents NOT Accepted or With Significant Limitations

| Document | Status | Reason |
|----------|--------|--------|
| **Provincial Health Card** | **NOT accepted** by most federal programs and IDV providers | Provincial restrictions on sharing health card info; no photo in some provinces; health data privacy concerns |
| **SIN Card / SIN Letter** | **NEVER use for identity verification** | Contains no photo, no security features; SIN is a file number, not an identity document |
| **Expired documents (>1 year)** | **NOT accepted** | Most providers reject documents expired more than 12 months; some stricter (6 months) |
| **Baptismal certificates** | **NOT accepted** | No photo, no government issuing authority, no security features |
| **Student ID cards** | **Generally NOT accepted** | Non-government issued; easily forged; no standardization |
| **Library cards, loyalty cards** | **NOT accepted** | No identity verification purpose |
| **Digital-only documents** | **NOT accepted in Quebec** (civil registry processes); limited acceptance elsewhere | Quebec specifically prohibits digital documents as valid photo ID |
| **Photocopies or screenshots** | **NOT accepted** | No original document forensics possible; easy to manipulate |

### 7.2 Foreign Document Challenges

| Issue | Details |
|-------|---------|
| **Non-French/English documents** | Must be accompanied by certified translation; OCR may fail on non-Latin scripts |
| **Countries without standardized IDs** | Some countries lack centralized ID systems, making document verification unreliable |
| **Countries with high forgery rates** | Additional scrutiny required; some providers flag documents from specific countries for manual review |
| **Documents without MRZ** | Cannot benefit from machine-readable zone verification; rely on OCR alone |
| **Documents without NFC chips** | Cannot verify chip data for enhanced authenticity; rely on visual/forensic checks |
| **Damaged or worn documents** | OCR failures, photo matching difficulties |
| **Documents with cultural naming conventions** | Names without clear first/last distinction; mononyms; patronymic naming systems |

### 7.3 Provincial Restrictions

| Province | Specific Restriction |
|----------|---------------------|
| **Quebec** | Strictest privacy laws (Law 25); biometric database requires CAI notification; digital documents not accepted for civil registry; social media screening explicitly discouraged; privacy impact assessment required before deploying biometric systems |
| **British Columbia** | PIPA (Personal Information Protection Act) -- substantially similar to PIPEDA; VSC handled through provincial Criminal Records Review Program |
| **Alberta** | PIPA Alberta -- substantially similar to PIPEDA; specific ID requirements for government services |
| **Ontario** | No private-sector privacy legislation (PIPEDA applies directly); health card voluntarily presented only |
| **All provinces** | Health cards cannot be required as ID outside healthcare contexts |

---

## 8. Canadian Legal Requirements for KYC

### 8.1 PIPEDA Compliance Requirements

The Personal Information Protection and Electronic Documents Act (PIPEDA) is Canada's federal private-sector privacy law. KindredCare must comply with all 10 PIPEDA principles:

| PIPEDA Principle | KindredCare Application |
|-----------------|------------------------|
| **1. Accountability** | Designate a Privacy Officer responsible for all KYC data; ensure third-party IDV providers are contractually bound to equivalent protections |
| **2. Identifying Purposes** | State clearly at point of collection: "We collect your ID document and selfie to verify your identity for platform safety and to comply with background check requirements" |
| **3. Consent** | Obtain express, informed consent before collecting biometric data; consent must be voluntary; cannot require biometric consent for non-integral purposes |
| **4. Limiting Collection** | Collect only what is necessary; do not collect SIN unless legally required (KindredCare as a marketplace likely does NOT need SIN); do not request health cards |
| **5. Limiting Use, Disclosure, Retention** | Use verification data only for stated purposes; do not share with unauthorized parties; delete when purpose is fulfilled |
| **6. Accuracy** | Keep verification data current; allow users to request corrections |
| **7. Safeguards** | Encrypt all biometric and personal data; implement access controls; regular security audits |
| **8. Openness** | Publish a clear Privacy Policy describing all KYC data practices |
| **9. Individual Access** | Allow users to access their verification records upon request |
| **10. Challenging Compliance** | Provide a mechanism for users to challenge KYC decisions and data handling |

### 8.2 Biometric Data Handling (Updated OPC Guidance, August 2025)

The OPC released updated guidance on biometric data processing on August 11, 2025. Key requirements for KindredCare:

| Requirement | Details |
|-------------|---------|
| **Classification** | All biometric data (raw images AND derived templates) is "sensitive personal information" |
| **Express consent mandatory** | Must obtain explicit agreement before collecting facial images/templates |
| **Pre-consent disclosure** | Must explain: what biometric data is collected, why, for how long, where stored, who has access, how to withdraw consent, residual risks |
| **Purpose limitation** | Cannot use facial data for purposes beyond identity verification (e.g., cannot analyze for health conditions, ethnicity, emotional state) |
| **Data minimization** | Use minimum biometric characteristics needed |
| **Deletion on withdrawal** | Must promptly delete biometric data if user withdraws consent |
| **Third-party liability** | KindredCare remains fully responsible for biometric data even when outsourced to IDV providers like Veriff or ShuftiPro |
| **Security measures** | Encryption required; consider cancellable templates, homomorphic encryption; deploy anti-spoofing measures |
| **Accountability** | Designate an individual/committee for PIPEDA biometric compliance |

**Recommended approach:** Use IDV providers (Veriff, ShuftiPro) that process biometric matching in real-time and do NOT store raw biometric data long-term. Store only the verification result (pass/fail) and a reference ID, not the actual facial template.

### 8.3 Quebec Law 25 (Strictest Privacy Law in North America)

Quebec's Law 25 adds SIGNIFICANT additional requirements for any KindredCare operations involving Quebec users:

| Requirement | Details |
|-------------|---------|
| **Privacy Officer mandatory** | CEO is default PO unless delegated in writing |
| **Privacy Impact Assessment (PIA)** | Required BEFORE deploying any identity verification system involving personal data collection |
| **Biometric notification** | Must notify the Commission d'acces a l'information (CAI) BEFORE creating any biometric database |
| **Express opt-in consent** | Required for all sensitive personal information (biometrics, health, intimate data) |
| **Data portability** | Users have right to receive their personal data in a structured, commonly used format (effective September 2024) |
| **Right to deletion** | Must delete personal data when purpose is accomplished or anonymize for legitimate purposes |
| **Child consent** | Parental/tutor consent required for users under 14 |
| **Social media screening prohibited** | CAI explicitly advises against consulting candidates' social media profiles |
| **AI transparency** | Must conduct PIA before using AI in hiring/screening; cannot use AI to evaluate emotional/psychological states |
| **Private right of action** | Individuals can sue for privacy violations (unlike PIPEDA where only OPC investigates) |
| **Penalties** | CAI can issue administrative penalties up to $25M or 4% of worldwide revenue |

**KindredCare action items for Quebec:**
1. Conduct a Privacy Impact Assessment before launching the IDV system
2. Notify CAI before implementing biometric verification (facial matching)
3. Ensure express opt-in consent for all biometric data collection
4. Offer non-biometric verification alternatives (manual document review)
5. Implement data portability mechanisms
6. Maintain clear data retention and destruction policies
7. Train all staff on Quebec-specific requirements
8. Ensure IDV providers comply with Quebec data residency expectations

### 8.4 Data Storage and Retention

| Data Type | How Long to Store | Legal Basis |
|-----------|------------------|-------------|
| **Identity verification results** | Duration of user's account + 2--5 years | PIPEDA compliance, dispute resolution |
| **Raw biometric data (selfies)** | Delete after verification completes (or within 30 days) | PIPEDA data minimization; Quebec Law 25 |
| **Criminal record check results** | Duration of user's account + 2--5 years | Employment law; platform safety |
| **VSC documents** | Duration of active caregiver status + 1 year | Platform safety record |
| **Consent records** | 3 years minimum (CASL requirement) | CASL compliance |
| **AML screening results** | 5 years after last client interaction | FINTRAC requirement (if applicable) |
| **Reference check results** | Duration of user's account + 2 years | Employment law |
| **FINTRAC records (if applicable)** | At least 5 years after last relevant interaction | PCMLTFA requirement |

### 8.5 Consent Requirements Summary

| Context | Consent Type | How to Obtain |
|---------|-------------|---------------|
| **Collecting government ID image** | Express consent | Clear opt-in checkbox with explanation |
| **Facial biometric capture** | Express consent (mandatory under PIPEDA) | Separate explicit consent with detailed disclosure |
| **Criminal record check** | Express written consent | Specific consent form detailing type of check |
| **Reference contact** | Express consent | Permission to contact named references |
| **AML screening** | Can be part of terms of service | Include in platform terms and privacy policy |
| **Address verification** | Express consent | Include in verification consent flow |
| **Sending commercial emails** | Express consent (CASL) | Opt-in checkbox; cannot pre-fill |
| **Transactional emails** | Implied (CASL exemption) | Verification codes, account notifications exempt from consent but must include sender ID |

### 8.6 CASL Considerations

| Aspect | KindredCare Application |
|--------|------------------------|
| **Transactional emails (verification codes, status updates)** | Exempt from consent requirement BUT must include sender identification and unsubscribe mechanism |
| **Marketing emails (new caregiver matches, promotions)** | Require express opt-in consent; cannot pre-fill consent checkboxes |
| **Implied consent** | Exists during active business relationship; expires 2 years after last transaction |
| **Record keeping** | Keep consent records for 3 years after business relationship ends |
| **Unsubscribe** | Must process within 10 business days; mechanism must work for 60 days after sending |
| **Penalties** | Up to $1M CAD for individuals, $10M CAD for corporations, per violation |

### 8.7 Right to Deletion

| Framework | Deletion Requirements |
|-----------|----------------------|
| **PIPEDA** | Must delete personal information when no longer needed for identified purposes; process deletion requests in reasonable timeframe |
| **Quebec Law 25** | Must delete when purpose is accomplished OR anonymize for serious/legitimate purposes; subject to legal retention periods |
| **Biometric data** | Must delete promptly upon consent withdrawal (subject to legal/contractual obligations) |
| **Criminal records** | May need to retain for safety/liability purposes; balance with privacy rights |
| **Practical approach** | Implement automated data lifecycle management; anonymize rather than delete where ongoing analytics are needed |

---

## 9. Recommended KYC Flow for KindredCare

### 9.1 Caregiver Verification Tiers

#### BASIC TIER (Minimum for Platform Access)

**Target:** New caregivers joining the platform
**Estimated cost:** $43--$80 CAD per caregiver
**Time to complete:** 24--48 hours (excluding VSC)

```
Step 1: Account Creation
  -> Email verification
  -> Phone number verification (SMS OTP)
  -> Basic profile information (name, address, DOB)

Step 2: Identity Verification (eKYC) [REAL-TIME]
  -> Document upload (driver's licence, passport, or PR card)
  -> Selfie capture with liveness detection
  -> AI-powered document authenticity + facial match
  -> Provider: Veriff ($0.80-$1.89) or ShuftiPro (as per business plan)

Step 3: AML/Sanctions Screening [REAL-TIME]
  -> Automated screening against global sanctions, PEP, adverse media lists
  -> Provider: Certn (bundled) or standalone via iComply

Step 4: Basic CPIC Criminal Record Check [WITHIN 24 HOURS]
  -> Name + DOB search against CPIC database
  -> Requires successful IDV completion first
  -> Provider: Certn (~$30-$35 CAD)

Step 5: Address Verification [REAL-TIME]
  -> Database check against credit bureau/electoral roll data
  -> Provider: Bundled with IDV provider

Step 6: Automated Reference Checks [WITHIN 3 DAYS]
  -> Minimum 2 references
  -> System sends questionnaire via email/SMS
  -> References complete standardized evaluation
  -> Provider: Certn (bundled) or Credibled

Step 7: VSC Document Request [ONGOING]
  -> Request that caregiver provide existing VSC or begin application
  -> Display "VSC Pending" badge on profile
  -> Set 90-day deadline to submit VSC document
  -> Verify VSC document authenticity when submitted

RESULT: "Basic Verified" badge on profile
```

#### ENHANCED TIER

**Target:** Caregivers seeking more trust and higher-paying opportunities
**Estimated cost:** $78--$160 CAD per caregiver
**Time to complete:** 3--7 days (excluding VSC and international checks)

```
All Basic Tier steps PLUS:

Step 8: Enhanced CPIC Check (Level 2)
  -> CPIC investigative data bank + PIP + local indices
  -> Provider: Certn

Step 9: Employment Verification
  -> Verify most recent 2 caregiving positions
  -> Provider: Certn (automated)

Step 10: Manual Reference Verification [1 REFERENCE]
  -> Phone call to at least 1 reference to verify legitimacy
  -> Provider: Certn or manual by KindredCare team

Step 11: Credential/Certification Verification
  -> Verify claimed certifications (PSW, First Aid, CPR, etc.)
  -> Cross-reference with issuing bodies
  -> Provider: Certn credential verification or manual

RESULT: "Enhanced Verified" badge on profile
```

#### PROFESSIONAL TIER

**Target:** Experienced caregivers, live-in positions, high-acuity care
**Estimated cost:** $108--$235 CAD per caregiver (plus international check costs if applicable)
**Time to complete:** 1--8 weeks

```
All Enhanced Tier steps PLUS:

Step 12: International Criminal Record Check (if applicable)
  -> For caregivers who lived outside Canada 6+ months as adult
  -> Police clearance from each country of residence
  -> Provider: Certn or manual submission

Step 13: Video KYC Session
  -> Live video verification with KindredCare agent
  -> Review credentials, discuss experience, verify identity in real-time
  -> Creates recorded audit trail

Step 14: Verified VSC on File
  -> VSC must be received and verified
  -> Must be less than 6 months old at time of submission

RESULT: "Professional Verified" badge on profile
```

### 9.2 Senior/Family Verification Flow

**Objective:** Lighter verification to confirm identity and payment ability without burdening seniors
**Estimated cost:** $2--$10 CAD per senior/family account
**Time to complete:** 5--15 minutes

```
Step 1: Account Creation
  -> Email verification
  -> Phone number verification (SMS OTP)
  -> Profile information (name, address, care needs)

Step 2: Identity Verification (Simplified) [REAL-TIME]
  -> Document upload (driver's licence or passport)
  -> Selfie with liveness (simplified, senior-friendly flow)
  -> ALTERNATIVE for seniors unable to do selfie:
     - Video KYC session with agent assistance
     - Or: verification by authorized family member
  -> Provider: Veriff or ShuftiPro with simplified UI flow

Step 3: Payment Method Verification
  -> Credit card or bank account verification
  -> Handled by payment processor (Stripe, etc.)
  -> Acts as additional identity signal

Step 4 (OPTIONAL): Address Verification
  -> Database check or utility bill upload
  -> Primarily for matching with nearby caregivers

RESULT: "Verified Family" badge on profile
```

### 9.3 Handling International Caregivers (Immigrants, International Students)

International caregivers represent a large portion of Canada's care workforce. Special handling is required:

| Scenario | Verification Approach |
|----------|----------------------|
| **Permanent Resident** | Standard flow; PR Card + passport for IDV; CPIC covers Canadian criminal history |
| **Work Permit Holder** | Verify work permit validity and conditions; ensure permit allows caregiving work; check expiry dates; SIN starting with "9" indicates temporary status |
| **International Student** | Verify study permit; check if work hours are restricted (20hrs/week during school); confirm eligibility to work as caregiver |
| **New Immigrant (<3 years in Canada)** | CPIC may have limited history; request police clearance from country of origin; global sanctions check is especially important |
| **Caregiver Pilot Program Participant** | Verify OROWP (Occupation-Restricted Open Work Permit); confirm NOC 44100 or 44101 alignment |

**Documents to accept for international caregivers:**
- Canadian PR Card
- Foreign passport (from country of citizenship)
- Work permit (IMM 1442)
- Study permit
- Police clearance certificates from countries of previous residence

**Additional considerations:**
- International documents may require certified translation
- Some documents may use non-Latin scripts (OCR accuracy varies)
- Cultural naming conventions may not fit standard first/last name fields
- Processing times for international criminal checks vary significantly by country

### 9.4 Handling Seniors (Lighter Verification)

Seniors are the vulnerable party being protected, so their verification should be simplified:

**Principles:**
1. **Do not create barriers to accessing care** -- overly complex verification may prevent seniors from using the platform
2. **Offer multiple verification paths** -- not all seniors are comfortable with selfies or document scanning
3. **Allow family member proxy** -- an authorized family member can complete verification on behalf of the senior
4. **Provide phone support** -- have agents available to guide seniors through verification
5. **Accept common senior ID** -- driver's licence, passport; do not require PR card or citizenship certificate

**Accessibility considerations:**
- Larger text and clearer instructions in verification flow
- Video KYC option with patient, trained agents
- Phone-based verification as fallback
- Family member/power of attorney proxy verification
- Do not require multiple document uploads

### 9.5 Optimal Order of Verification Steps

The order matters for both cost optimization and user experience:

```
1. EMAIL + PHONE VERIFICATION (free, instant)
   -> Weeds out bots and spam accounts
   -> No cost incurred yet

2. BASIC PROFILE COMPLETION (free, 2 minutes)
   -> Collect name, address, DOB
   -> Required for subsequent checks
   -> Drop-off point: low-intent users leave here

3. IDENTITY VERIFICATION (eKYC) ($2-$7, real-time)
   -> Document upload + selfie
   -> This is the gating step -- must pass before proceeding
   -> Fail rate: ~5% (expired docs, poor photos, fraud attempts)

4. AML/SANCTIONS SCREENING (bundled or $0.01-$5, instant)
   -> Run immediately after IDV completes
   -> If flagged: escalate to manual review, do not proceed

5. CRIMINAL RECORD CHECK ($30-$70, within 24 hours)
   -> Only for users who passed IDV
   -> Cost optimization: you only pay for verified users
   -> If not clear: escalate to review process

6. REFERENCE CHECKS ($10-$30, within 3 days)
   -> Send after IDV passes
   -> Run in parallel with criminal check
   -> Async results via webhook

7. VSC VERIFICATION (ongoing)
   -> Request but do not block on this
   -> Allow provisional access with disclosure
   -> Set deadline (90 days) for submission

8. ADDITIONAL CHECKS (Enhanced/Professional, days to weeks)
   -> Only for users who want higher tier
   -> Employment verification, international checks
   -> Progressive verification over time
```

**Cost optimization:** By ordering verification steps from cheapest/fastest to most expensive/slowest, you minimize wasted spend on users who drop off early or fail basic checks. The estimated drop-off means:
- 100 sign-ups -> 80 complete profiles -> 76 pass IDV -> 74 pass AML -> 70 pass CPIC -> 60 complete references
- You pay for 76 IDV checks instead of 100, saving ~$48-$168

---

## 10. Technical Integration Details

### 10.1 API Types and Integration Patterns

| Provider | API Type | Authentication | Documentation | Sandbox |
|----------|----------|---------------|---------------|---------|
| **Certn** | REST API | OAuth 2.0 (Client Credentials) | docs.certn.co | Yes |
| **Veriff** | REST API | API key + HMAC | veriff.com/docs | Yes (15-day free trial, 50 sessions) |
| **ShuftiPro** | REST API | Client ID + Secret Key | shuftipro.com/integration | Yes (sandbox mode mirrors production) |
| **Trulioo** | REST API | API key | developer.trulioo.com | Yes (quick-start in <10 min) |
| **Persona** | REST API | API key + Bearer token | docs.withpersona.com | Yes (free plan for testing) |
| **iComply** | REST API + SDKs | API key | icomplyis.com/docs | Yes |

### 10.2 Mobile SDK Availability

| Provider | iOS SDK | Android SDK | React Native | Flutter | Web SDK |
|----------|---------|-------------|-------------|---------|---------|
| **Certn** | No | No | No | No | Web-based flow |
| **Veriff** | Yes | Yes | Community | No | Yes |
| **ShuftiPro** | Yes | Yes | Yes (GitHub) | Yes | Yes (JavaScript) |
| **Trulioo** | Yes | Yes | No | No | Yes (JavaScript widget) |
| **Persona** | Yes | Yes | No | No | Yes (web widget) |
| **Jumio** | Yes | Yes | No | No | Yes |
| **iComply** | Yes (embedded) | Yes (embedded) | No | No | Yes (plug-and-play) |

**Recommendation for KindredCare mobile app:**
- ShuftiPro has the broadest mobile SDK support (Native iOS, Android, React Native, Flutter)
- If building with React Native: ShuftiPro is the only provider with an official maintained React Native SDK
- If building native: Veriff, ShuftiPro, and Trulioo all offer solid native SDKs

### 10.3 Webhook Integration for Async Results

Background checks (CPIC, references, employment verification) return results asynchronously. Webhook integration pattern:

```
KindredCare App -> Initiates check via API -> Provider processes check
                                                     |
Provider completes check -> Webhook POST to KindredCare endpoint
                                                     |
KindredCare processes result -> Updates user profile -> Notifies user
```

**Webhook best practices:**
- Implement webhook signature verification (all providers support this)
- Use an event queue (SQS, RabbitMQ) to handle webhook payloads
- Implement retry logic for failed webhook deliveries
- Store raw webhook payloads for audit trail
- Set up monitoring/alerts for webhook failures

**Provider webhook capabilities:**

| Provider | Webhook Support | Signature Verification | Retry on Failure | Event Types |
|----------|----------------|----------------------|------------------|-------------|
| **Certn** | Yes (webhooks management API) | Yes | Yes | Check complete, status change |
| **Veriff** | Yes | HMAC-SHA256 | Yes | Decision made, review needed |
| **ShuftiPro** | Yes (configurable callback URL) | Yes | Yes | Verification complete, status update |
| **Trulioo** | Yes | Yes | Yes | Verification result |
| **Persona** | Yes | Signature header | Yes | Inquiry complete, status change |

### 10.4 White-Label Options

| Provider | White-Label Support | Customization Level |
|----------|--------------------|--------------------|
| **Certn** | Yes (self-service white-labeling tools) | Logo, colors, email templates |
| **Veriff** | Yes (Premium plan) | Colors, branding on verification flow |
| **ShuftiPro** | Yes | Full customization of verification screens |
| **Persona** | Yes (no-code flow builder) | Extensive -- conditional logic, custom UX |
| **Trulioo** | Yes (Workflow Studio) | No-code workflow customization |
| **iComply** | Yes | Customizable aesthetics and workflows |

### 10.5 Recommended Technical Architecture

```
                    +------------------+
                    |  KindredCare App |
                    |  (React Native)  |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  KindredCare API  |
                    |  (Backend Server) |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                                 |
   +--------v---------+           +-----------v----------+
   |  IDV Provider     |           |  Background Check    |
   |  (Veriff/ShuftiPro)|          |  Provider (Certn)    |
   +--------+----------+           +-----------+----------+
            |                                  |
   Real-time webhook                 Async webhook
   (IDV result)                      (check results)
            |                                  |
   +--------v----------+          +-----------v-----------+
   | Process IDV Result |          | Process Check Result  |
   | Update user status |          | Update user badges    |
   | Trigger next step  |          | Notify user           |
   +--------------------+          +-----------------------+
```

**Multi-provider integration strategy:**

| Component | Primary Provider | Fallback Provider | Reason |
|-----------|-----------------|-------------------|--------|
| **Identity Verification** | ShuftiPro (per business plan) | Veriff | ShuftiPro has broadest SDK support; Veriff as cost-effective backup |
| **Criminal Record Checks** | Certn | Sterling BackCheck | Certn is Canadian with direct CPIC access; Sterling as enterprise backup |
| **AML Screening** | Certn (bundled) | iComply | Certn bundles with criminal checks; iComply for standalone FINTRAC compliance |
| **Address Verification** | Trulioo | Bundled with IDV | Trulioo has Canadian data strength (450+ sources) |
| **Reference Checks** | Certn | Credibled | Both Canadian companies |

### 10.6 Sandbox/Testing Environments

| Provider | Sandbox Details |
|----------|----------------|
| **Certn** | Test environment available through API; uses OAuth test credentials |
| **Veriff** | 15-day free trial with Premium features; 50 test sessions; no credit card |
| **ShuftiPro** | Sandbox mode mirrors production latency; realistic QA before go-live |
| **Trulioo** | Quick-start sandbox in <10 minutes; extensive error catalogue |
| **Persona** | Free-forever plan for testing; production-like environment |
| **iComply** | Demo environment available |

---

## 11. Appendix: Sources and References

### KYC Providers
- [Certn Pricing](https://certn.co/pricing/)
- [Certn Criminal Record Checks](https://certn.co/criminal-record-checks/)
- [Certn API Documentation](https://docs.certn.co/api)
- [Certn Identity Verification](https://certn.co/identity-verification/)
- [ShuftiPro Identity Verification](https://shuftipro.com/identity-verification/)
- [ShuftiPro Integration](https://shuftipro.com/integration/)
- [Trulioo Identity Verification](https://www.trulioo.com/solutions/identity-verification)
- [Trulioo Developer Hub](https://developer.trulioo.com/reference/api-integration-4)
- [Veriff Self-Serve Plans](https://www.veriff.com/plans/self-serve)
- [Veriff Identity Verification](https://www.veriff.com/product/identity-verification)
- [Persona Pricing](https://withpersona.com/pricing)
- [Jumio Products](https://www.jumio.com/products/)
- [Onfido/Entrust IDV](https://www.softwareadvice.com/identity-management/onfido-profile/)
- [iComply KYC Platform](https://icomplyis.com/platform/kyc/)
- [iComply Pricing](https://icomplyis.com/pricing/)
- [iComply Canada Coverage](https://icomplyis.com/global-coverage/canada/)

### Canadian Criminal Record Checks
- [RCMP Criminal Record Checks](https://rcmp.ca/en/criminal-records/criminal-record-checks)
- [RCMP Processing Times and Fees](https://rcmp.ca/en/criminal-records/criminal-record-checks/processing-times-and-fees)
- [RCMP Vulnerable Sector Checks](https://rcmp.ca/en/criminal-records/criminal-record-checks/vulnerable-sector-checks)
- [Toronto Police Record Checks](https://www.tps.ca/services/police-record-checks/)
- [Certn Overview of Canadian Criminal Record Checks](https://help.certn.co/hc/en-us/articles/10482727080979-Overview-of-Canadian-criminal-record-checks)
- [Commissionaires CPIC Checks](https://commissionaires.ca/en/services/criminal-record-checks/)
- [CanadaBackgroundCheck.com Pricing](https://www.canadabackgroundcheck.com/en/pricing)

### Canadian Privacy and Legal
- [PIPEDA Guidelines for Identification and Authentication (OPC)](https://www.priv.gc.ca/en/privacy-topics/identities/identification-and-authentication/auth_061013/)
- [OPC Guidance on Processing Biometrics (August 2025)](https://www.priv.gc.ca/en/privacy-topics/health-genetic-and-other-body-information/biometrics/gd_bio_org-final/)
- [Quebec Law 25 -- OneTrust Guide](https://www.onetrust.com/blog/quebecs-law-25-what-is-it-and-what-do-you-need-to-know/)
- [Quebec CAI Hiring Guidelines (March 2025)](https://www.talencore.com/blogs/post/quebec-s-new-privacy-guidelines-for-hiring-what-employers-need-to-know)
- [PIPEDA Compliance 2026 Guide](https://geotargetly.com/blog/pipeda-compliance-guide-to-canada-privacy-law)
- [DLA Piper -- Navigating Biometrics Under PIPEDA](https://www.dlapiper.com/en-au/insights/publications/2025/09/navigating-biometrics-under-pipeda)
- [Blakes -- New Federal Privacy Commissioner Guidance on Biometrics](https://www.blakes.com/insights/new-federal-privacy-commissioner-guidance-on-processing-biometric-data-in-the-private-sector/)

### AML and FINTRAC
- [FINTRAC Compliance 2025 (Airwallex)](https://www.airwallex.com/ca/blog/fintrac-compliance-2025-new-aml-rules-canadian-businesses)
- [Sumsub -- AML Laws in Canada 2025](https://sumsub.com/blog/how-to-stay-compliant-with-aml-laws-in-canada/)
- [Canada 2025 MSB & PSP Rules](https://7baas.com/canada-2025-msb-psp-fintrac-rpaa-regulations/)
- [DLA Piper -- New AML Regulations 2025](https://www.dlapiper.com/en/insights/publications/2025/01/navigating-new-aml-regulations-in-2025)
- [Trulioo -- FINTRAC Identification Guidelines](https://www.trulioo.com/blog/financial-services/fintrac-identification)

### Identity Documents and SIN
- [Canada.ca -- Identification Cards Recognition Index](https://www.canada.ca/en/public-services-procurement/services/industrial-security/security-requirements-contracting/organization-security-screening/about-organization/identification-cards-recognition.html)
- [Canada.ca -- About Identity Verification Requirements](https://www.canada.ca/en/public-services-procurement/services/industrial-security/security-requirements-contracting/personnel-security-screening/overview/about-identity-verification-requirements.html)
- [Canada.ca -- SIN Code of Practice](https://www.canada.ca/en/employment-social-development/services/sin/reports/code-of-practice.html)
- [Canada.ca -- SIN for Employers](https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-employers-sin.html)
- [Ontario Acceptable Identity Documents](https://www.ontario.ca/page/acceptable-identity-documents)

### Employment and Background Checks
- [OPC -- Privacy and Social Media in the Workplace](https://www.priv.gc.ca/en/privacy-topics/employers-and-employees/mobile-devices-and-online-services-at-work/02_05_d_41_sn/)
- [OPC -- Privacy in the Workplace](https://www.priv.gc.ca/en/privacy-topics/employers-and-employees/02_05_d_17)
- [Indeed Canada -- Checking Applicant Credit](https://ca.indeed.com/hire/c/info/employment-credit-check-canada)
- [Credibled -- Canada Employment Background Check Laws 2026](https://credibled.com/canada-employment-background-check-laws-are-changing-what-employers-need-to-know-in-2026/)
- [DLA Piper -- Quebec Privacy and Hiring Practices](https://www.dlapiper.com/en/insights/publications/2025/04/quebec-privacy-regulator-puts-spotlight-on-employee-hiring-practices)

### CASL
- [CRTC -- CASL Guidance on Implied Consent](https://crtc.gc.ca/eng/com500/guide.htm)
- [Canada.ca -- Getting Consent to Send Email](https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email)
- [Deloitte -- CASL FAQ](https://www.deloitte.com/ca/en/services/consulting-risk/perspectives/canada-anti-spam-law-casl-faq.html)

### Market Research and Pricing
- [Juniper Research -- Cost per Digital Identity Verification Checks](https://www.juniperresearch.com/resources/infographics/cost-per-digital-identity-verification-checks-to-drop-15-globally/)
- [Biometric Update -- Identity Verification Scale and Cost](https://www.biometricupdate.com/202412/identity-verification-scale-and-maturity-to-push-average-cost-down)
- [Trust Swiftly -- Identity Verification Pricing Comparison 2026](https://trustswiftly.com/blog/identity-verification-pricing-comparison-and-alternatives/)
- [HyperVerge -- Jumio Pricing Overview](https://hyperverge.co/blog/jumio-pricing/)
- [Finexer -- Onfido Pricing 2025](https://blog.finexer.com/onfido-pricing/)
- [HyperVerge -- Veriff vs Persona Comparison](https://hyperverge.co/blog/veriff-vs-persona/)

### Video KYC
- [Apizee -- Video KYC Guide 2026](https://www.apizee.com/video-kyc.php)
- [iDenfy -- Video KYC 2026](https://www.idenfy.com/blog/video-kyc/)
- [ShuftiPro -- Video KYC 2025](https://shuftipro.com/blog/video-kyc-in-2025-what-it-is-how-it-works-and-why-it-matters/)

---

## Summary of Key Recommendations for KindredCare

### Provider Stack
1. **Identity Verification:** ShuftiPro (as per business plan; broadest SDK support) with Veriff as cost-effective backup
2. **Background Checks:** Certn (Canadian, direct CPIC access, API-first, bundled reference + employment checks)
3. **AML Screening:** Bundled with Certn, supplemented by iComply if FINTRAC obligations arise
4. **Address Verification:** Trulioo (strongest Canadian data sources) or bundled with IDV provider

### Must-Do Legal Actions
1. Conduct Privacy Impact Assessment (required for Quebec operations)
2. Notify Quebec CAI before deploying biometric verification
3. Implement express consent flows for all biometric data collection
4. Establish data retention and deletion policies
5. Consult legal counsel on FINTRAC obligations (payment processing)
6. Implement CASL-compliant email consent and unsubscribe mechanisms

### Cost Projections
- **Per caregiver (Basic):** $43--$80 CAD
- **Per caregiver (Enhanced):** $78--$160 CAD
- **Per caregiver (Professional):** $108--$235 CAD
- **Per senior/family:** $2--$10 CAD
- **Monthly platform costs (1,000 caregivers/month):** Estimated $43,000--$80,000 (Basic tier at scale)

### Critical Operational Notes
1. Vulnerable Sector Checks CANNOT be done online -- design the flow around this limitation
2. Quebec requires stricter privacy measures than any other province -- build for Quebec first, then relax for other provinces
3. International caregiver verification requires patience -- international criminal checks can take months
4. Budget for 50%+ IDV pricing increases over the next 2 years based on industry trends
5. Consider passing verification costs to caregivers (industry standard) or splitting costs
