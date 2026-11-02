-- Build 188: safe read-only source reconciliation and immutable human exception reviews.
-- No gate/device commands, credential secrets, or physical authorization are issued.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values ('access.reconciliation.review','Record reasoned in-app credential reconciliation exception review','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,'access.reconciliation.review'
from icamp_private.roles r
where r.role_kind='template' and r.role_code in ('security','campground_manager','owner_admin')
on conflict do nothing;

create table icamp_private.access_reconciliation_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 credential_id uuid not null,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 disposition text not null check(disposition in ('acknowledged','override_reviewed')),
 reason text not null check(char_length(trim(reason)) between 20 and 1000),
 credential_status_snapshot text not null check(credential_status_snapshot in ('active','revoked')),
 source_status_snapshot text not null,
 observed_verdict text not null,
 credential_version_snapshot bigint not null check(credential_version_snapshot >= 1),
 observed_at timestamptz not null default statement_timestamp(),
 constraint access_reconciliation_reviews_credential_fk foreign key(organization_id,campground_id,credential_id)
  references public.access_credentials(organization_id,campground_id,id) on delete restrict
);
create index access_reconciliation_reviews_history_idx
 on icamp_private.access_reconciliation_reviews(campground_id,credential_id,observed_at desc);
create index access_reconciliation_reviews_actor_idx
 on icamp_private.access_reconciliation_reviews(actor_user_id);

create function icamp_private.guard_access_reconciliation_review()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 credential_row record;
 source_row record;
 expected_verdict text;
 overlapping integer := 0;
begin
 if tg_op <> 'INSERT' then
  raise exception 'Access reconciliation evidence is immutable';
 end if;
 if new.actor_user_id is distinct from nullif(current_setting('icamp.user_id',true),'')::uuid then
  raise exception 'Reconciliation review actor mismatch';
 end if;
 select c.* into credential_row from public.access_credentials c
   where c.id=new.credential_id and c.organization_id=new.organization_id
     and c.campground_id=new.campground_id and c.row_version=new.credential_version_snapshot
     and c.status=new.credential_status_snapshot;
 if not found then
  raise exception 'Credential review snapshot is stale';
 end if;
 select * into source_row from icamp_private.access_reconciliation_sources(new.campground_id)
  where credential_id=new.credential_id;
 if not found or new.source_status_snapshot is distinct from coalesce(source_row.source_status,'not_applicable') then
  raise exception 'Credential source review snapshot is stale';
 end if;
 if source_row.source_kind in ('visitor','vehicle_pass') then
  select count(*)::integer into overlapping from public.access_credentials c
   where c.campground_id=new.campground_id
    and c.subject_kind=credential_row.subject_kind
    and c.subject_reference_id=credential_row.subject_reference_id
    and c.status='active' and c.valid_from<=statement_timestamp()
    and (c.valid_until is null or c.valid_until>statement_timestamp());
 end if;
 expected_verdict := case
  when credential_row.status <> 'active' then 'revoked'
  when credential_row.valid_from > statement_timestamp() then 'not_yet_valid'
  when credential_row.valid_until is not null and credential_row.valid_until<=statement_timestamp() then 'expired'
  when source_row.source_kind in ('visitor','vehicle_pass') and source_row.source_status<>'active' then 'source_inactive'
  when source_row.source_kind in ('visitor','vehicle_pass') and (
    source_row.source_valid_from is null or source_row.source_valid_until is null or
    source_row.source_valid_from>statement_timestamp() or source_row.source_valid_until<=statement_timestamp())
   then 'source_outside_window'
  when source_row.source_kind in ('visitor','vehicle_pass') and overlapping>1 then 'duplicate_assignment'
  when source_row.source_kind='reservation' and source_row.source_status<>'checked_in' then 'stay_inactive'
  when source_row.assignment_status is not null and source_row.assignment_status<>'active' then 'assignment_ended'
  else 'valid_in_app' end;
 if new.observed_verdict is distinct from expected_verdict then
  raise exception 'Credential review verdict does not match canonical source';
 end if;
 return new;
end $$;
create trigger guard_access_reconciliation_reviews
before insert or update or delete on icamp_private.access_reconciliation_reviews
for each row execute function icamp_private.guard_access_reconciliation_review();

alter table icamp_private.access_reconciliation_reviews enable row level security;
alter table icamp_private.access_reconciliation_reviews force row level security;
revoke all on icamp_private.access_reconciliation_reviews from public,anon,authenticated;
grant select,insert on icamp_private.access_reconciliation_reviews to icamp_app;
create policy access_reconciliation_reviews_read on icamp_private.access_reconciliation_reviews
for select to icamp_app using (
 icamp_private.has_campground_permission(campground_id,'access.credential.issue')
 or icamp_private.has_campground_permission(campground_id,'access.credential.revoke'));
create policy access_reconciliation_reviews_write on icamp_private.access_reconciliation_reviews
for insert to icamp_app with check (
 icamp_private.has_campground_permission(campground_id,'access.reconciliation.review')
 and actor_user_id=nullif(current_setting('icamp.user_id',true),'')::uuid);

-- Returns only source status and bounded references. Visitor contact, driver name,
-- license plate, phone and credential bearer material never cross this boundary.
create function icamp_private.access_reconciliation_sources(p_campground_id uuid)
returns table(credential_id uuid,source_kind text,source_number text,
 source_status text,source_valid_from timestamptz,source_valid_until timestamptz,
 assignment_status text)
language sql stable security definer set search_path='' as $$
 select c.id,
  case when p.id is not null then p.link_kind
    when a.id is not null then 'reservation' else 'unlinked' end,
  case when p.link_kind='visitor' then v.visitor_number
    when p.link_kind='vehicle_pass' then vp.pass_number
    when p.id is not null then p.pass_number
    when a.id is not null then 'Stay-linked credential' else null end,
  case when p.link_kind='visitor' then v.registration_status
    when p.link_kind='vehicle_pass' then vp.pass_status
    when a.id is not null then r.status
    else 'not_applicable' end,
  case when p.link_kind='visitor' then v.valid_from
    when p.link_kind='vehicle_pass' then vp.valid_from else null end,
  case when p.link_kind='visitor' then v.valid_until
    when p.link_kind='vehicle_pass' then vp.valid_until else null end,
  a.lifecycle_state
 from public.access_credentials c
 left join public.access_passes p on p.organization_id=c.organization_id
  and p.campground_id=c.campground_id and p.credential_id=c.id
 left join public.visitor_registrations v on v.organization_id=p.organization_id
  and v.campground_id=p.campground_id and v.id=p.visitor_registration_id
 left join public.vehicle_passes vp on vp.organization_id=p.organization_id
  and vp.campground_id=p.campground_id and vp.id=p.vehicle_pass_id
 left join public.reservation_access_credential_assignments a on a.organization_id=c.organization_id
  and a.campground_id=c.campground_id and a.credential_id=c.id
 left join public.reservations r on r.organization_id=a.organization_id
  and r.campground_id=a.campground_id and r.id=a.reservation_id
 where c.campground_id=p_campground_id
  and (icamp_private.has_campground_permission(p_campground_id,'access.credential.issue')
   or icamp_private.has_campground_permission(p_campground_id,'access.credential.revoke'))
$$;
revoke all on function icamp_private.access_reconciliation_sources(uuid) from public,anon,authenticated;
grant execute on function icamp_private.access_reconciliation_sources(uuid) to icamp_app;
