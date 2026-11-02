-- iCamp Build 004 follow-up
-- auth_sessions uses icamp_private.touch_row(), so it requires updated_at.

alter table icamp_private.auth_sessions
  add column if not exists updated_at timestamptz
  not null default statement_timestamp();

comment on column icamp_private.auth_sessions.updated_at is
  'Last server-side session-row update timestamp; maintained by touch_row().';
