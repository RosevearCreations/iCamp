-- Build 199: explicit, split permission families for isolated subscription
-- fixture runs versus independent review. This migration DOES NOT enable any
-- checkout, production billing, provider secret, or legal consent write path.
insert into icamp_private.permission_catalog(permission_key, description, risk_level)
values
  ('subscription.sandbox.run', 'Run authenticated, local-only SaaS billing lifecycle fixtures', 'elevated'),
  ('subscription.sandbox.review', 'Independently review sandbox results and legal gate evidence', 'high')
on conflict (permission_key) do nothing;

insert into icamp_private.role_permissions(role_id, permission_key)
select r.id, p.permission_key
from icamp_private.roles r
join icamp_private.permission_catalog p
  on (r.role_code='it_admin' and p.permission_key='subscription.sandbox.run')
  or (r.role_code='finance' and p.permission_key='subscription.sandbox.review')
  or (r.role_code='owner_admin' and p.permission_key in ('subscription.sandbox.run','subscription.sandbox.review'))
where r.role_kind='template' and r.organization_id is null
on conflict (role_id, permission_key) do nothing;

comment on column icamp_private.permission_catalog.permission_key is
  'Build 199 adds separated subscription.sandbox.run/review roles; neither grants real billing execution or legal publication.';
