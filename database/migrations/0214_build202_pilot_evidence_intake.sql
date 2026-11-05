-- Build 202: private, append-only intake of non-sensitive *claims*, not independent
-- attestations. No trust enrollment, signing, launch or channel activation.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values
 ('pilot.evidence.intake','Submit bounded source/device evidence references for independent pilot review','elevated'),
 ('pilot.evidence.review','Review unverified source/device evidence and enrollment holds','high')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join icamp_private.permission_catalog p on p.permission_key in ('pilot.evidence.intake','pilot.evidence.review')
where r.role_kind='template' and r.organization_id is null
  and r.role_code in ('owner_admin','it_admin')
on conflict(role_id,permission_key) do nothing;

create table icamp_private.pilot202_evidence_intake (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 source_class text not null check(source_class in
  ('real_device','independent_source_signer','hub_peer_enrollment','owner_test_authorization','signed_test_handshake')),
 evidence_ref text not null check(evidence_ref ~ '^(issue|ticket|review|owner|test|evidence|receipt)-[A-Za-z0-9][A-Za-z0-9._-]{4,79}$'),
 claimed_sha256 text not null check(claimed_sha256 ~ '^[a-f0-9]{64}$'),
 device_profile text check(device_profile is null or device_profile in
  ('PHONE_TOUCH','TABLET_TOUCH','DESKTOP_KEYBOARD','SCREEN_READER_KEYBOARD','OFFLINE_RECOVERY')),
 disposition text not null default 'SUBMITTED_UNVERIFIED' check(disposition='SUBMITTED_UNVERIFIED'),
 independent_verification boolean not null default false check(independent_verification=false),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(organization_id,campground_id)
  references public.campgrounds(organization_id,id) on delete restrict,
 check((source_class='real_device')=(device_profile is not null)),
 unique(campground_id,source_class,evidence_ref)
);
create index pilot202_evidence_campground_idx
 on icamp_private.pilot202_evidence_intake(campground_id,created_at desc,id desc);
create index pilot202_evidence_actor_fk_idx
 on icamp_private.pilot202_evidence_intake(actor_user_id);
create function icamp_private.pilot202_evidence_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Build 202 pilot intake is append-only'; end $$;
revoke all on function icamp_private.pilot202_evidence_immutable() from public;
grant execute on function icamp_private.pilot202_evidence_immutable() to icamp_app;
create trigger pilot202_evidence_immutable before update or delete
 on icamp_private.pilot202_evidence_intake for each row
 execute function icamp_private.pilot202_evidence_immutable();

alter table icamp_private.pilot202_evidence_intake enable row level security;
alter table icamp_private.pilot202_evidence_intake force row level security;
revoke all on icamp_private.pilot202_evidence_intake from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on icamp_private.pilot202_evidence_intake from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on icamp_private.pilot202_evidence_intake to icamp_app;
create policy pilot202_evidence_read on icamp_private.pilot202_evidence_intake
 for select to icamp_app using (
   icamp_private.has_campground_permission(campground_id,'pilot.evidence.review')
   or (actor_user_id=(select icamp_private.request_user_id())
     and icamp_private.has_campground_permission(campground_id,'pilot.evidence.intake')));
create policy pilot202_evidence_insert on icamp_private.pilot202_evidence_intake
 for insert to icamp_app with check (
   actor_user_id=(select icamp_private.request_user_id())
   and icamp_private.has_campground_permission(campground_id,'pilot.evidence.intake')
   and disposition='SUBMITTED_UNVERIFIED' and independent_verification=false);
comment on table icamp_private.pilot202_evidence_intake is
 'Submitted non-sensitive evidence reference and claimed digest only. Never a verified witness or active Comms Hub connection.';
