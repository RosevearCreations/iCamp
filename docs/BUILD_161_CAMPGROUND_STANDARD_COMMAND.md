# iCamp Build 161 — Campground Operations Command and Standard Theme expansion

Status: implementation and promotion evidence must be verified independently of the cross-application connection HOLD.

## What is real in this build

- New read-only Management Operations Command at `/workspaces/management/command`. Only an authenticated assigned campground staff user with `reports.read` for the selected property can open it. Each upstream service performs its own permission checks.
- Campground selection is restricted to the signed-in user's **report-authorized assignments**. No global/multi-tenant totals are mixed into a property panel.
- Four concise KPI cards populated from existing authorized reservation/maintenance services: active site count, arrivals within seven campground-local dates, open maintenance orders and reservation financial-review flags.
- The reservation service returns **at most 250 rows**; arrivals and review flags are *visible-row counts*, not all-time authoritative totals. When the source fails or access is absent, `—` and a specific source/permission message replace numbers; no fake zero and no guessed trends.
- Next-arrival and open-maintenance queues link to the original management workspaces. The maintenance blocked/open progress bar is calculated from actual returned work-order statuses.
- Searchable, category-filtered launcher for campground-specific booking, guest, site, security, maintenance and admin tools. Only tools for which the user has source route permissions are shown, and deeper routes re-authorize.
- Existing Standard theme extends its forest, fresh-meadow, navy, grass and status-color design to these panels. The header/management dashboard link and sidebar link are direct, responsive routes.

## Interface PDF recreation map

The owner-provided generic *UI Application Recreation Specification* describes a workshop operations application. iCamp adopts layout/interaction semantics, not workshop records:

| Reference interface | iCamp equivalent / implementation status |
| --- | --- |
| Admin Dashboard | Build 161 Management Command: KPIs, queues, workspaces, posture |
| Product Management | Existing accommodation inventory editor; linked by category filter |
| Inventory & Stock | Existing active accommodations; site-status counts, inventory drill-down |
| Orders & Fulfillment | Existing reservation-management and arrival queue; linked |
| Customer Requests | Existing guest-assistance triage; linked, not duplicated |
| Production Calendar | Existing live availability and booking dates; linked |
| Workstations & Capacity | Existing maintenance and site availability; open/blocked progress |
| Analytics & Reports | Real visible-row metrics in Build 161; broader analytics remain further work |
| Shop Preview | Existing public booking map; direct jump |
| Settings & Configuration | Existing Standard theme settings, subscription and I.T. controls; linked |

## Safety and validation contract

- Do not enable live tenant billing, create live subscriptions, use live webhooks, or substitute sandbox lifecycle fixture results for provider acceptance.
- Subscriber terms have **no live owner approval**; the versioned agreement gate remains HELD.
- Cross-application Omnichannel gateway remains **DISCONNECTED / HOLD** pending independently verified original proof and scoped TEST-only approval. No calls, texts, dispatch or authenticated inter-app GETs from this dashboard.
- Check `npm run verify`, GitHub dev/main CI, Vercel production deployment **at the exact main commit**, and `/api/version` plus production HTTP smoke before reporting Production GREEN.
- If a Vercel plan cap blocks production promotion, preserve the green `main` merge and report production as **NOT GREEN** until a genuinely READY immutable deployment and public smoke prove otherwise.

## Next recommended iteration

Build 162 — Campground Capacity & Occupancy Analytics, Camper Assistance Board, and Standard Theme Owner Acceptance (Billing / Omnichannel HELD).
