-- iCamp Build 068 hosted-advisor hardening.
-- Cover the campground-scoped inspection sign-off occurrence foreign key.

create index inspection_signoffs_scope_occurrence_fk_idx
  on public.inspection_signoffs(
    organization_id,
    campground_id,
    occurrence_id
  );
