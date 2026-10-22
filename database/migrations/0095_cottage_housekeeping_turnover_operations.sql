-- iCamp Build 074
-- Cottage Housekeeping & Turnover operational completion.
-- Advances historical Build 075 while preserving Build 027 as the canonical
-- housekeeping/linen/inventory turnover model.

alter table public.cottage_housekeeping_templates
  add column final_inspection_template_id uuid;

alter table public.cottage_housekeeping_templates
  add constraint cottage_housekeeping_templates_final_inspection_fk
  foreign key (organization_id,campground_id,final_inspection_template_id)
  references public.inspection_templates(organization_id,campground_id,id)
  on update cascade
  on delete restrict;

alter table public.cottage_turnovers
  add column release_required boolean not null default true,
  add column released_at timestamptz,
  add column released_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null;

alter table public.cottage_turnovers
  add constraint cottage_turnovers_release_shape_check
  check (
    (released_at is null and released_by_user_id is null)
    or
    (released_at is not null and released_by_user_id is not null and status='ready')
  );

-- Turnovers already completed before Build 074 are legacy-complete. New and
-- still-open turnovers require the new final inspection/release path.
update public.cottage_turnovers
set release_required=false
where status in ('ready','cancelled');

create table public.cottage_turnover_inspection_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  turnover_id uuid not null,
  inspection_occurrence_id uuid not null,
  started_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint cottage_turnover_inspection_evidence_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint cottage_turnover_inspection_evidence_occurrence_unique
    unique (inspection_occurrence_id),
  constraint cottage_turnover_inspection_evidence_turnover_fk
    foreign key (organization_id,campground_id,turnover_id)
    references public.cottage_turnovers(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint cottage_turnover_inspection_evidence_occurrence_fk
    foreign key (organization_id,campground_id,inspection_occurrence_id)
    references public.inspection_occurrences(organization_id,campground_id,id)
    on update cascade
    on delete restrict
);

create index cottage_housekeeping_templates_final_inspection_scope_idx
  on public.cottage_housekeeping_templates(
    organization_id,campground_id,final_inspection_template_id
  )
  where final_inspection_template_id is not null;

create index cottage_turnovers_released_by_idx
  on public.cottage_turnovers(released_by_user_id)
  where released_by_user_id is not null;

create index cottage_turnovers_unreleased_cottage_idx
  on public.cottage_turnovers(
    organization_id,campground_id,accommodation_id,created_at desc
  )
  where released_at is null and status <> 'cancelled';

create index cottage_turnover_inspection_evidence_turnover_scope_idx
  on public.cottage_turnover_inspection_evidence(
    organization_id,campground_id,turnover_id,created_at desc
  );

create index cottage_turnover_inspection_evidence_occurrence_scope_idx
  on public.cottage_turnover_inspection_evidence(
    organization_id,campground_id,inspection_occurrence_id
  );

create index cottage_turnover_inspection_evidence_started_by_idx
  on public.cottage_turnover_inspection_evidence(started_by_user_id);

create or replace function icamp_private.validate_cottage_final_inspection_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inspection_target_kind text;
  inspection_accommodation_id uuid;
begin
  if new.final_inspection_template_id is null then
    return new;
  end if;

  select target_kind,accommodation_id
    into inspection_target_kind,inspection_accommodation_id
  from public.inspection_templates
  where id=new.final_inspection_template_id
    and organization_id=new.organization_id
    and campground_id=new.campground_id;

  if not found
     or inspection_target_kind <> 'cottage'
     or inspection_accommodation_id is distinct from new.accommodation_id then
    raise exception 'Cottage turnover final inspection must target the same cottage';
  end if;

  return new;
end;
$$;

create trigger cottage_housekeeping_templates_validate_final_inspection
before insert or update of
  final_inspection_template_id,organization_id,campground_id,accommodation_id
on public.cottage_housekeeping_templates
for each row execute function icamp_private.validate_cottage_final_inspection_template();

create or replace function icamp_private.guard_cottage_turnover_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status_state='inspection'
     and new.status_state='available'
     and exists (
       select 1
       from public.cottage_turnovers t
       where t.organization_id=new.organization_id
         and t.campground_id=new.campground_id
         and t.accommodation_id=new.id
         and t.release_required
         and t.status <> 'cancelled'
         and t.released_at is null
     ) then
    raise exception 'Rental cottage remains blocked until housekeeping turnover is released';
  end if;

  return new;
end;
$$;

create trigger accommodations_guard_cottage_turnover_release
before update of status_state on public.accommodations
for each row execute function icamp_private.guard_cottage_turnover_release();

revoke all on function icamp_private.validate_cottage_final_inspection_template() from public;
revoke all on function icamp_private.guard_cottage_turnover_release() from public;

alter table public.cottage_turnover_inspection_evidence enable row level security;
alter table public.cottage_turnover_inspection_evidence force row level security;

revoke all on public.cottage_turnover_inspection_evidence from public;

do $build074_direct_roles$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.cottage_turnover_inspection_evidence from anon';
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.cottage_turnover_inspection_evidence from authenticated';
  end if;
end
$build074_direct_roles$;

grant select,insert on public.cottage_turnover_inspection_evidence to icamp_app;

create policy cottage_turnover_inspection_evidence_read
on public.cottage_turnover_inspection_evidence
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'accommodation.read')
  or icamp_private.has_campground_permission(campground_id,'accommodation.manage')
  or icamp_private.has_campground_permission(campground_id,'maintenance.read')
  or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  or icamp_private.has_campground_permission(campground_id,'inspection.perform')
  or icamp_private.has_campground_permission(campground_id,'inspection.signoff')
);

create policy cottage_turnover_inspection_evidence_insert
on public.cottage_turnover_inspection_evidence
for insert to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'inspection.perform')
  and started_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

comment on column public.cottage_housekeeping_templates.final_inspection_template_id is
  'Build 074 link from the canonical Build 027 turnover template to the canonical Build 068 cottage inspection template used for final release.';

comment on column public.cottage_turnovers.release_required is
  'Build 074 compatibility boundary: false only for legacy turnovers already ready/cancelled when the migration was applied; new turnover rows require final release.';

comment on column public.cottage_turnovers.released_at is
  'Build 074 authoritative timestamp proving final signed inspection and corrective-work reconciliation before canonical availability release.';

comment on table public.cottage_turnover_inspection_evidence is
  'Append-only Build 074 lineage between Build 027 cottage turnovers and Build 068 inspection occurrences; failed or rejected inspections remain historically visible.';
