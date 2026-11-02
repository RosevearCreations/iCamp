# Build 117 — Independent Reassessment Evidence Gap Aging & Owner Action Reconciliation

- A private owner screen now classifies independent reassessments as unreconciled, unreconciled 30+ days, awaiting follow-up, overdue, overdue 30+ days, evidence submitted, or owner reconciled. The displayed age is informational; it never auto-clears a hold.
- Directed-pair owner administrators may append evidence requests, evidence-submitted receipts, manual escalations, and owner reconciliation notes with source references and rationales. Requests/escalations have due dates within 90 days, enforced by application and database.
- The database rejects reconciliation without a preceding evidence-submitted action, a different owner than the independent reassessor, or with captured continued holds or overdue plans. It rejects action on a previously reconciled record and preserves an append-only history under forced pair-scoped RLS.
- Owner reconciliation is an audit annotation, not an independent release, transfer, payment, final case closure or notification. No new public, IVR or messaging pathways.
- Gates: `npm run verify`, migration and verification `0147`, protected feature/dev/main CI with browser tests, Secret Scan, and CodeQL.

Next expected: **Build 118 — Owner Evidence Reconciliation Exception Recurrence & Independent Closure Recheck**.
