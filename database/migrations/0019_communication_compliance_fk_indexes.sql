-- iCamp Build 014
-- Advisor-driven covering index for communication compliance-rule foreign keys.

create index communication_compliance_rules_scope_idx
  on icamp_private.communication_compliance_rules (
    organization_id,
    campground_id
  );
