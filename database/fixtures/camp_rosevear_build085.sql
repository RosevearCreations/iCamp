-- Camp Rosevear — SYNTHETIC acceptance fixture for an isolated development database.
-- NEVER treat any training, water quality, operating state or rule here as real.
-- Intentionally NOT a schema migration and NEVER run automatically in CI/production.
-- Idempotent on a demo-only database; refuses any database with another campground.
-- No real guest, bookable accommodation, password, login session, payment or contact.
do $camp_rosevear$
declare
  org constant uuid := 'a8500000-0000-4000-8000-000000000001';
  camp constant uuid := 'a8500000-0000-4000-8000-000000000002';
  manager constant uuid := 'a8500000-0000-4000-8000-000000000003';
  attendant constant uuid := 'a8500000-0000-4000-8000-000000000004';
  water_section constant uuid := 'a8500000-0000-4000-8000-000000000011';
  beach constant uuid := 'a8500000-0000-4000-8000-000000000041';
  rules constant uuid := 'a8500000-0000-4000-8000-000000000051';
  rule_version constant uuid := 'a8500000-0000-4000-8000-000000000052';
  north_v1 constant uuid := 'a8500000-0000-4000-8000-000000000061';
  north_v2 constant uuid := 'a8500000-0000-4000-8000-000000000062';
  east_v1 constant uuid := 'a8500000-0000-4000-8000-000000000063';
