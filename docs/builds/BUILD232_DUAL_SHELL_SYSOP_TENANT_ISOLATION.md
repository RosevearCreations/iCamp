# iCamp 232 — Dual-shell navigation, master authentication and tenant isolation

The iCamp application has two separate entry points with **no implicit privilege crossover**:

| Shell | Route | Access | Data boundary |
| --- | --- | --- | --- |
| Rosevear Sysop | `/sysop` | Staff session with fresh AAL2 MFA, active independently reviewed platform grant **and** verified Ree or Jack owner-slot binding | Aggregate counts, health link, Comms Hub help/discovery; **no tenant operations** |
| Campground product | `/campground` | Staff with an independent active campground assignment | Only assigned campgrounds; each linked module enforces its original permissions |

`/platform` remains a protected legacy aggregate-count view using the same reinforced gate.

## Operator enrollment and database deployment

Migration `0219_build232_sysop_master_owner_bindings.sql` establishes a private,
RLS-protected owner-binding register (at most the two slots `ree` and `jack`).
It **does not insert identities, activate grants or create new MFA factors**.
The existing platform grant requirement remains in force. An independently
authorized database/security operator must verify the original account owner,
record the applicable slot and independent verification reference, and ensure
the original platform grant is actively reviewed. Both the verified binding
and active grant, plus a real verified MFA factor, are required for entry.
No role is inferred from an email address, a Comms Hub account, or a campground
owner role. Original-host migration/application and owner identity enrollment
must be verified separately from CI success; until then Sysop remains closed.

The `/auth/mfa` flow supports a validated Sysop return destination and still
falls back to `/auth/account` for other or malformed destinations.

## Tenant security acceptance

- The tenant landing page lists only current assignments for that signed-in
  staff user. An arbitrary/unassigned `campground` query value is denied.
- Campground modules retain their own authorization enforcement; a Sysop
  binding cannot manufacture a tenant assignment.
- The Sysop data service selects aggregate organization, campground and
  active-account counts only. It never fetches guest profiles, payment records
  or reservations and provides no platform write controls.
- Comms Hub is linked for guidance/discovery, **not** live elevated access or
  independently authenticated tenant impersonation.
- Fail-closed handling prevents a missing original-host Build 232 table from
  falling back to older, broader platform grant behavior.

## Next campground-priority work

Build 233: Campground Service and Add-On Catalogue Editor — dumping stations,
water, propane and other campsite/booking add-ons, with tenant-owned prices,
capacity and availability controls. The Sysop shell remains observational.
