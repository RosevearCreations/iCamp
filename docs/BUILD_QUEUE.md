# iCamp Active Build Queue

Current program: iCamp2027

Status:
- Repository created.
- `main` is the production/release branch.
- `dev` is the integration branch.
- Master vision, architecture, security standard and detailed roadmap are initialized.
- **Build 001 — Repository Foundation & Engineering Guardrails: GREEN on dev.**
- Build 001 verification includes formatting, lint, strict TypeScript, tests, production build, production dependency audit and secret scanning.
- CodeQL is configured and eligibility-aware; this private repository requires GitHub Code Security/Advanced Security before private CodeQL analysis can run.

Next build:
**Build 002 — Responsive PWA Application Shell**

Build sequence is defined in `docs/BUILD_ROADMAP.md`.

Operating rule:
- Work primarily on dev.
- Promote to main only after the applicable build gates are GREEN.
- If manual input is unavoidable, provide exact step-by-step instructions.
- Otherwise proceed autonomously using connected tools.
