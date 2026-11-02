do $verify_build187$
declare
 incident_table text;
begin
 foreach incident_table in array array[
  'security_incident_cases','security_incident_events','security_incident_sensitive',
  'security_incident_attachments','security_incident_closure_reviews'
 ] loop
  if not exists(select 1 from pg_class where oid=('icamp_private.'||incident_table)::regclass
    and relrowsecurity and relforcerowsecurity) then
   raise exception 'Build187 private incident table % requires forced RLS',incident_table;
  end if;
  if exists(select 1 from pg_roles where rolname='anon') and
     has_table_privilege('anon','icamp_private.'||incident_table,'SELECT') then
   raise exception 'Build187 anonymous read of restricted incident %',incident_table;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') and
     has_table_privilege('authenticated','icamp_private.'||incident_table,'INSERT') then
   raise exception 'Build187 client write of restricted incident %',incident_table;
  end if;
  if has_table_privilege('icamp_app','icamp_private.'||incident_table,'INSERT') or
     has_table_privilege('icamp_app','icamp_private.'||incident_table,'UPDATE') or
     has_table_privilege('icamp_app','icamp_private.'||incident_table,'DELETE') then
   raise exception 'Build187 incident mutation bypass through icamp_app: %',incident_table;
  end if;
 end loop;
 if not exists(select 1 from pg_policies where schemaname='icamp_private'
    and tablename='security_incident_sensitive' and cmd='SELECT'
    and qual like '%security.incident.sensitive.read%') then
   raise exception 'Build187 sensitive witness/guest RLS permission missing';
 end if;
 if not exists(select 1 from pg_trigger where tgname='security_incident_case_guard'
    and tgrelid='icamp_private.security_incident_cases'::regclass and not tgisinternal) then
   raise exception 'Build187 canonical independent closure gate absent';
 end if;
 if not exists(select 1 from pg_trigger where tgname='security_incident_review_guard'
    and tgrelid='icamp_private.security_incident_closure_reviews'::regclass and not tgisinternal) then
   raise exception 'Build187 independent review guard absent';
 end if;
 if not exists(select 1 from pg_trigger where tgname='security_incident_media_retain'
    and tgrelid='icamp_private.media_assets'::regclass and not tgisinternal) then
   raise exception 'Build187 protected evidence retention gate absent';
 end if;
 if not exists(select 1 from pg_trigger where tgname='security_incident_events_immutable'
    and tgrelid='icamp_private.security_incident_events'::regclass and not tgisinternal) then
   raise exception 'Build187 investigation chronology not append-only';
 end if;
 if not exists(select 1 from pg_trigger where tgname='security_incident_reviews_immutable'
    and tgrelid='icamp_private.security_incident_closure_reviews'::regclass and not tgisinternal) then
   raise exception 'Build187 independent review receipts not append-only';
 end if;
 if not exists(select 1 from pg_trigger where tgname='security_incident_sensitive_retain'
    and tgrelid='icamp_private.security_incident_sensitive'::regclass and not tgisinternal) then
   raise exception 'Build187 confidential witness/guest context retention gate absent';
 end if;
end $verify_build187$;
