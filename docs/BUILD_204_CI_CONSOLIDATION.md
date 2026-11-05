# Build 204 — Protected CI Workflow Consolidation

## Release goal

Validate changes targeting dev or main through pull requests, then verify the
deployed main commit again. Eliminate redundant dev push runs without removing
any required security, database, browser, or application checks.

## Event matrix

| Event | Before | Build 204 |
| --- | --- | --- |
| Dev push while dev → main PR is open | 3 push workflows + 3 PR workflows | 3 PR workflows |
| PR opened or updated against dev/main | 3 workflows | 3 workflows |
| Merge or direct authorized push to main | 3 workflows | 3 workflows |
| Weekly CodeQL schedule | 1 workflow | 1 workflow |

The five required jobs retain their workflow and job names:

1. CI / Verify
2. CI / Browser end-to-end
3. CI / Database migrations
4. Secret Scan / Gitleaks
5. CodeQL / Analyze JavaScript and TypeScript

This preserves branch-protection check identities and avoids a ruleset migration.
The three workflows remain separate to keep their current permission boundaries.

## Queue and evidence controls

- Every workflow has an independent concurrency group per PR number or ref.
- Only superseded PR runs may be canceled; main releases and weekly CodeQL
  evidence are not canceled.
- No required job gained path filters or weaker conditions.
- Dependency audit JSON, formatter failure diffs, and browser failure artifacts
  retain existing artifact names and retention settings.
- The build204:ci-contract verifier rejects event, gate, concurrency, and
  evidence-protection regressions.
- We expect three fewer workflow runs and five fewer protected job executions
  for each dev update with an open main-targeted PR. Main checks are unchanged.

## Release acceptance

1. Verify Build 204 contract and Node tests on exact dev head.
2. See all five protected PR jobs succeed.
3. Merge dev into main through protected PR review.
4. See all five protected main jobs succeed.
5. Check Vercel production READY, exact main SHA, version and readiness routes.

This build changes CI orchestration only. Build 203 original-issuer claims and
owner TEST consent are still HOLD; no production Comms Hub handshake is enabled.
