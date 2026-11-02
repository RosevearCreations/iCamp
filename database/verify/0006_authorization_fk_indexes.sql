-- Build 005 authorization index verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('icamp_private.campground_assignments_scope_idx') is null then
    raise exception 'Missing campground assignment scope index';
  end if;

  if to_regclass('icamp_private.role_permissions_permission_idx') is null then
    raise exception 'Missing role permission-key index';
  end if;
end
$$;
