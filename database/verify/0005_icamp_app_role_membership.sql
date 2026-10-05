-- Build 005 application-role membership verification.
\set ON_ERROR_STOP on

do $$
begin
  if not pg_has_role(current_user, 'icamp_app', 'MEMBER') then
    raise exception 'Migration/server principal must be a member of icamp_app';
  end if;
end
$$;

begin;
set local role icamp_app;
select current_user = 'icamp_app' as icamp_role_assumption_ok
\gset

\if :icamp_role_assumption_ok
\else
  \quit 1
\endif

rollback;
