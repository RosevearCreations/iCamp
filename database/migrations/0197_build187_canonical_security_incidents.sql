-- Build 187: canonical security incidents are not device/access event signals.
-- Private, forced-RLS records; staff UI writes use independently authorized server transactions.
insert into icamp_private.permission_catalog(permission_key,description,risk_level)
values
 ('security.incident.review','Independently review security incident closure','elevated'),
 ('security.incident.sensitive.read','Read restricted security witness, guest and attachment evidence','elevated')
on conflict(permission_key) do nothing;

insert into icamp_private.role_permissions(role_id,permission_key)
select r.id,p.permission_key from icamp_private.roles r
join (values
 ('campground_manager','security.incident.review'),
 ('campground_manager','security.incident.sensitive.read'),
 ('owner_admin','security.incident.review'),
 ('owner_admin','security.incident.sensitive.read'),
 ('security','security.incident.sensitive.read'),
 ('security','media.confidential.read')
) p(role_code,permission_key) on p.role_code=r.role_code
where r.role_kind='template'
on conflict do nothing;

create table icamp_private.security_incident_cases (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 title text not null check(char_length(trim(title)) between 8 and 160),
 category text not null check(category in ('access','threat','injury','property','safety','other')),
 severity text not null check(severity in ('low','moderate','high','critical')),
 operational_summary text not null check(char_length(trim(operational_summary)) between 20 and 1500),
 status text not null default 'open' check(status in ('open','investigating','escalated','closure_pending','closed')),
 linked_signal_kind text check(linked_signal_kind in ('access_denied','device_fault','override_failed')),
 linked_signal_id uuid,
 opened_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 assignee_user_id uuid references icamp_private.user_accounts(id) on delete restrict,
 closure_requested_by_user_id uuid references icamp_private.user_accounts(id) on delete restrict,
 closure_round integer not null default 0 check(closure_round>=0),
 closed_by_user_id uuid references icamp_private.user_accounts(id) on delete restrict,
 closed_at timestamptz,
 opened_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 row_version bigint not null default 1 check(row_version>=1),
 constraint security_incident_cases_campground_fk foreign key(organization_id,campground_id)
  references public.campgrounds(organization_id,id) on delete restrict,
 constraint security_incident_cases_scope_unique unique(organization_id,campground_id,id),
 constraint security_incident_signal_pair check((linked_signal_kind is null)=(linked_signal_id is null)),
 constraint security_incident_closed_shape check(
  (status='closed' and closed_by_user_id is not null and closed_at is not null)
  or (status<>'closed' and closed_by_user_id is null and closed_at is null))
);

create table icamp_private.security_incident_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null,
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 event_kind text not null check(event_kind in ('intake','assigned','investigated','escalated','evidence_attached','sensitive_updated','closure_requested','closure_returned','closure_approved','reopened')),
 summary text not null check(char_length(trim(summary)) between 8 and 2000),
 occurred_at timestamptz not null default statement_timestamp(),
 constraint security_incident_events_case_fk foreign key(organization_id,campground_id,case_id)
  references icamp_private.security_incident_cases(organization_id,campground_id,id) on delete restrict
);

create table icamp_private.security_incident_sensitive (
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid primary key,
 witness_context text not null default '' check(char_length(witness_context)<=3000),
 guest_context text not null default '' check(char_length(guest_context)<=3000),
 updated_by_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 updated_at timestamptz not null default statement_timestamp(),
 constraint security_incident_sensitive_case_fk foreign key(organization_id,campground_id,case_id)
  references icamp_private.security_incident_cases(organization_id,campground_id,id) on delete restrict
);

create table icamp_private.security_incident_attachments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null,
 media_asset_id uuid not null unique references icamp_private.media_assets(id) on delete restrict,
 checksum_sha256 text not null check(checksum_sha256 ~ '^[0-9a-f]{64}$'),
 caption text not null check(char_length(trim(caption)) between 8 and 500),
 actor_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 attached_at timestamptz not null default statement_timestamp(),
 constraint security_incident_attachment_case_fk foreign key(organization_id,campground_id,case_id)
  references icamp_private.security_incident_cases(organization_id,campground_id,id) on delete restrict
);

