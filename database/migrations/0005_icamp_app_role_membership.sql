-- iCamp Build 005 follow-up
-- Allow the trusted server/migration database principal to deliberately assume
-- the NOLOGIN icamp_app role for RLS-enforced application queries.
--
-- This grants role membership only to the principal applying canonical
-- migrations. It does not grant icamp_app to anon/authenticated/public.

grant icamp_app to current_user;

comment on role icamp_app is
  'Trusted NOLOGIN application role. The canonical migration/server principal may SET ROLE icamp_app so public-schema access is evaluated through iCamp RLS policies.';
