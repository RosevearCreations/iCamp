-- iCamp Build 010
-- Advisor-driven foreign-key indexes for voice call campground scope.

create index voice_calls_dispatch_scope_idx
  on icamp_private.voice_calls (
    campground_id,
    dispatch_id
  );

create index voice_calls_line_scope_idx
  on icamp_private.voice_calls (
    campground_id,
    line_id
  );