create table icamp_private.security_incident_closure_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 campground_id uuid not null,
 case_id uuid not null,
 closure_round integer not null check(closure_round>0),
 reviewer_user_id uuid not null references icamp_private.user_accounts(id) on delete restrict,
 decision text not null check(decision in ('approved','returned')),
 rationale text not null check(char_length(trim(rationale)) between 20 and 1500),
 reviewed_at timestamptz not null default statement_timestamp(),
 constraint security_incident_review_case_fk foreign key(organization_id,campground_id,case_id)
  references icamp_private.security_incident_cases(organization_id,campground_id,id) on delete restrict,
 constraint security_incident_review_once_per_round unique(case_id,closure_round)
);

create index security_incident_cases_queue_idx on icamp_private.security_incident_cases(campground_id,status,severity,updated_at desc);
create index security_incident_cases_reporter_idx on icamp_private.security_incident_cases(opened_by_user_id);
create index security_incident_cases_assignee_idx on icamp_private.security_incident_cases(assignee_user_id) where assignee_user_id is not null;
create index security_incident_cases_requester_idx on icamp_private.security_incident_cases(closure_requested_by_user_id) where closure_requested_by_user_id is not null;
create index security_incident_cases_reviewer_idx on icamp_private.security_incident_cases(closed_by_user_id) where closed_by_user_id is not null;
create index security_incident_cases_signal_idx on icamp_private.security_incident_cases(campground_id,linked_signal_kind,linked_signal_id) where linked_signal_id is not null;
create index security_incident_events_timeline_idx on icamp_private.security_incident_events(organization_id,campground_id,case_id,occurred_at,id);
create index security_incident_events_actor_idx on icamp_private.security_incident_events(actor_user_id);
create index security_incident_sensitive_updater_idx on icamp_private.security_incident_sensitive(updated_by_user_id);
create index security_incident_attachment_case_idx on icamp_private.security_incident_attachments(organization_id,campground_id,case_id,attached_at);
create index security_incident_attachment_actor_idx on icamp_private.security_incident_attachments(actor_user_id);
create index security_incident_review_case_idx on icamp_private.security_incident_closure_reviews(organization_id,campground_id,case_id,reviewed_at);
create index security_incident_review_actor_idx on icamp_private.security_incident_closure_reviews(reviewer_user_id);

create function icamp_private.guard_security_incident_case()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.status<>'open' or new.closure_round<>0 then
   raise exception 'Security incident intake must begin open';
  end if;
  if new.linked_signal_kind='access_denied' and not exists(
    select 1 from public.access_events e where e.id=new.linked_signal_id
      and e.organization_id=new.organization_id and e.campground_id=new.campground_id and e.outcome='denied') then
   raise exception 'Linked denied access signal is not in this campground';
  elsif new.linked_signal_kind='device_fault' and not exists(
    select 1 from public.access_device_events e where e.id=new.linked_signal_id
      and e.organization_id=new.organization_id and e.campground_id=new.campground_id and e.event_kind='fault') then
   raise exception 'Linked device fault is not in this campground';
  elsif new.linked_signal_kind='override_failed' and not exists(
    select 1 from public.gate_override_outcomes o where o.id=new.linked_signal_id
      and o.organization_id=new.organization_id and o.campground_id=new.campground_id
      and o.outcome in ('failed','rejected','timeout','unsupported')) then
   raise exception 'Linked override failure is not in this campground';
  end if;
 else
  if row(new.id,new.organization_id,new.campground_id,new.opened_by_user_id,new.opened_at,new.linked_signal_kind,new.linked_signal_id,
      new.title,new.category,new.severity,new.operational_summary)
   is distinct from row(old.id,old.organization_id,old.campground_id,old.opened_by_user_id,old.opened_at,old.linked_signal_kind,old.linked_signal_id,
      old.title,old.category,old.severity,old.operational_summary) then
   raise exception 'Security incident identity and signal reference are immutable';
  end if;
  if new.closure_round<>old.closure_round and not (
    new.status='closure_pending' and old.status<>'closure_pending'
    and new.closure_round=old.closure_round+1) then
   raise exception 'Independent closure round cannot be rewritten';
  end if;
  if old.status='closed' and new.status not in ('closed','investigating') then
   raise exception 'Closed incidents require explicit reopening';
  end if;
  if new.status='closure_pending' and old.status<>'closure_pending'
    and (old.status not in ('investigating','escalated') or new.closure_round<>old.closure_round+1
      or new.closure_requested_by_user_id is null
      or not exists(select 1 from icamp_private.security_incident_attachments a
        join icamp_private.media_assets m on m.id=a.media_asset_id
        where a.case_id=new.id and m.lifecycle_state='active' and m.validation_state='validated')) then
   raise exception 'Closure request needs investigation and retained validated evidence';
  end if;
  if new.status='closed' and old.status<>'closed' then
   if old.status<>'closure_pending' or new.closed_by_user_id is null
     or new.closed_by_user_id in (new.opened_by_user_id,new.closure_requested_by_user_id)
     or new.closed_by_user_id is not distinct from new.assignee_user_id
     or not exists(select 1 from icamp_private.security_incident_closure_reviews r
       where r.case_id=new.id and r.closure_round=new.closure_round
         and r.decision='approved' and r.reviewer_user_id=new.closed_by_user_id)
     or exists(select 1 from icamp_private.security_incident_events e
       where e.case_id=new.id and e.actor_user_id=new.closed_by_user_id
         and e.event_kind in ('intake','assigned','investigated','escalated','evidence_attached','closure_requested')) then
    raise exception 'Security incident closure requires an independent approved review';
   end if;
  end if;
  if new.status='closed' and (new.closed_by_user_id is distinct from old.closed_by_user_id
    or new.closed_at is distinct from old.closed_at) and old.status='closed' then
   raise exception 'Closed incident review receipt cannot be replaced';
  end if;
  if old.status='closed' and new.status='closed' and
    row(new.assignee_user_id,new.closure_requested_by_user_id)
    is distinct from row(old.assignee_user_id,old.closure_requested_by_user_id) then
   raise exception 'Closed incident assignment and closure request are retained';
  end if;
 end if;
 return new;
