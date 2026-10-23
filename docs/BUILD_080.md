# Build 080 — Paid Garbage Stickers/Tags & Pickup Redemption

## Delivered

- Campground-scoped tag issuance, one unique serial per verified staff-attested POS/external receipt; CAD-cent amount, stream, site and optional checked-in reservation snapshot.
- A sale retry UUID prevents duplicate issuance. Staff may print the tag's GT-code as text or encode that exact value in their barcode/QR label system; barcode artwork and direct POS integrations are **not** claimed.
- Single-use redemption against an existing, open, matching paid-on-demand garbage pickup. Transaction row locks, database uniqueness and immutability prevent concurrent double redemption. Idempotent repeated redemption against the same pickup is safe.
- Accessible Maintenance → Garbage → Paid tags view, issued-history cards, permission-gated issue/redeem actions, and contextual information-circle help.
- Forced RLS and application-role-only access; auditable references to verified receipts rather than invented payment-provider captures. Ledger retains issued and redeemed timestamps and staff identities.
- SQL migration/verification, repository contract tests, and a release pipeline through dev and main.

## Important financial boundary

This is a **verified-receipt handoff**, not a payment gateway or tax invoice. Staff must check payment outside this screen; `receipt_reference` is an attestation, not independent processor verification. Existing `reservation_payments` only supports reservation dues, so inserting unrelated garbage sales there would misstate canonical financial data. The tag redemption does not silently change `garbage_pickup_requests.billing_state` or create a maintenance work order. Reconciliation and provider integration remain future work.

## Next

Build 081 can add detailed waste route/collection proof and finance reconciliation, subject to the queue roadmap.
