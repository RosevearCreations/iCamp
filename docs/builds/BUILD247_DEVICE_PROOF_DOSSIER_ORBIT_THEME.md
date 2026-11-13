# iCamp Build 247 — independent device proof, calibration source closure and Orbit Command

## PDF-driven visual refresh

The owner-supplied Generic Workshop Operations UI & Workflow Recreation Specification shows a two-layer administrative navigation, a left rail, dark navy surfaces, restrained violet accents, compact KPI cards, status-color semantics and responsive page panels. The most relevant visual references are the Admin Dashboard (PDF p.5) and Shared Shell and Design System (PDF p.25). The PDF describes maker-business functions, not campground workflows; no workshop catalog, stock count or order data has been imported into iCamp.

Orbit Command is implemented as a scoped visual layer: app/orbit-theme.css, loaded after the existing CSS. Both the campground AppShell and read-only SysopShell opt into data-visual="orbit". The product-level shell and Sysop shell share midnight-navy, violet, cyan and semantic status colors; typography and panel density are cleaner; desktop uses top navigation and a persistent rail; tablet and mobile collapse navigation; reduced-motion and high-contrast preferences persist. No fixed fake KPI values, synthetic deployment statuses, or permission bypasses are introduced.

The technical Sysop shell remains a platform observation plane. It does not link directly to guest booking records or acquire campground access. Each tenant requires an independent active assignment.

## Source custody features

1. Ed25519 source-bound device challenge verification requires a separately enrolled public-key pin and independently authenticated SHA-256 SPKI fingerprint in protected runtime settings. The verified message binds campground, dispatch, mobile field report, current original-source review, exact deployed Git SHA, original evidence digest, key ID, nonce and UTC challenge time. A five-minute freshness window and a durable unique key/nonce constraint prevent stale and replayed requests. It never accepts a public key from the browser. Until an independent verifier custodian actually enrolls the pin, the action fails CLOSED and no device signature is accepted. Existing iCamp archive/portability signers are separate roles and must not be reused.

2. Calibration exception closure is owner-only, append-only and source-derived: the latest supervisor mitigation follow-up must be independently rechecked against original eight-hour source events. A source-reconciled decision does not certify a model, close an external service obligation, authorize payment or constitute owner operational acceptance.

3. Owner acceptance dossier continuity stores an append-only hash chain of sanitized counts, a source revision, previous snapshot ID and digest, without raw report notes, worker identifiers or guest records. The owner-only private JSON export includes this lineage and retains explicit unsigned/HOLD labels.

## Verification and release

Mandatory gates: formatting, lint, TypeScript, test suite, Next.js production build, PostgreSQL migration 0231 plus isolated verifier and repeat-migration contracts, real Chromium browser tests, CodeQL and secret scanning. Promote via protected dev and main PRs, then independently inspect Vercel READY, public version/health endpoints, manifest and convergence exact commit, runtime errors and private owner export access where supported.

## Not accepted by a code deployment alone

Independent Ed25519 public-key custody and enrollment, original-device signed packet admission, independent original field-device authority, live DB migration installation, external replay custody, master source signer, signed HEALTHY source receipt, master CONNECTED and formal owner operational acceptance remain HOLD until specifically evidenced. A source SHA-256 digest is not a cryptographic signature and a deployment READY flag does not certify those independent authorities.
