-- health_archives verification
select
  current_database() as db,
  current_schema() as schema,
  (select relrowsecurity from pg_class where oid = 'public.health_archives'::regclass) as rls_enabled,
  has_table_privilege('anon', 'public.health_archives', 'select,insert,update,delete') as anon_crud,
  has_table_privilege('authenticated', 'public.health_archives', 'select,insert,update,delete') as auth_crud;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'health_archives'
order by policyname;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='health_archives'
  and column_name in ('health_record','follow_ups','follow_up_schedule','assessment_data','updated_at','last_sync_source');
