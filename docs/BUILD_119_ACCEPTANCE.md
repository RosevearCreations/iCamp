# Build 119 — Independent Closure Recheck Exception Follow-Up & Owner Decision Aging

- Private owner view identifies independent closure rechecks that await an owner decision, including those 30+ days old, and dates future owner follow-ups as pending, overdue, or overdue 30+ days. Dates are UTC; indicators do not change cases or holds.
- Directed-pair authorized owners append one immutable decision per independent closure recheck: keep exception open, request evidence, manually escalate, or acknowledge an independently closed *audit*.
- The database requires pending follow-up dates within 90 days. A closed independent audit can only receive an owner acknowledgment with no future due date; an open exception cannot be acknowledged closed. Owner decision-maker differs from the independent rechecker. All records retain forced RLS, pair scope and append-only history.
- No operational case closure, payments, transfers, automatic hold release, public endpoints or messaging are introduced.
- Gates: full `npm run verify`, migration and SQL verification `0149`, CI/browser tests, Secret Scan and CodeQL on feature/dev/main promotion PRs.

Next expected: **Build 120 — Owner Closure Decision Recurrence, Overdue Escalation & Independent Follow-Up Review**.