begin
  if exists(select 1 from public.campgrounds where id <> camp) then
    raise exception 'Camp Rosevear fixture can only be seeded in an isolated demo database';
  end if;
  if exists(select 1 from icamp_private.user_accounts where id not in (manager, attendant)) then
    raise exception 'Camp Rosevear fixture refuses a database with real or unrelated accounts';
  end if;

  insert into public.organizations(id,name,slug,lifecycle_state)
   values(org,'Camp Rosevear — SYNTHETIC TEST ONLY','camp-rosevear-synthetic','inactive')
   on conflict(id) do nothing;
  insert into public.campgrounds(id,organization_id,name,slug,timezone,lifecycle_state)
   values(camp,org,'Camp Rosevear','camp-rosevear-sample','America/Toronto','inactive')
   on conflict(id) do nothing;

  -- Disabled, no-password identities exist only to exercise authored/actor FKs.
  insert into icamp_private.user_accounts(id,email_normalized,account_type,account_state)
   values(manager,'camp-rosevear-manager@example.invalid','staff','disabled'),
         (attendant,'camp-rosevear-attendant@example.invalid','staff','disabled')
   on conflict(id) do nothing;
  insert into icamp_private.campground_assignments(id,user_id,organization_id,campground_id,assignment_state)
   values('a8500000-0000-4000-8000-000000000005',manager,org,camp,'active'),
         ('a8500000-0000-4000-8000-000000000006',attendant,org,camp,'active')
   on conflict(id) do nothing;
  insert into icamp_private.campground_assignment_roles(assignment_id,role_id)
   select 'a8500000-0000-4000-8000-000000000005'::uuid,r.id
   from icamp_private.roles r where r.role_code='owner_admin' and r.role_kind='template'
   on conflict do nothing;
  insert into icamp_private.campground_assignment_roles(assignment_id,role_id)
   select 'a8500000-0000-4000-8000-000000000006'::uuid,r.id
   from icamp_private.roles r where r.role_code='waterfront_attendant' and r.role_kind='template'
   on conflict do nothing;

  insert into public.campground_sections(id,organization_id,campground_id,name,code,sort_order)
   values
    ('a8500000-0000-4000-8000-000000000010',org,camp,'Pine Loop — SAMPLE','PINE',10),
    (water_section,org,camp,'Waterfront — SAMPLE','WATER',20),
    ('a8500000-0000-4000-8000-000000000012',org,camp,'Recreation — SAMPLE','REC',30),
    ('a8500000-0000-4000-8000-000000000013',org,camp,'Operations — SAMPLE','OPS',40)
   on conflict(id) do nothing;
  insert into public.campground_subsections(id,organization_id,campground_id,section_id,name,code,sort_order)
   values
    ('a8500000-0000-4000-8000-000000000020',org,camp,'a8500000-0000-4000-8000-000000000010','North Pine — SAMPLE','PINE-N',10),
    ('a8500000-0000-4000-8000-000000000021',org,camp,water_section,'North Beach — SAMPLE','BEACH-N',10),
    ('a8500000-0000-4000-8000-000000000022',org,camp,'a8500000-0000-4000-8000-000000000012','Central Recreation — SAMPLE','REC-C',10),
    ('a8500000-0000-4000-8000-000000000023',org,camp,'a8500000-0000-4000-8000-000000000013','Service Yard — SAMPLE','OPS-S',10)
   on conflict(id) do nothing;

  -- Canonical map objects must precede facility assets. No invented image or polygon coordinates.
  insert into icamp_private.campground_map_objects
   (id,organization_id,campground_id,object_kind,object_code,display_name,section_id,lifecycle_state)
   values
    ('a8500000-0000-4000-8000-000000000031',org,camp,'asset','BEACH-01','SAMPLE North Beach',water_section,'active'),
    ('a8500000-0000-4000-8000-000000000032',org,camp,'pool','POOL-01','SAMPLE Swimming Pool','a8500000-0000-4000-8000-000000000012','active'),
    ('a8500000-0000-4000-8000-000000000033',org,camp,'washroom','WASH-01','SAMPLE Washroom','a8500000-0000-4000-8000-000000000012','active'),
    ('a8500000-0000-4000-8000-000000000034',org,camp,'gate','GATE-01','SAMPLE Main Gate','a8500000-0000-4000-8000-000000000013','active')
   on conflict(id) do nothing;
  insert into public.operational_assets
   (id,organization_id,campground_id,section_id,map_object_id,asset_class,code,display_name,lifecycle_state,operating_state,notes)
   values
    (beach,org,camp,water_section,'a8500000-0000-4000-8000-000000000031','facility','BEACH-01','SAMPLE North Beach','active','unavailable','Synthetic test beach: no swimming, no verified water quality, no real physical premises.'),
    ('a8500000-0000-4000-8000-000000000042',org,camp,'a8500000-0000-4000-8000-000000000012','a8500000-0000-4000-8000-000000000032','facility','POOL-01','SAMPLE Pool','active','unavailable','Synthetic pool only. No admission or water quality approval.'),
    ('a8500000-0000-4000-8000-000000000043',org,camp,'a8500000-0000-4000-8000-000000000012','a8500000-0000-4000-8000-000000000033','facility','WASH-01','SAMPLE Washroom','active','unavailable','Synthetic facility without real physical infrastructure.'),
    ('a8500000-0000-4000-8000-000000000044',org,camp,'a8500000-0000-4000-8000-000000000013','a8500000-0000-4000-8000-000000000034','facility','GATE-01','SAMPLE Gate','active','unavailable','Synthetic gate does not unlock or control hardware.')
   on conflict(id) do nothing;
  insert into public.operational_facilities(asset_id,organization_id,campground_id,facility_type,guest_visibility)
   values(beach,org,camp,'beach','internal'),
     ('a8500000-0000-4000-8000-000000000042',org,camp,'pool','internal'),
     ('a8500000-0000-4000-8000-000000000043',org,camp,'washroom','internal'),
     ('a8500000-0000-4000-8000-000000000044',org,camp,'gate','internal')
   on conflict(asset_id) do nothing;

  perform set_config('icamp.user_id',manager::text,true);
  insert into public.campground_rule_sets
   (id,organization_id,campground_id,code,title,rule_category,facility_id,created_by_user_id)
   values(rules,org,camp,'SAMPLE_WATERFRONT','SAMPLE Waterfront Rules — Not Approved','waterfront',beach,manager)
   on conflict(id) do nothing;
  insert into public.campground_rule_versions
   (id,organization_id,campground_id,rule_set_id,version_number,client_publication_id,content,acknowledgement_required,published_by_user_id)
   select rule_version,org,camp,rules,1,'a8500000-0000-4000-8000-000000000053'::uuid,
     'SYNTHETIC ONLY. This beach has no verified water quality or lifesaving staff. Swimming is prohibited. This sample rule is not a real safety plan.',true,manager
   where not exists(select 1 from public.campground_rule_versions where id=rule_version);

  insert into public.waterfront_swim_zone_versions
   (id,organization_id,campground_id,asset_id,zone_code,zone_name,version_number,boundary_description,
    operating_days,opens_at,closes_at,maximum_swimmers,minimum_unaccompanied_age,minimum_supervisor_age,
    maximum_children_per_supervisor,rule_version_id,hazard_instructions,published_by_user_id)
   select north_v1,org,camp,beach,'NORTH_SWIM','SAMPLE North Shore',1,
    'SYNTHETIC boundary between the imaginary north dock and two imaginary shoreline buoys; no physical signs exist.',
    array[1,2,3,4,5,6,7],'09:00'::time,'17:00'::time,20,12,18,2,rule_version,
    'SYNTHETIC ONLY. No verified lifeguards, tested water, rescue plan or physical safety perimeter. Never permit entry.',manager
   where not exists(select 1 from public.waterfront_swim_zone_versions where id=north_v1);
  insert into public.waterfront_swim_zone_versions
   (id,organization_id,campground_id,asset_id,zone_code,zone_name,version_number,boundary_description,
    operating_days,opens_at,closes_at,maximum_swimmers,minimum_unaccompanied_age,minimum_supervisor_age,
    maximum_children_per_supervisor,rule_version_id,hazard_instructions,published_by_user_id)
   select north_v2,org,camp,beach,'NORTH_SWIM','SAMPLE North Shore',2,
    'SYNTHETIC second version of the imaginary buoyed North Shore swimming boundary; no physical signs exist.',
    array[1,2,3,4,5,6,7],'09:00'::time,'17:00'::time,16,12,18,2,rule_version,
    'SYNTHETIC ONLY. Versioned zone limits are not local safety approval; water and staffing are unverified.',manager
   where not exists(select 1 from public.waterfront_swim_zone_versions where id=north_v2);
  insert into public.waterfront_swim_zone_versions
   (id,organization_id,campground_id,asset_id,zone_code,zone_name,version_number,boundary_description,
    operating_days,opens_at,closes_at,maximum_swimmers,minimum_unaccompanied_age,minimum_supervisor_age,
    maximum_children_per_supervisor,rule_version_id,hazard_instructions,published_by_user_id)
   select east_v1,org,camp,beach,'EAST_SWIM','SAMPLE East Shore',1,
    'SYNTHETIC separate East Shore swimming zone beyond the imaginary observation platform; no real map or markers exist.',
    array[1,2,3,4,5,6,7],'10:00'::time,'16:00'::time,12,12,18,2,rule_version,
    'SYNTHETIC ONLY. The east zone is not inspected, open or staffed; do not permit actual swimming.',manager
   where not exists(select 1 from public.waterfront_swim_zone_versions where id=east_v1);

  insert into public.waterfront_staff_training_events
   (id,organization_id,campground_id,asset_id,staff_user_id,decision,training_reference,expires_at,note,decided_by_user_id)
   select 'a8500000-0000-4000-8000-000000000071',org,camp,beach,attendant,'verify',
    'SAMPLE-TRAINING-NOT-A-REAL-CERTIFICATE','2027-06-01T00:00:00Z'::timestamptz,
    'Synthetic training marker for software acceptance only; no credential was independently certified.',manager
   where not exists(select 1 from public.waterfront_staff_training_events where id='a8500000-0000-4000-8000-000000000071');

  perform set_config('icamp.user_id',attendant::text,true);
  insert into public.waterfront_swim_events
   (id,organization_id,campground_id,asset_id,zone_code,zone_version_id,kind,hazard_type,note,actor_user_id)
   select 'a8500000-0000-4000-8000-000000000081',org,camp,beach,'NORTH_SWIM',north_v2,'incident','water_quality',
    'SYNTHETIC water-quality concern recorded for test only. There was no real observation.',attendant
   where not exists(select 1 from public.waterfront_swim_events where id='a8500000-0000-4000-8000-000000000081');
  insert into public.waterfront_swim_events
   (id,organization_id,campground_id,asset_id,zone_code,zone_version_id,kind,hazard_type,note,actor_user_id)
   select 'a8500000-0000-4000-8000-000000000082',org,camp,beach,'NORTH_SWIM',north_v2,'closure','water_quality',
    'SYNTHETIC immediate swimming closure. No real beach exists and no physical response took place.',attendant
   where not exists(select 1 from public.waterfront_swim_events where id='a8500000-0000-4000-8000-000000000082');
  insert into public.waterfront_swim_events
   (id,organization_id,campground_id,asset_id,zone_code,zone_version_id,kind,note,actor_user_id)
   select 'a8500000-0000-4000-8000-000000000083',org,camp,beach,'NORTH_SWIM',north_v2,'reopen_request',
    'SYNTHETIC reopen request left pending; canonical beach remains unavailable until real owner acceptance.',attendant
   where not exists(select 1 from public.waterfront_swim_events where id='a8500000-0000-4000-8000-000000000083');

  -- Never enable the demo campground or facilities during sample seeding.
  if not exists(select 1 from public.campgrounds where id=camp and lifecycle_state='inactive')
   or exists(select 1 from public.operational_assets where campground_id=camp and operating_state<>'unavailable') then
    raise exception 'Camp Rosevear fixtures must remain inactive and physically unavailable';
  end if;
end
$camp_rosevear$;
