do $verify_build183_fk_hardening$
declare idx text;
begin
  foreach idx in array array[
    'store_products_created_by_fk_idx','store_products_reviewed_by_fk_idx',
    'store_products_updated_by_fk_idx','guest_store_carts_reviewed_by_fk_idx',
    'guest_store_cart_lines_scoped_cart_fk_idx'
  ] loop
    if not exists (select 1 from pg_indexes where schemaname='icamp_private' and indexname=idx) then
      raise exception 'Build183 required scoped FK index missing: %',idx;
    end if;
  end loop;
end $verify_build183_fk_hardening$;
