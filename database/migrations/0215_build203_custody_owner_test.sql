-- Build 203. Durable claims and authenticated owner TEST intent only; neither
-- creates independent issuer authority, a peer enrollment or a live handshake.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values
 ('pilot.custody.reconcile','Review second independent-source custody *claims* without certifying the issuer','high'),
 ('pilot.test.authorize','Record or withdraw owner intent for isolated nonproduction TEST only','critical')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join icamp_private.permission_catalog p on
 p.permission_key='pilot.custody.reconcile'
 or (p.permission_key='pilot.test.authorize' and r.role_code='owner_admin')
where r.role_kind='template' and r.organization_id is null
  and r.role_code in ('owner_admin','it_admin')
on conflict(role_id,permission_key) do nothing;

-- Multi-column FKs prevent attaching an evidence record to a different tenant.
create unique index pilot202_evidence_tenant_fk_203 on
 icamp_private.pilot202_evidence_intake(id,organization_id,campground_id);

create table icamp_private.pilot203_custody_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 evidence_id uuid not null,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 issuer_receipt_ref text not null check(issuer_receipt_ref ~ '^(issue|ticket|review|owner|test|evidence|receipt)-[A-Za-z0-9][A-Za-z0-9._-]{4,79}$'),
 issuer_claimed_sha256 text not null check(issuer_claimed_sha256 ~ '^[a-f0-9]{64}$'),
 disposition text not null default 'TWO_SOURCE_CLAIMS_UNVERIFIED' check(disposition='TWO_SOURCE_CLAIMS_UNVERIFIED'),
 independently_verified boolean not null default false check(independently_verified=false),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(evidence_id,organization_id,campground_id)
   references icamp_private.pilot202_evidence_intake(id,organization_id,campground_id) on delete restrict,
 unique(campground_id,evidence_id,issuer_receipt_ref),
 unique(id,organization_id,campground_id)
);
create index pilot203_custody_campground_idx on
 icamp_private.pilot203_custody_reviews(campground_id,created_at desc,id desc);
create index pilot203_custody_actor_idx on
 icamp_private.pilot203_custody_reviews(actor_user_id);

create table icamp_private.pilot203_owner_test_actions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 custody_review_id uuid not null,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 request_id uuid not null,
 decision text not null check(decision in ('REQUEST_ISOLATED_TEST','WITHDRAW_ISOLATED_TEST')),
 expires_at timestamptz,
 scope_acknowledged boolean not null,
 purpose text not null default 'ISOLATED_NONPRODUCTION_HANDSHAKE_ONLY'
   check(purpose='ISOLATED_NONPRODUCTION_HANDSHAKE_ONLY'),
 disposition text not null default 'LOCAL_OWNER_INTENT_ONLY'
   check(disposition='LOCAL_OWNER_INTENT_ONLY'),
 independent_authority boolean not null default false check(independent_authority=false),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(custody_review_id,organization_id,campground_id)
   references icamp_private.pilot203_custody_reviews(id,organization_id,campground_id) on delete restrict,
 check ((decision='REQUEST_ISOLATED_TEST' and scope_acknowledged=true and
        expires_at is not null and expires_at>created_at+interval '5 minutes' and
        expires_at<=created_at+interval '24 hours')
     or (decision='WITHDRAW_ISOLATED_TEST' and scope_acknowledged=false and expires_at is null)),
 unique(campground_id,request_id)
);
create index pilot203_owner_campground_idx on
 icamp_private.pilot203_owner_test_actions(campground_id,created_at desc,id desc);
create index pilot203_owner_review_fk_idx on
 icamp_private.pilot203_owner_test_actions(custody_review_id);
create index pilot203_owner_actor_fk_idx on
 icamp_private.pilot203_owner_test_actions(actor_user_id);

create function icamp_private.pilot203_deny_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Build 203 review and owner intent are append-only'; end $$;
revoke all on function icamp_private.pilot203_deny_mutation() from public;
grant execute on function icamp_private.pilot203_deny_mutation() to icamp_app;
create trigger pilot203_review_immutable before update or delete on
 icamp_private.pilot203_custody_reviews for each row
 execute function icamp_private.pilot203_deny_mutation();
create trigger pilot203_owner_immutable before update or delete on
 icamp_private.pilot203_owner_test_actions for each row
 execute function icamp_private.pilot203_deny_mutation();

alter table icamp_private.pilot203_custody_reviews enable row level security;
alter table icamp_private.pilot203_custody_reviews force row level security;
alter table icamp_private.pilot203_owner_test_actions enable row level security;
alter table icamp_private.pilot203_owner_test_actions force row level security;
revoke all on icamp_private.pilot203_custody_reviews from public;
revoke all on icamp_private.pilot203_owner_test_actions from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on icamp_private.pilot203_custody_reviews from %I',role_name);
   execute format('revoke all on icamp_private.pilot203_owner_test_actions from %I',role_name);
  end if;
 end loop;
end $$;
grant select,insert on icamp_private.pilot203_custody_reviews to icamp_app;
grant select,insert on icamp_private.pilot203_owner_test_actions to icamp_app;
create policy pilot203_custody_read on icamp_private.pilot203_custody_reviews
 for select to icamp_app using (icamp_private.has_campground_permission(campground_id,'pilot.custody.reconcile'));
create policy pilot203_custody_insert on icamp_private.pilot203_custody_reviews
 for insert to icamp_app with check (
   actor_user_id=(select icamp_private.request_user_id())
   and icamp_private.has_campground_permission(campground_id,'pilot.custody.reconcile')
   and exists (select 1 from icamp_private.pilot202_evidence_intake e
     where e.id=evidence_id and e.campground_id=pilot203_custody_reviews.campground_id
       and e.organization_id=pilot203_custody_reviews.organization_id
       and e.actor_user_id<>(select icamp_private.request_user_id()))
   and disposition='TWO_SOURCE_CLAIMS_UNVERIFIED' and independently_verified=false);
create policy pilot203_owner_read on icamp_private.pilot203_owner_test_actions
 for select to icamp_app using (
   icamp_private.has_campground_permission(campground_id,'pilot.custody.reconcile')
   or icamp_private.has_campground_permission(campground_id,'pilot.test.authorize'));
create policy pilot203_owner_insert on icamp_private.pilot203_owner_test_actions
 for insert to icamp_app with check (
   actor_user_id=(select icamp_private.request_user_id())
   and icamp_private.has_campground_permission(campground_id,'pilot.test.authorize')
   and disposition='LOCAL_OWNER_INTENT_ONLY' and independent_authority=false);

comment on table icamp_private.pilot203_custody_reviews is
 'Append-only second-source digest claims, not authenticated independent verification.';
comment on table icamp_private.pilot203_owner_test_actions is
 'Append-only local owner isolated TEST intent/withdrawal, not master-owner or external authorization.';
