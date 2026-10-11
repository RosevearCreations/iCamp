# Build 021 — Advanced Polygon Editing

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
- move/duplicate;
- undo/redo;
- lock/unlock;
- hide/archive;
- precision and selection aids.

## Delivered design
Build 021 extends the Build 020 visual polygon editor without changing its source-image + normalized coordinate contract.

The editor adds:
- whole-polygon movement using the same canonical source coordinates as vertex editing;
- duplicate with source-polygon provenance;
- 50-step session undo/redo history for geometry edits;
- persistent lock/unlock, hide/show and archive/restore lifecycle state;
- server-side refusal to edit locked or archived geometry;
- 0.25/1/5/10 px precision steps;
- selected-vertex or whole-polygon keyboard/button nudge;
- snap-to-step, polygon bounds and centre calculations;
- previous/next vertex selection plus direct vertex selector controls;
- explicit active/archived management lists and visible lifecycle badges.

## Persistence and security
Migration `0023_advanced_polygon_editing.sql` adds:
- `is_locked`;
- `is_hidden`;
- `archived_at` / `archived_by_user_id`;
- `duplicated_from_polygon_id`;
- active-visibility, archive and provenance indexes.

All state changes remain campground scoped behind `campground.map`, use optimistic row-version checks and append audit evidence.

## Channel support
- Web/PWA: complete advanced visual editing.
- IVR/DTMF: graphical geometry is not keypad-equivalent; provide secure visual handoff or staff-assisted workflow.
- SMS/MMS: graphical geometry is not text-equivalent; provide secure visual handoff or staff-assisted workflow.

## Platform checkpoint
Supabase project `cxgszmpbeswdikzofvjv` remains the current hosted PostgreSQL/media backend. Build 021 creates no additional Vercel or Cloudflare project. See `docs/PLATFORM_DECISIONS.md`.

## Promotion evidence
- feature PR #76 tested head `d163ca4fe29702e19f52e764cddc524868a21c54`: CI `38097940493`, CodeQL `38097940490`, Secret Scan `38097940489` — GREEN;
- independently verified `dev` merge `dff5c853a8c1c87071f02ebafe867cfeabc189ed`: CI `38098046365`, CodeQL `38098046362`, Secret Scan `38098046355` — GREEN;
- production PR #77 on exact `dev` tree: CI `38099246732`, CodeQL `38099246678`, Secret Scan `38099246677` — GREEN;
- first production merge `3f20834949c676c0167b8cb7dd3cb14fec179292`: CI `38099351148`, CodeQL `38099350854`, Secret Scan `38099350862` — GREEN;
- hosted Supabase migration `20261011004005 / 0023_advanced_polygon_editing` applied successfully;
- hosted schema confirms `is_locked`, `is_hidden`, `archived_at`, `archived_by_user_id` and `duplicated_from_polygon_id`, plus all four Build 021 indexes;
- `anon` and `authenticated` retain no direct SELECT privilege on the private polygon table;
- Supabase Security Advisor reports zero findings after migration 0023.

## Manual action
No manual user action was required to implement, migrate, verify or promote Build 021.
