# Build 017 — Campground, Section & Subsection Administration

## Status

**IN DEVELOPMENT — feature branch verification pending.**

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

## Manual action

None expected.
