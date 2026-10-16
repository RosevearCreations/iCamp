-- iCamp Build 052 advisor hardening
-- Cover the scoped reservation foreign key on stay-adjustment evidence.

drop index if exists public.reservation_stay_adjustments_reservation_idx;

create index reservation_stay_adjustments_reservation_idx
  on public.reservation_stay_adjustments(
    organization_id,
    campground_id,
    reservation_id,
    occurred_at desc
  );

comment on index public.reservation_stay_adjustments_reservation_idx is
  'Build 052 covering index for the scoped reservation foreign key and reservation-time history reads.';
