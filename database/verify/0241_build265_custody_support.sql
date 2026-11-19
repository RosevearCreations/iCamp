do $v$
declare tab text; trig text;
begin
 for tab,trig in select * from (values
 ('rental_safety_ack265','rental_safety265_guard'),
 ('rental_custody_events265','rental_custody265_guard'),
 ('rental_supervision_witness265','rental_supervision265_guard'),
 ('campground_support265','campground_support265_guard')
 ) t(n,g)
 loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname=tab
    and c.relrowsecurity and c.relforcerowsecurity)
   then raise exception 'Build265 RLS missing: %',tab; end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
   where c.relname=tab and t.tgname=trig and not t.tgisinternal)
   then raise exception 'Build265 guard missing: %',trig; end if;
  if has_table_privilege('icamp_app',format('icamp_private.%I',tab),'SELECT')
    or has_table_privilege('icamp_app',format('icamp_private.%I',tab),'INSERT')
    or has_table_privilege('icamp_app',format('icamp_private.%I',tab),'UPDATE')
    or has_table_privilege('icamp_app',format('icamp_private.%I',tab),'DELETE')
   then raise exception 'Build265 client direct grants present: %',tab; end if;
 end loop;
end $v$;