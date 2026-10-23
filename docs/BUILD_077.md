# Build 077 — Camper Assistance Request Interface

## Purpose

Build 077 advances historical roadmap Build 078 by replacing the My Stay
assistance placeholder with one canonical, stay-linked camper assistance intake.

Guests with a checked-in reservation can submit campground requests for
maintenance, garbage, septic, electrical, water, Wi-Fi, noise, security,
rental, store or other issues.

Each request records an operational priority, concise summary, optional details,
contact preference, source channel and the canonical reservation/accommodation.
Optional images or PDFs reuse the Build 008 secure-media validation and internal
storage boundary.

## Canonical authority

Build 077 owns intake evidence only.

- public.camper_assistance_requests is immutable submitted-request evidence.
- public.camper_assistance_request_events is append-only intake/media evidence.
- public.camper_assistance_request_media links validated Build 008 internal media.
- the reservation and accommodation remain canonical Build 035+ records.
- Build 078 owns triage, reclassification, assignment, escalation, guest
  communication, outcomes and closure.

No second reservation, guest, accommodation or media store is introduced.

## Active-stay boundary

The server derives organization, campground and accommodation from the selected
reservation. The request is accepted only when the signed-in account is an
active guest, the reservation belongs to that guest, and its status is
checked_in. A database trigger independently re-checks the stay relationship.

## Idempotency and concurrency

The form supplies a UUID client_request_id. The database enforces uniqueness on
guest + campground + client request ID. Retries return the prior request only
when the canonical payload matches; reuse with different details fails closed.

Media attachment count is serialized with a transaction advisory lock and
limited to five attachments per request.

## Media

Guest attachments reuse Build 008 MIME/extension/signature validation, the
internal-media bucket, server-generated object keys, SHA-256 checksums, private
media metadata and lifecycle evidence. Accepted media remains internal.

## Authorization and privacy

All three new public tables enable and force RLS. Guests can read only their own
assistance requests. New intake is allowed only for their checked-in reservation.
Existing operational permissions can read request intake where needed for
continuity; Build 078 adds the canonical triage/assignment workflow.

Direct anon and authenticated Data API grants are revoked. Application access
remains through the trusted server/icamp_app boundary.

## Emergency boundary

urgent means the campground should respond quickly. It does not mean emergency
dispatch and does not replace emergency services, life-safety procedures or
campground emergency contacts. The UI states this before submission.

## User experience

- /guest/assistance provides the full responsive Web/PWA intake and stay history.
- My Stay links directly to the canonical Build 077 form.
- a dedicated contextual help topic explains scope, priority and media handling.
- the campground-configured assistance URL remains an additional handoff only.

## Omnichannel contract

- Web/PWA: full request intake and validated media.
- IVR/DTMF: guided category/priority intake after identity verification using
  the existing assistance.request parity command.
- SMS/MMS: guided intake through the same canonical backend; visual evidence
  uses validated MMS or secure-link/staff-assisted handoff.
- no channel creates a parallel request database.

## Theme architecture

Build 077 uses existing semantic/global components and does not introduce a
theme-specific fork. Future visual themes remain bound to the shared semantic
theme ruleset.

## Automated proof

Build 077 adds unit/repository coverage for category, severity and contact
normalization, idempotency-key validation, deterministic request fingerprints,
active-stay validation, forced RLS/direct Data API denial, secure-media reuse,
My Stay integration, contextual help and Build 078 ownership boundaries.

## Manual action

None expected.

## Next build

Build 078 — Assistance Triage & Management Escalation, advancing historical
Build 079.


## Production evidence
- feature PR #290 and closeout/hardening PR #292 merged to `dev`;
- exact GREEN production-candidate `dev` SHA `8a83abd00c295dea5879f5c332a801d4c2dc7e84`;
- production PR #291 merged to `main`;
- production `main` SHA `f82c0402fbccdcea5512a5469b574f07ca635f67`;
- independent production push CI #39993067353, CodeQL #39993067258 and Secret Scan #39993067391 all succeeded;
- production CI Verify, Database migrations and Browser end-to-end all succeeded;
- hosted migrations `camper_assistance_request_interface` and `build077_advisor_hardening` applied;
- exact hosted Build 077 verification SQL passed and Supabase Security Advisor returned zero findings.
