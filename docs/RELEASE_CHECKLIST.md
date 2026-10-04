# iCamp Release Checklist

A release/promotion is GREEN only when all applicable items pass.

## Code
- [ ] Formatting passes.
- [ ] Lint passes with zero warnings.
- [ ] TypeScript strict typecheck passes.
- [ ] Automated tests pass.
- [ ] Production build succeeds.
- [ ] Dependency audit has no unresolved high/critical vulnerability.
- [ ] Secret scan passes.
- [ ] Code scanning has no unresolved blocking result.

## Security and data
- [ ] Authentication/authorization changes reviewed.
- [ ] Least-privilege permissions verified.
- [ ] Sensitive data classification reviewed.
- [ ] Audit requirements implemented.
- [ ] Inputs validated server-side.
- [ ] Concurrency/idempotency considered for reservation, payment and inventory writes.
- [ ] New secrets live only in approved secret stores.

## Product
- [ ] Requirement acceptance criteria pass.
- [ ] Mobile/tablet/desktop implications reviewed.
- [ ] Accessibility implications reviewed.
- [ ] Failure/empty/loading states reviewed where applicable.

## Operations
- [ ] Migration/backward compatibility reviewed where applicable.
- [ ] Rollback path identified.
- [ ] Documentation updated.
- [ ] dev is healthy before production promotion.
- [ ] production version is traceable to a commit SHA.
- [ ] production smoke check passes after promotion.
