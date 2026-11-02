-- iCamp Build 073 advisor-hardening verification.
do $build073_advisor_hardening_verify$
begin
  if to_regclass(
    'public.campsite_departure_cleanup_programs_scope_accommodation_fk_idx'
  ) is null then
    raise exception 'Build 073 accommodation foreign-key covering index is missing';
  end if;

  if to_regclass(
    'public.campsite_departure_cleanup_tasks_scope_checkout_fk_idx'
  ) is null then
    raise exception 'Build 073 checkout foreign-key covering index is missing';
  end if;

  if to_regclass(
    'public.campsite_departure_cleanup_tasks_scope_occurrence_fk_idx'
  ) is null then
    raise exception 'Build 073 inspection-occurrence foreign-key covering index is missing';
  end if;
end
$build073_advisor_hardening_verify$;
