-- Verify iCamp Build 077 advisor hardening.

do $verify$
begin
  if to_regclass(
    'public.camper_assistance_request_events_scope_request_fk_idx'
  ) is null then
    raise exception 'Build 077 events composite FK index is missing';
  end if;

  if to_regclass(
    'public.camper_assistance_request_media_scope_request_fk_idx'
  ) is null then
    raise exception 'Build 077 media composite FK index is missing';
  end if;
end
$verify$;
