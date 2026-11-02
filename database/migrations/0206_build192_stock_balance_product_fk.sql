-- Build 192: cover the scoped product foreign key on store stock balances.
-- Index only: no data mutation, no payment processing or inventory changes.
create index if not exists store_stock_balances_product_fk_idx
  on icamp_private.store_stock_balances (organization_id, campground_id, product_id);
