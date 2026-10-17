-- diagnostics: triggers and functions
select
  t.tgname,
  t.tgenabled,
  p.proname as function_name,
  n.nspname as function_schema
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where c.relname = 'health_archives'
  and not t.tgisinternal;

-- find custom blocking function text
select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where pg_get_functiondef(p.oid) ilike '%role not allowed to update health_archives%';

-- runtime role check helper
select current_user as db_user, session_user as session_user;
