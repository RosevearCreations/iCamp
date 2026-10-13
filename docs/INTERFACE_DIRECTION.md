# iCamp Interface Direction — Operations Workbench

## Decision

iCamp uses one coherent **Operations Workbench** rather than creating a separate screen for every build.

The interface has four stable layers:

1. **Global workspace navigation** — Public, My Stay, Front Desk, Maintenance, Security, Store/POS, Staff, Foreman, Management, I.T./Analysis and Finance remain the primary role-oriented entry points.
2. **Property context** — operational screens select or inherit the current campground before displaying campground-scoped data.
3. **Object workbench** — the central surface assembles all relevant information for the selected domain object instead of scattering it across build-number pages.
4. **Task panels** — focused cards/panels expose the actions appropriate to the current object, permission and workflow.

Build numbers are implementation evidence, not primary navigation. They may appear inside a workbench to explain lineage while a feature is evolving, but the global application chrome must describe the product rather than an old build.

## Accommodation workbench

The current Accommodation Assembly becomes the first full implementation of this pattern.

It progressively combines:
- canonical accommodation identity and map linkage;
- campsite service, utility and physical-fit facts;
- cottage facilities and occupancy;
- turnover/housekeeping readiness;
- public site/cottage gallery management.

Later booking, status, pricing and availability builds should extend this workbench or consume its canonical records instead of creating duplicate accommodation identities.

## Public vs operational media

Build 028 reinforces a key interface boundary:

- **public gallery media** is curated guest-facing content with required alt text, optional captions, explicit hero ordering and responsive delivery variants;
- **internal operational media** remains in maintenance/housekeeping/security workflows and is never exposed merely because it belongs to the same accommodation.

## Responsive behavior

The workbench must remain usable on phone, tablet and desktop:
- summary rails collapse to stacked cards;
- media grids reduce columns rather than shrinking controls below comfortable touch size;
- forms preserve clear labels and full-width text areas on narrow screens;
- critical actions remain textual and keyboard accessible.

## Future evolution

The same interface model should be reused for:
- reservation workbench;
- guest/stay workbench;
- maintenance asset/work-order workbench;
- staff/employee workbench;
- finance/reconciliation workbench.

This keeps iCamp modular without making the user learn a new navigation model for every new build.
