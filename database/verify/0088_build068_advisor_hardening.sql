-- iCamp Build 068 hosted-advisor hardening verification.
do $verify$
begin
  if to_regclass(
    'public.inspection_signoffs_scope_occurrence_fk_idx'
  ) is null then
    raise exception 'Build 068 sign-off occurrence scope index is missing';
  end if;
end
$verify$;
