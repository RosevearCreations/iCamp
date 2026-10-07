-- Build 014 compliance-rule foreign-key index verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass(
    'icamp_private.communication_compliance_rules_scope_idx'
  ) is null then
    raise exception 'Missing Build 014 compliance-rule scope index';
  end if;
end
$$;
