-- Build 080: ensure Supabase RLS planner hoists user identity context.
alter policy garbage_tag_issue on public.garbage_paid_tags with check (
 icamp_private.has_campground_permission(campground_id,'garbage.tags.sell')
 and issued_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
 and redeemed_pickup_id is null
);
alter policy garbage_tag_redeem on public.garbage_paid_tags with check (
 icamp_private.has_campground_permission(campground_id,'garbage.tags.redeem')
 and redeemed_by_user_id=nullif((select current_setting('icamp.user_id',true)),'')::uuid
);
