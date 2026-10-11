# Build 021 — Advanced Polygon Editing

## Status
**IN DEVELOPMENT — feature branch verification pending.**

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

## Manual action
No manual user action is required to implement or promote Build 021 unless the connected Supabase project rejects the migration for an external account/configuration reason.
