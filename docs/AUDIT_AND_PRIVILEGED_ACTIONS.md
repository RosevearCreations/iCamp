# iCamp Audit Trail & Privileged Action Controls

## Purpose

Build 006 adds the reusable evidence and safety controls that later money, access, role, map-publication, safety and system-administration workflows must use.

Authorization answers **may this identity perform the action?**

Build 006 additionally answers:
- why was the privileged action performed;
- when did it happen;
- who performed it and in which campground/organization scope;
- what permission/risk class governed the action;
- whether recent re-authentication was present when required;
- what state changed, where practical.

## Append-only audit evidence

Canonical audit events live in `icamp_private.audit_events`.

Audit rows are append-only:
- application code inserts new evidence;
- a database trigger rejects UPDATE and DELETE;
- IDs, actor/session references and scope identifiers are snapshots rather than cascading foreign keys so later record lifecycle changes do not silently rewrite history.

Audit events may include:
- actor user/session;
- organization/campground scope;
- stable action key;
- governing permission;
- risk level;
- outcome;
- reason;
- subject type/id;
- request/correlation reference;
- before/after JSON objects;
- non-sensitive metadata;
- re-authentication time and assurance level.

Passwords, session tokens, recovery tokens, PINs, MFA secrets, payment credentials and similarly sensitive values must never be copied into audit JSON.

## Reason capture

Elevated and high-risk audit events require an explicit reason.

Application controls normalize the reason and require 8-500 characters. This is intentionally long enough to discourage meaningless single-character acknowledgements without requiring a long narrative.

Later user interfaces must present this as a clear reason/justification field rather than silently manufacturing a reason.

## Recent re-authentication

`icamp_private.auth_sessions.reauthenticated_at` records the most recent successful authentication/re-authentication point associated with the session.

A fresh password sign-in/session starts with a fresh re-authentication timestamp.

High-risk action controls currently require:
- a valid assurance level;
- re-authentication no more than 10 minutes old;
- an explicit reason.

The helper is assurance-level aware so later MFA/AAL2 policy can be enabled without replacing the audit model.

Build 006 does not claim that every future high-risk action is already implemented. It provides the reusable hook each later domain build must call.

## Transactional evidence

Where a privileged database mutation is implemented, its successful audit event should be written in the **same database transaction** as the state change.

This prevents a successful mutation from committing without its evidence row.

If an operation is provider-backed and cannot share a database transaction, later builds must record intent and provider outcome as separate append-only events with correlation/idempotency identifiers.

## Before/after state

Before/after evidence is captured where practical and safe.

Rules:
- store only the minimum useful fields;
- prefer stable IDs, state names and role/permission lists;
- redact or omit credentials and sensitive personal content;
- do not treat an audit row as a replacement for the canonical business record.

## Build 006 integrated privileged actions

The existing Build 005 role-management services are the first consumers:
- custom-role creation;
- campground staff-role assignment.

Both are protected by explicit permissions, high-risk recent re-authentication, required reason capture and transactional audit evidence.

Later builds must apply the same foundation to refunds, gate overrides, map publication, safety enforcement, financing, system administration and other elevated/high-risk operations.

## Channel rule

Web/PWA, IVR/DTMF and SMS must never bypass the canonical privileged-action controls.

A non-visual channel may gather a reason and verified identity, or hand off to a secure visual flow, but it cannot downgrade permission, re-authentication, confirmation or audit requirements.
