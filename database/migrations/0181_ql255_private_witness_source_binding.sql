-- Build 150 follow-up hardening: even unverified private witness claims
-- require a real source 200 candidate B and a fresh original 5m challenge.
create function icamp_private.ql255_150_private_witness_original_source_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare prior_source record; checked_at timestamptz;
begin
 if new.review_kind<>'private_witness_custody_exception_escalation'
  or new.outcome_kind='original_witness_missing_hold' then return new; end if;
 select outcome_kind,proof_http_status,source_sha_a,source_ci_run_url,
  proof_commit_sha_b,proof_sha256,ql254_review_id,source_campground_id,target_campground_id
  into prior_source
  from public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews
  where id=new.prior_review_id;
 if prior_source.outcome_kind is distinct from 'public_json_candidate_untrusted_hold'
  or prior_source.proof_http_status is distinct from '200'
  or prior_source.source_sha_a is null or prior_source.source_ci_run_url is null
  or prior_source.proof_commit_sha_b is null or prior_source.proof_sha256 is null
  or prior_source.ql254_review_id is distinct from new.ql254_review_id
  or prior_source.source_campground_id is distinct from new.source_campground_id
  or prior_source.target_campground_id is distinct from new.target_campground_id then
  raise exception 'QL-255 cannot claim private witness receipts without genuine public proof A/CI/B candidate'; end if;
 checked_at:=clock_timestamp();
 if new.nonce_issued_at is null or new.nonce_expires_at is null
  or new.nonce_issued_at>checked_at
  or new.nonce_issued_at<checked_at-interval '5 minutes'
  or new.nonce_expires_at<checked_at
  or new.nonce_expires_at>new.nonce_issued_at+interval '5 minutes' then
  raise exception 'QL-255 independent private challenge must be currently valid and at most five minutes'; end if;
 return new;
end $$;
create trigger ql255_150_private_witness_original_source_guard before insert
 on public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews for each row
 execute function icamp_private.ql255_150_private_witness_original_source_guard();
revoke all on function icamp_private.ql255_150_private_witness_original_source_guard() from public;
