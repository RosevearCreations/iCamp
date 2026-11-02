# Build 017 — Campground, Section & Subsection Administration

## Status

**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope

Build 017 advances:
- multiple campground sections/subsections;
- ordering;
- active/inactive state;
- section-specific settings.

## Delivered design

- authenticated management route at `/workspaces/management/campgrounds`;
- campground selection limited to assignments carrying `campground.configuration`;
- campground name/timezone/lifecycle editing;
- section/subsection create and update workflows;
- numeric sort order;
- active/inactive lifecycle;
- bounded typed section settings;
- optimistic row-version conflict protection;
- PostgreSQL RLS insert policies for hierarchy creation;
- append-oriented audit evidence;
- contextual help and admin freshness controls.

## Omnichannel

- Web/PWA: full visual editor.
- IVR/DTMF: secure-link or staff-assisted fallback.
- SMS/MMS: secure-link or staff-assisted fallback.
- No caller ID, keypad input or text sender can bypass canonical authorization.

## Security and privacy

- all writes require `campground.configuration`;
- RLS retains the campground boundary;
- no production personal data is introduced;
- section staff notes are bounded to 500 characters in the application;
- settings payload is capped at 8 KiB in PostgreSQL;
- delete is not granted to `icamp_app`;
- later booking/access/map rules are not silently encoded here.

## Cost and portability

No new provider or paid service. The change uses the existing PostgreSQL, Next.js and React stack.

## Production evidence

Feature verification:
- feature SHA: `ccea5dafd7b56f5a4c325644c1b88933a3aa1f21`;
- PR #60 to `dev`;
- CI `37821549253` — success;
- CodeQL `37821549553` — success;
- Secret Scan `37821549171` — success;
- Browser end-to-end, Verify and Database migrations — success.

Independent `dev` verification:
- `dev` merge: `cb00fc66b0cb64219515582113a4a5d647a3442b`;
- zero file differences from the GREEN feature tree;
- CI `37821899216` — success;
- CodeQL `37821899346` — success;
- Secret Scan `37821899194` — success.

Protected production promotion:
- PR #61 from `dev` to `main`;
- production PR CI `37822157419` — success;
- production PR CodeQL `37822157392` — success;
- production PR Secret Scan `37822158112` — success;
- `main` merge: `1f4d619d40929dca6bce25f53bce1ca92b1bbe98`;
- zero file differences from the independently GREEN `dev` tree.

Independent `main` verification:
- CI `37822500643` — success;
- CodeQL `37822500454` — success;
- Secret Scan `37822500968` — success;
- Browser end-to-end, Verify and Database migrations — success.

## Manual action

None required.
