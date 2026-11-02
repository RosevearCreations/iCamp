-- iCamp Build 005 follow-up
-- Add covering indexes for authorization foreign-key/query paths identified by
-- the hosted PostgreSQL performance advisor.

create index campground_assignments_scope_idx
  on icamp_private.campground_assignments (
    organization_id,
    campground_id
  );

create index role_permissions_permission_idx
  on icamp_private.role_permissions (
    permission_key,
    role_id
  );