end $$;

create trigger security_incident_case_guard before insert or update on icamp_private.security_incident_cases
 for each row execute function icamp_private.guard_security_incident_case();
create trigger security_incident_case_touch before update on icamp_private.security_incident_cases
 for each row execute function icamp_private.touch_row();

create function icamp_private.guard_security_incident_attachment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from icamp_private.media_assets m
   where m.id=new.media_asset_id and m.organization_id=new.organization_id
    and m.campground_id=new.campground_id and m.classification='confidential'
    and m.lifecycle_state='active' and m.validation_state='validated'
    and m.checksum_sha256=new.checksum_sha256) then
  raise exception 'Incident evidence must be validated, confidential, immutable and same-campground';
 end if;
 return new;
end $$;
create trigger security_incident_attachment_guard before insert on icamp_private.security_incident_attachments
 for each row execute function icamp_private.guard_security_incident_attachment();

create function icamp_private.guard_security_incident_review()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c record;
begin
 select * into c from icamp_private.security_incident_cases where id=new.case_id for update;
 if not found or c.organization_id<>new.organization_id or c.campground_id<>new.campground_id
   or c.status<>'closure_pending' or c.closure_round<>new.closure_round
   or new.reviewer_user_id in (c.opened_by_user_id,c.closure_requested_by_user_id)
   or new.reviewer_user_id is not distinct from c.assignee_user_id
   or exists(select 1 from icamp_private.security_incident_events e
     where e.case_id=c.id and e.actor_user_id=new.reviewer_user_id
      and e.event_kind in ('intake','assigned','investigated','escalated','evidence_attached','closure_requested')) then
  raise exception 'Independent closure review is not eligible for this incident';
 end if;
 if new.decision='approved' and not exists(select 1 from icamp_private.security_incident_attachments a
    join icamp_private.media_assets m on m.id=a.media_asset_id
    where a.case_id=c.id and m.lifecycle_state='active' and m.validation_state='validated'
      and m.checksum_sha256=a.checksum_sha256) then
  raise exception 'Independent closure cannot approve missing retained evidence';
 end if;
 return new;
end $$;
create trigger security_incident_review_guard before insert on icamp_private.security_incident_closure_reviews
 for each row execute function icamp_private.guard_security_incident_review();

create function icamp_private.security_incident_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Security incident evidence and independent review history are append-only';
end $$;
create trigger security_incident_events_immutable before update or delete on icamp_private.security_incident_events
 for each row execute function icamp_private.security_incident_immutable();
create trigger security_incident_attachments_immutable before update or delete on icamp_private.security_incident_attachments
 for each row execute function icamp_private.security_incident_immutable();
