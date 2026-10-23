-- iCamp Build 075 advisor-hardening verification.
do $verify$
declare
  expected_index text;
begin
  foreach expected_index in array array[
    'preventive_maintenance_programs_scope_asset_fk_idx',
    'preventive_maintenance_programs_scope_template_fk_idx',
    'preventive_maintenance_programs_scope_schedule_fk_idx'
  ]
  loop
    if to_regclass('public.' || expected_index) is null then
      raise exception 'Build 075 advisor-hardening index % is missing',
        expected_index;
    end if;
  end loop;
end
$verify$;
