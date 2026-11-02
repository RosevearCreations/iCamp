-- Build 183 advisor hardening: cover all newly introduced FK lookup paths.
-- Additive indexes only; no catalog, cart or identity data changes.

create index store_products_created_by_fk_idx
  on icamp_private.store_catalog_products(created_by_user_id)
  where created_by_user_id is not null;
create index store_products_reviewed_by_fk_idx
  on icamp_private.store_catalog_products(reviewed_by_user_id)
  where reviewed_by_user_id is not null;
create index store_products_updated_by_fk_idx
  on icamp_private.store_catalog_products(updated_by_user_id)
  where updated_by_user_id is not null;
create index guest_store_carts_reviewed_by_fk_idx
  on icamp_private.guest_store_cart_drafts(reviewed_by_user_id)
  where reviewed_by_user_id is not null;
create index guest_store_cart_lines_scoped_cart_fk_idx
  on icamp_private.guest_store_cart_lines(organization_id,campground_id,cart_id);
