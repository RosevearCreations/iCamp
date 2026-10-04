# iCamp Security Standard

## Mandatory baseline
- Deny by default.
- Least privilege.
- Server-side authorization for every protected mutation.
- Database row-level/data boundary protections.
- No trust in client-supplied prices, roles, booking availability, inventory totals, financial totals, or payment status.
- Secrets never committed.
- Sensitive media private by default.
- Full audit trail for privileged/financial/booking/map/permission actions.
- Strong validation on every API boundary.
- Rate limiting and abuse controls for public endpoints.
- Payment card data handled by certified payment provider, not stored by iCamp.
- Verified and idempotent webhooks.
- Secure cookies/session configuration.
- CSP, CORS, CSRF strategy, XSS prevention and secure headers.
- Dependency and code scanning in CI.
- Environment isolation between dev and production.
- Production change traceability to commit SHA and migration version.

## Permission domains
- campground.configuration
- campground.map
- site.read
- site.manage
- reservation.read
- reservation.create
- reservation.modify
- reservation.cancel
- reservation.override
- payment.read
- payment.capture
- refund.issue
- discount.apply
- guest.read
- guest.manage
- maintenance.read
- maintenance.create
- maintenance.assign
- maintenance.complete
- incident.manage
- staff.read
- staff.manage
- role.manage
- schedule.manage
- timekeeping.manage
- pos.sell
- pos.refund
- inventory.read
- inventory.manage
- rental.manage
- event.manage
- vendor.read
- vendor.manage
- finance.read
- finance.manage
- reports.read
- audit.read
- announcement.send
- emergency.broadcast
- system.admin

## High-risk operations
High-risk operations should require explicit permission, reason capture, and audit event. Some may also require recent re-authentication or a second approver:
- role/permission edits
- owner/admin creation
- refunds above threshold
- manual payment state changes
- financial record adjustment
- deletion/export of sensitive data
- campground-wide closure
- emergency broadcast
- map publication replacing active map
- bulk reservation mutation

## Data classes
### Public
Published campground descriptions, public amenities, public site photos, published rates.

### Internal
Operational notes, staff schedules, work assignment information, inventory cost information.

### Confidential
Guest contact details, staff personal details, vendor contracts, financial records.

### Highly restricted
Authentication secrets, payment provider secrets, sensitive incident data, recovery material.

Access and retention must be appropriate to classification.
