do $verify203$ begin
 if not exists(select 1 from pg_class where oid='icamp_private.pilot203_custody_reviews'::regclass and relrowsecurity and relforcerowsecurity)
 then raise exception 'Build 203 custody RLS missing'; end if;
 if not exists(select 1 from pg_class where oid='icamp_private.pilot203_owner_test_actions'::regclass and relrowsecurity and relforcerowsecurity)
 then raise exception 'Build 203 owner RLS missing'; end if;
 if (select count(*) from pg_policies where schemaname='icamp_private' and tablename in ('pilot203_custody_reviews','pilot203_owner_test_actions'))<>4
 then raise exception 'Build 203 needs explicit tenant policies'; end if;
 if (select count(*) from pg_trigger where tgname in ('pilot203_review_immutable','pilot203_owner_immutable') and not tgisinternal)<>2
 then raise exception 'Build 203 append-only triggers missing'; end if;
 if (select count(*) from icamp_private.permission_catalog where permission_key in ('pilot.custody.reconcile','pilot.test.authorize'))<>2
 then raise exception 'Build 203 dedicated permissions missing'; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') and
    has_table_privilege('authenticated',to_regclass(format('%I.%I','icamp_private','pilot203_owner_test_actions')),'INSERT')
 then raise exception 'Build 203 owner ledger is exposed to Data API'; end if;
 if not has_table_privilege('icamp_app',to_regclass(format('%I.%I','icamp_private','pilot203_owner_test_actions')),'INSERT')
 then raise exception 'Build 203 app owner ledger unavailable'; end if;
end $verify203$;