create trigger security_incident_reviews_immutable before update or delete on icamp_private.security_incident_closure_reviews
 for each row execute function icamp_private.security_incident_immutable();
create trigger security_incident_sensitive_retain before delete on icamp_private.security_incident_sensitive
 for each row execute function icamp_private.security_incident_immutable();
create trigger security_incident_cases_retain before delete on icamp_private.security_incident_cases
 for each row execute function icamp_private.security_incident_immutable();

-- A linked confidential object may not be silently deleted, archived, replaced
-- or declassified after the incident references its checksum.
create function icamp_private.guard_retained_security_incident_media()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from icamp_private.security_incident_attachments a
   where a.media_asset_id=old.id) then
  raise exception 'Retained security incident evidence cannot be modified or removed';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger security_incident_media_retain before update or delete on icamp_private.media_assets
 for each row execute function icamp_private.guard_retained_security_incident_media();

-- Private schema is not a Data API; explicit RLS prevents even icamp_app bypasses.
alter table icamp_private.security_incident_cases enable row level security;
alter table icamp_private.security_incident_cases force row level security;
alter table icamp_private.security_incident_events enable row level security;
alter table icamp_private.security_incident_events force row level security;
alter table icamp_private.security_incident_sensitive enable row level security;
alter table icamp_private.security_incident_sensitive force row level security;
alter table icamp_private.security_incident_attachments enable row level security;
alter table icamp_private.security_incident_attachments force row level security;
alter table icamp_private.security_incident_closure_reviews enable row level security;
alter table icamp_private.security_incident_closure_reviews force row level security;

create policy security_incident_cases_read on icamp_private.security_incident_cases
 for select to icamp_app using (
  icamp_private.has_campground_permission(campground_id,'security.incident.manage')
  or icamp_private.has_campground_permission(campground_id,'security.incident.review'));
create policy security_incident_events_read on icamp_private.security_incident_events
 for select to icamp_app using(icamp_private.has_campground_permission(campground_id,'security.incident.manage')
  or icamp_private.has_campground_permission(campground_id,'security.incident.review'));
create policy security_incident_sensitive_read on icamp_private.security_incident_sensitive
 for select to icamp_app using(icamp_private.has_campground_permission(campground_id,'security.incident.sensitive.read'));
create policy security_incident_attachments_read on icamp_private.security_incident_attachments
 for select to icamp_app using(icamp_private.has_campground_permission(campground_id,'security.incident.sensitive.read'));
create policy security_incident_reviews_read on icamp_private.security_incident_closure_reviews
 for select to icamp_app using(icamp_private.has_campground_permission(campground_id,'security.incident.manage')
  or icamp_private.has_campground_permission(campground_id,'security.incident.review'));

grant select on icamp_private.security_incident_cases,icamp_private.security_incident_events,
 icamp_private.security_incident_sensitive,icamp_private.security_incident_attachments,
 icamp_private.security_incident_closure_reviews to icamp_app;
revoke all on icamp_private.security_incident_cases,icamp_private.security_incident_events,
 icamp_private.security_incident_sensitive,icamp_private.security_incident_attachments,
 icamp_private.security_incident_closure_reviews from public;
do $security_incident_untrusted$
begin
 if exists(select 1 from pg_roles where rolname='anon') then
  execute 'revoke all on icamp_private.security_incident_cases,icamp_private.security_incident_events,icamp_private.security_incident_sensitive,icamp_private.security_incident_attachments,icamp_private.security_incident_closure_reviews from anon';
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
  execute 'revoke all on icamp_private.security_incident_cases,icamp_private.security_incident_events,icamp_private.security_incident_sensitive,icamp_private.security_incident_attachments,icamp_private.security_incident_closure_reviews from authenticated';
 end if;
end $security_incident_untrusted$;

revoke all on function icamp_private.guard_security_incident_case() from public;
revoke all on function icamp_private.guard_security_incident_review() from public;
revoke all on function icamp_private.guard_security_incident_attachment() from public;
revoke all on function icamp_private.security_incident_immutable() from public;
revoke all on function icamp_private.guard_retained_security_incident_media() from public;
comment on table icamp_private.security_incident_cases is
 'Build 187 canonical staff-only incident cases, independent of access/device alert disappearance. Retain incident and closure history; do not cascade delete.';
