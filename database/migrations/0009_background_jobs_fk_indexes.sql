-- iCamp Build 007
-- Cover background-job tenant/property foreign keys for operational scale.

create index job_schedules_scope_idx
  on icamp_private.job_schedules (organization_id, campground_id);

create index job_queue_scope_idx
  on icamp_private.job_queue (organization_id, campground_id);
