do $verify202$ begin
 if not exists(select 1 from pg_tables where schemaname='icamp_private'
   and tablename='pilot202_evidence_intake' and rowsecurity)
 then raise exception 'Build 202 pilot evidence RLS missing'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='icamp_private' and c.relname='pilot202_evidence_intake' and c.relforcerowsecurity)
 then raise exception 'Build 202 must force RLS'; end if;
 if (exists(select 1 from pg_roles where rolname='anon')
       and has_table_privilege('anon', to_regclass(format('%I.%I', 'icamp_private', 'pilot202_evidence_intake')), 'INSERT'))
   or (exists(select 1 from pg_roles where rolname='authenticated')
       and has_table_privilege('authenticated', to_regclass(format('%I.%I', 'icamp_private', 'pilot202_evidence_intake')), 'INSERT'))
 then raise exception 'Build 202 evidence intake exposed to Data API'; end if;
 if not has_table_privilege('icamp_app', to_regclass(format('%I.%I', 'icamp_private', 'pilot202_evidence_intake')), 'INSERT')
 then raise exception 'Build 202 app role cannot write intake'; end if;
 if (select count(*) from pg_policies where schemaname='icamp_private'
   and tablename='pilot202_evidence_intake')<>2
 then raise exception 'Build 202 permission policies must be explicit and narrow'; end if;
 if not exists(select 1 from pg_trigger where tgname='pilot202_evidence_immutable' and not tgisinternal)
 then raise exception 'Build 202 append-only guard missing'; end if;
end $verify202$;
