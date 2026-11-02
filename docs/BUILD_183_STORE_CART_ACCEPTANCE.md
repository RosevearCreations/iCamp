# Build 183 — Guest Store Catalogue, Cart Draft & Campsite Delivery Planning

## Guest experience

- `/store` provides filterable, published campground products with staff-reviewed name, SKU, category and description. Staff-reported counts are accompanied by their review timestamp. Missing counts display **unverified**, not fabricated availability; no product prices or guarantees are invented.
- `/guest/store` requires an active signed-in guest and saves one independent campground cart draft per guest, readable on the guest's other signed-in devices. Adding/changing/removing items safely returns a previously submitted/reviewed cart to draft and clears stale pickup/delivery choice for revalidation. Unpublished products remain identified in existing carts, but cannot be added or submitted for renewed review.
- Guests may save an office pickup discussion preference. A campsite delivery discussion requires an owned, **confirmed/checked-in** reservation at the same campground, and a campground-local date within the reservation's arrival-inclusive/departure-exclusive stay that is not already past. Optional guest notes are bounded to 400 characters and never appear in audit snapshots.
- Guests can separately request internal staff review of nonempty drafts. Statuses are `draft`, `submitted`, `reviewed` and `declined`. None of these statuses means checkout, purchase, guaranteed stock, packed goods, or delivery scheduled.
- Without the database configuration, the routes fail closed and explain the office handoff. Staff can help via existing nonvisual/telephone channels but no automated omnichannel transaction is activated.

## Internal functionality and boundaries

- `/workspaces/management/campgrounds/store` requires `inventory.manage`. The `campground_manager` template receives that existing permission. Staff may create/modify drafts, explicitly publish reviewed listings, timestamp stock observations and unpublish listings. SKU uniqueness and version-checked saves protect data quality.
- A scoped review queue shows only submitted/reviewed/declined carts. Staff may mark a `submitted` cart `reviewed` or `declined`. There is no order creation, price/tax commitment, card capture, stock decrement/hold, POS session, courier routing, label generation, provider call, guest notification or automated dispatch. Build 192 will address inventory/POS reconciliation, with its own explicit authorization gates.
- Private catalog, cart and line tables have forced RLS and no direct `anon`/`authenticated` or `icamp_app` access. Composite tenant foreign keys, owned-stay validation triggers, active-guest checks, nonempty review checks, limits and transaction-serialized cart edits prevent cross-tenant data access and unsafe submission. Additional indexes cover new foreign-key lookup paths. Writes produce scoped private audit events without recording guest notes.
- Inventory and cart readback is authoritative only for the stored staff snapshot and guest draft, never for actual present physical stock. Billing and Omnichannel remain **HELD / DISCONNECTED**.

## Release gates

1. Apply `database/migrations/0193_build183_store_catalog_cart_drafts.sql` and `database/migrations/0194_build183_store_fk_index_hardening.sql`; run both matching `database/verify/` scripts and inspect Supabase security/performance advisors.
2. Run `tests/build183-store-cart.test.mjs`, full `npm run verify`, and `npm run parity:verify`.
3. Push the exact candidate tree through `dev`, require GitHub CI/CodeQL/Secret Scan success and Vercel preview READY with matching SHA.
4. Merge `dev→main` without force; require Vercel production READY at the merged SHA; read back `/api/version`, `/api/health/ready`, `/status`, `/store`, guest/staff route protection and zero new runtime errors.

## Next build

**Build 184 — Guest Feedback, Service Recovery & Moderated Reviews (Billing / Omnichannel HELD).** Verified-stay feedback and owned case progress, staff moderation/triage and service recovery readback, without unsanctioned outreach, refunds or public personal-data exposure.
