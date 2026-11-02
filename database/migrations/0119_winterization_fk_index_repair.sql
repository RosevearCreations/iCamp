-- Build 087 post-migration advisor follow-up: support all scoped FK checks.
create index winterization_step_run_fk_idx
 on public.winterization_step_events(organization_id,campground_id,run_id);
create index winterization_review_run_fk_idx
 on public.winterization_reviews(organization_id,campground_id,run_id);
