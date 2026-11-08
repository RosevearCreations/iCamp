# iCamp Build 233 — Services, I.T. truth review and branch audit

## Campground service editor

The campground manager can open **Campgrounds → Services & booking add-ons**.
Its actions operate on the original Build 040 `booking_charge_catalog`; no
duplicate pricing or migration is introduced. Access is limited to separately
assigned campground staff holding `pricing.manage`, with an independent
database permission check, application-role RLS, organization/campground scope,
row-version concurrency protection and append-only audit events.

Common service templates include RV dumping, pump-out, fresh water, propane,
firewood, ice, equipment rental, extra vehicle and extra overnight guest.
New items start unpublished unless the owner explicitly selects publishing.
Prices are exact CAD cents, not floating-point checkout values. Availability
dates, per-booking quantity bounds and scope apply in the existing booking and
reservation quote flows. Archive is confirmed and cannot be undone.

**Not yet included:** global stock/capacity reservation, staff scheduling,
service fulfilment receipts, or automatic billing of an unselected service.
These belong to the next campground-focused builds. Old bookings retain their
immutable charged line snapshots.

## I.T. truth retirement audit

The original Build 156, Build 158 and QL-258 worksheets are retained as
**historical evidence**. The I.T. command now points to a current release
status screen. The old fixed disconnected/HOLD status is not treated as a
current live Comms state, nor as a prerequisite for managing campground
services, bookings or amenities.

The following are *still independently required* before activating them:

- A genuine live campground subscription billing provider and approved terms.
- Authorized external SMS/voice and physical-device/gate operations.
- Real, verified original-host migrations and privileged owner enrollment.

The current release-status page uses application runtime evidence; it does not
claim to verify independent GitHub checks, private owner signatures or an
authenticated remote Comms Hub session.

## Remote branch audit — 2026-11-08

The GitHub repository contained **45 remote branches** (including `dev` and
`main`) during the audit. Each additional branch was compared against **both**
protected branches. A branch is safe for normal deletion only when GitHub
reports it is not ahead of at least one protected branch.

**36 merged branches — candidates for deletion after checking current refs:**

```text
build-031-closeout
build-214-owner-sla-custody-aging
build-215-independent-anchors
build-216-checkpoint-rotation
build-217-custody-diversity
build-218-source-recheck
codex/icamp219-production
codex/icamp219-runner-manifest-closure
codex/icamp220-byte-custody-closure
codex/icamp220-production
codex/icamp221-dev
codex/icamp221-production
codex/icamp222-dev
codex/icamp222-main
codex/icamp223-dev
codex/icamp223-main
codex/icamp224-guest-options
codex/icamp224-production
codex/icamp225-mobile-stay
codex/icamp225-production
codex/icamp226-arrival-assistance
codex/icamp226-production
codex/icamp227-production
codex/icamp227-service-directory
codex/icamp228-owner-services
codex/icamp228-production
codex/icamp229-production
codex/icamp229-staff-amenity-board
codex/icamp230-production
codex/icamp230-shift-handoffs
codex/icamp231-escalation-followthrough
codex/icamp231-production
codex/icamp232-dual-shell
codex/icamp232-production
codex/ql364-source-health-dev
codex/ql364-source-health-main
```

**7 branches with unmerged commits — preserve pending human source review:**

```text
build-047-production-hardening
build-047-seasonal-yearly-assignment-foundation
build-048-guest-profiles-saved-stays
build-076-format-hardening
dependabot/npm_and_yarn/development-2ec881fe0e
dependabot/npm_and_yarn/pg-8.23.1
dependabot/npm_and_yarn/runtime-5f82055a37
```

**Deletion status:** This work environment's GitHub connection supports
reading branches and creating/merging PRs, but does not expose a branch-ref
delete operation; the local Git CLI has no authenticated push permission.
Therefore the branches are **not described as deleted**. Use GitHub's
branch-management UI or an owner-authenticated Git environment to remove only
verified merged branches, rechecking the heads before action. Never bulk-delete
the seven divergent refs without reviewing their unique commits.
