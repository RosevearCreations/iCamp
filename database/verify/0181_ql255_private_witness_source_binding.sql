do $$ begin
 if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relname='owner_export_ql255_six_app_proof_witness_relay_hold_reviews'
   and t.tgname='ql255_150_private_witness_original_source_guard' and not t.tgisinternal) then
  raise exception 'QL-255 private witness source/B and fresh nonce guard absent'; end if;
 if exists(select 1 from public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews r
  where r.review_kind='private_witness_custody_exception_escalation'
   and r.outcome_kind<>'original_witness_missing_hold'
   and not exists(select 1 from public.owner_export_ql255_six_app_proof_witness_relay_hold_reviews p
    where p.id=r.prior_review_id and p.outcome_kind='public_json_candidate_untrusted_hold'
     and p.proof_http_status='200' and p.source_sha_a is not null
     and p.source_ci_run_url is not null and p.proof_commit_sha_b is not null)) then
  raise exception 'QL-255 witness claimed on top of missing authentic public proof'; end if;
end $$;
