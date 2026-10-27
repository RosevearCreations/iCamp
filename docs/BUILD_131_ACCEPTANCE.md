# Build 131 — Reopened Exception Evidence Aging & Independent Continuity Oversight

- A separate authorized reviewer reassesses an explicit Build 130 owner reopening, recording the source pair, original independently verified closure proof, elapsed reopening age, overdue evidence, and an immutable evidence reference.
- Evidence marked independently reassessed must link to the **verified**, newer, same-reopening Build 130 follow-up receipt. Open findings cannot borrow that receipt. Overdue (30+ days) or escalated reopening evidence cannot be silently downgraded to an ordinary request.
- A different reviewer handles continuity recurrence oversight. Reviews are singly chained to the same reopening; reopened exceptions cannot acquire duplicate initial reviews or fork into competing follow-ups. Expired or escalated chains require renewed escalation or verified evidence.
- Continuity verification is blocked by unresolved peer recurrences, open owner dispositions, or recent escalation renewal. Read and insert permissions require finance owner rights at **both** campgrounds; RLS is forced and records are append-only. A verification **never** releases an operational hold, transfers money, or changes customer records.
- Operator forms provide an independent reassessment queue, a separate continuity watch, age/overdue snapshots, receipt selection and chronological audit history.
- Release gates: Prettier, ESLint, TypeScript, complete unit suite including Build 131, optimized Next.js build, migration 0161 with verification SQL, browser E2E, dependency audit, CodeQL and Secret Scan.
