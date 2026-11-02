-- iCamp Build 054 advisor hardening.
-- Cover the composite vehicle-pass payment foreign key in scope order.

create index if not exists vehicle_pass_payments_scope_pass_fk_idx
  on public.vehicle_pass_payments(
    organization_id,
    campground_id,
    vehicle_pass_id
  );
