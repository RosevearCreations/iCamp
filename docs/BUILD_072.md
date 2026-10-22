# Build 072 — Roads, Utilities, Garbage & Septic Maintenance

Status: **IMPLEMENTED — PROMOTION PENDING**

Build 072 advances the historical infrastructure-maintenance roadmap for canonical `road`, `parking`, `utility`, `garbage_area` and `septic_area` operational assets.

## Delivered

- one infrastructure-maintenance program per canonical infrastructure asset;
- exact facility/profile matching for road, parking, utility, garbage/recycling and septic assets;
- recurring maintenance through Build 067 and inspections/sign-off through Build 068;
- append-only surface/access, safety and infrastructure-service evidence;
- same-asset database guards across program, template, schedule, inspection occurrence and work order;
- corrective issue escalation through the canonical Build 065 work-order engine and Build 066 foreman/escalation;
- operating restrictions, closures and return-to-service through the canonical Build 030 asset-status engine;
- Web/PWA program, scheduled inspection, condition, operating-state and corrective-work controls;
- forced RLS, explicit public/anon/authenticated revokes and minimum `icamp_app` privileges;
- no duplicate infrastructure registry, scheduler, checklist, work-order, issue-closure or operating-state authority.

## Omnichannel contract

- **Web/PWA:** full operational controls.
- **IVR/DTMF:** shared canonical asset/work-order/status facts are supported; visual inspection entry safely falls back to Web/PWA.
- **SMS:** shared status and maintenance workflow facts are supported; complex inspection/condition entry safely falls back to Web/PWA.

## Theme prerequisite

Build 068 remains binding. Future graphical/style work must continue to use the standard multi-theme semantic-token ruleset.

## Promotion evidence

Pending feature CI, hosted migration verification, Supabase advisor review, `dev` verification and clean `main` production promotion.
