# iCamp Build 091 — Permanent-Unit Ownership-Backed Listing & Buyer Inquiry

## Delivery

Build 090's newer active queue displaced the historical permanent-unit ownership model. Build 091 therefore delivers the ownership prerequisite **together with** the roadmap's private listing and buyer-inquiry workflow, without presuming a finished sale/transfer workflow.

- Append-only source-linked ownership history for a permanent unit, independent of the land/campsite and seasonal occupancy agreement.
- Latest ownership evidence pins each immutable private listing draft.
- A separate authorized reviewer must approve or withdraw; the draft author cannot self-approve. A new owner event invalidates stale approved listings for subsequent inquiries.
- Staff-only buyer inquiry intake with a private contact/CRM reference, scoped to a currently approved listing.
- Management page and contextual ⓘ help, with no public advertisement, phone/SMS collection, title transfer, booking modification, financing or payment action.
- Private FORCE RLS, direct Data API grants revoked, database guards and FK indexes.

## Acceptance boundaries

Recorded ownership source references are **operator attestations**, not legal proof of title. Camp Rosevear may carry synthetic examples but must not be represented as an actual completed sale. Independent local review of deeds/bills of sale, campsite/lease terms, taxes, permits and applicable consumer requirements remains necessary. A future Build 092 will handle actual applications, inspections and transfer authorization.

## Verification

`tests/build091-permanent-unit-market.test.mjs` covers normalization, monetary precision, stale-owner invalidation and security contract. Migration `0123_permanent_unit_ownership_listings.sql` has a matching SQL verifier. Full format/lint/typecheck/test/Next build and PostgreSQL CI are release gates.

## Queue reconciliation

The latest Build 090 was the spring owner review, superseding an older 090 ownership entry. Build 091 now includes that missing ownership foundation to satisfy the dependency of the planned listing-and-inquiry scope. The next queued Build 092 is the permanent-unit sale/transfer workflow.
