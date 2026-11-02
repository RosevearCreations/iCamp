-- Build 108: supporting read-only cross-campground oversight scans.
-- No new grants, tables, policies, writable views or changes to audit receipts.
create index if not exists owner_export_cases_pair_opened_idx
 on public.owner_export_exception_cases
 (source_campground_id,target_campground_id,opened_at desc,id desc);

create index if not exists owner_export_outcomes_pair_recorded_idx
 on public.owner_export_exception_outcomes
 (source_campground_id,target_campground_id,recorded_at desc,id desc);

create index if not exists owner_export_reviews_pair_reviewed_idx
 on public.owner_export_exception_reviews
 (source_campground_id,target_campground_id,reviewed_at desc,id desc);
