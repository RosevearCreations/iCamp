do $verify$ begin
 if exists (
  select 1 from pg_policies
  where schemaname='public' and tablename='garbage_paid_tags'
    and policyname in ('garbage_tag_issue','garbage_tag_redeem')
    and with_check like '%nullif(current_setting%'
 ) then raise exception 'Tag RLS must hoist current_setting into initplan'; end if;
end $verify$;
