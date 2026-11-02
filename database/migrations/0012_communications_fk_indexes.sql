-- iCamp Build 009
-- Advisor-driven foreign-key indexes for omnichannel communications.

create index communication_preferences_updated_by_idx
  on icamp_private.communication_preferences (
    updated_by_user_id,
    updated_at desc
  );
