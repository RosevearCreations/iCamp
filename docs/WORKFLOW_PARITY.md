# Telephone/SMS Workflow Parity Harness

## Purpose

Build 015 turns iCamp's omnichannel policy into an executable contract.

**No channel owns business logic.** Web/PWA, IVR/DTMF and SMS/MMS are interfaces over the same canonical domain commands. The parity layer only decides how a channel reaches that command or how it safely hands off when the step cannot honestly be completed in that channel.

## Registry

`lib/parity/core.mjs` contains the workflow parity matrix. Every registered workflow declares:

- a stable workflow identifier;
- its canonical domain command;
- audience;
- Web/PWA support;
- IVR/DTMF support;
- SMS/MMS support;
- whether stronger verification is required;
- a reason whenever a visual or channel exception exists.

The registry validator rejects invalid support levels, duplicate workflow IDs and accidental Web-only operational workflows.

## Support meanings

- **Full** — the channel can complete the workflow directly.
- **Guided equivalent** — the same canonical command is reached through a numbered or conversational flow.
- **Secure-link handoff** — the channel routes to a short-lived protected visual step.
- **Staff transfer** — automation is inappropriate or unsafe, so authorized staff take over.
- **Not applicable** — reserved for a genuinely meaningless channel pairing and requires a reason.

## Canonical adapters

The IVR and SMS adapters accept an `executeCanonicalCommand` function supplied by the domain layer.

The adapter does not recreate availability, pricing, authorization, maintenance, gate, payment or other business rules. It forwards a canonical command request with channel metadata so the same server-side validation remains authoritative.

Telephone/SMS identity from Build 013 remains separate from the parity harness. Caller ID and sender address are still routing hints, not authentication.

## Secure-link handoff

The harness accepts a provider-neutral `createSecureLink` dependency. It does not create, store or log raw bearer URLs itself.

A domain command can also return `requiresVisualStep`, allowing a guided workflow to switch to a protected visual handoff without moving the business rule into the channel adapter.

Examples include:

- hosted payment;
- an authenticated map or gallery;
- a protected management confirmation;
- a graphical report.

## Staff transfer

The harness accepts a provider-neutral `requestStaffTransfer` dependency. IVR workflows that are unsafe or inherently visual can transfer to staff instead of pretending a keypad can complete the task.

## Graphical-only tasks

The matrix explicitly marks graphical tasks such as polygon drawing, label positioning, photograph viewing and chart inspection.

Polygon drawing is inherently visual. Telephone can transfer to authorized staff, while SMS can provide a secure-link handoff to the protected editor. The resulting campground object remains addressable by future non-visual operational commands.

## Payment safety

The `payment.complete` workflow never collects raw card data in iCamp's custom IVR or SMS layer.

- Web/PWA uses the approved hosted/tokenizing payment flow.
- SMS uses a secure hosted-payment handoff.
- IVR uses staff/provider-hosted fallback until a compliant hosted IVR payment product is intentionally connected.

## Automated proof

Build 015 proves:

- every registry entry declares Web, IVR and SMS support;
- key guest workflows reach the same canonical command from IVR and SMS;
- key staff workflows reach the same canonical command from IVR and SMS;
- visual-only flows do not invoke a fake non-visual business implementation;
- SMS secure-link and IVR staff-transfer fallbacks are operational;
- payment does not enter raw card collection through the custom channel adapter;
- I.T. health exposes counts only, not identities, message bodies, keypad digits or secure links.

## Extension rule

Every later product build must register or update its workflow parity entry when it introduces a new user-visible operational workflow. A build is incomplete if it creates a Web-only operational workflow without an explicit, justified channel exception.
