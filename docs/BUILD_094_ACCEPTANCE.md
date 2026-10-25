# iCamp Build 094 — Financing Terms & Independent Offer Authorization

## Delivered

1. Transfer-authorized office staff prepare immutable, versioned non-binding term illustrations against a Build 093 independently completed financing intake. Principal cannot exceed the requested amount; annual nominal rate is 0–60% in integer basis points; term is 1–240 months; separate upfront fee is explicit. The monthly principal/interest estimate uses a documented nominal-rate amortization assumption and is not a legal APR/total cost quotation.
2. Drafts record finance policy and regional disclosure document IDs. A separate authorized reviewer must be independent from the original intake opener, intake triage reviewer and terms author. Each decision is immutable: reject or **authorize internal preparation only**. Stale, duplicate approved, closed sale, incomplete intake and inactive property conditions reject approval.
3. Campground-scoped FORCE RLS, append-only SQL triggers, no direct Data API grants, synchronized approval/draft concurrency and dedicated Web/PWA staff screen. Contextual ⓘ help explains limits.

## External/legal boundary

- This module does **not** make credit eligibility decisions, issue lending offers, send terms to applicants, generate legally sufficient borrower disclosures, sign a contract, move funds, post receivables, transfer unit ownership or create land/occupancy rights.
- Actual cost-of-credit disclosures, licensing, lender authority, applicable jurisdictional requirements, fee/tax handling and borrower consent need independent legal/compliance review before any real customer-facing offer workflow. The app stores opaque source pointers rather than private credit documents.
- IVR/DTMF/SMS only provide staff referral; no automated rate quoting or authorization. Synthetic Camp Rosevear must never be sent to a real lender.

## Evidence and deployment

- Database migration `0126_permanent_unit_financing_offers.sql`, matching SQL verifier, unit tests and full app verification.
- Feature → `dev` → `main` promotion must pass all security, database, browser and production-branch CI checks.

## Next queued

Build 095 — Applicant Offer Delivery Consent, Versioned Disclosures & Manual Sign-Off Boundary (design-first; no automatic offer issuance).
