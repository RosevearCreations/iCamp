-- iCamp 231: private append-only escalation and guest-review follow-through.
-- Targets are informational; events do not change public directory,
-- maintenance completion, guest contact, access gates, or emergency dispatch.
alter table public.amenity_shift_handoffs
  add constraint amenity_shift_handoffs_scoped_event_parent_unique
  unique (organization_id,campground_id,id);

create table public.amenity_handoff_followup_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  handoff_id uuid not null,
  event_kind text not null check (event_kind in ('escalation','guest_followup')),
  review_outcome text check (review_outcome in
    ('needs_publication_review','verified_no_change','needs_more_evidence')),
  note text not null check (char_length(trim(note)) between 8 and 500),
  actor_user_id uuid not null references icamp_private.user_accounts(id)
    on update cascade on delete restrict,
  handoff_row_version bigint not null check (handoff_row_version >= 1),
  created_at timestamptz not null default statement_timestamp(),
  constraint amenity_followup_kind_outcome_check check (
    (event_kind='escalation' and review_outcome is null)
    or (event_kind='guest_followup' and review_outcome is not null)
  ),
  constraint amenity_followup_handoff_scope_fk
    foreign key (organization_id,campground_id,handoff_id)
    references public.amenity_shift_handoffs(organization_id,campground_id,id)
    on update restrict on delete restrict
);

create index amenity_handoff_followups_queue_idx
  on public.amenity_handoff_followup_events
    (campground_id,handoff_id,created_at desc);
create index amenity_handoff_followups_actor_fk_idx
  on public.amenity_handoff_followup_events(actor_user_id);

alter table public.amenity_handoff_followup_events enable row level security;
alter table public.amenity_handoff_followup_events force row level security;
revoke all on public.amenity_handoff_followup_events from public;
grant select,insert on public.amenity_handoff_followup_events to icamp_app;

create policy amenity_followups_staff_read
  on public.amenity_handoff_followup_events for select to icamp_app
  using (
    icamp_private.has_campground_permission(campground_id,'asset.read')
    or icamp_private.has_campground_permission(campground_id,'asset.manage')
    or icamp_private.has_campground_permission(campground_id,'maintenance.read')
    or icamp_private.has_campground_permission(campground_id,'maintenance.create')
    or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
    or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
  );

create policy amenity_followups_authorized_insert
  on public.amenity_handoff_followup_events for insert to icamp_app
  with check (
    actor_user_id = nullif((select current_setting('icamp.user_id',true)),'')::uuid
    and exists (
      select 1 from public.amenity_shift_handoffs h
      where h.id=amenity_handoff_followup_events.handoff_id
        and h.campground_id=amenity_handoff_followup_events.campground_id
        and h.organization_id=amenity_handoff_followup_events.organization_id
        and h.status <> 'closed'
        and h.row_version=amenity_handoff_followup_events.handoff_row_version
        and (
          (event_kind='escalation' and (
            icamp_private.has_campground_permission(campground_id,'asset.manage')
            or icamp_private.has_campground_permission(campground_id,'maintenance.assign')
            or icamp_private.has_campground_permission(campground_id,'maintenance.complete')
          ))
          or (event_kind='guest_followup' and h.kind='guest_review'
            and icamp_private.has_campground_permission(campground_id,'campground.configuration')
            and icamp_private.has_campground_permission(campground_id,'campground.map.publish'))
        )
    )
  );

comment on table public.amenity_handoff_followup_events is
  'Append-only private staff escalation and owner guest-information follow-up evidence. No automatic publication or notifications.';
