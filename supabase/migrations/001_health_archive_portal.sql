-- User portal: password hash, profile completion flag, assigned health manager (app_content.id)
-- Run in Supabase SQL editor or via CLI migrations.

alter table public.health_archives
  add column if not exists password_hash text,
  add column if not exists profile_complete boolean default true,
  add column if not exists health_manager_content_id text;

comment on column public.health_archives.password_hash is 'bcrypt hash after user changes password; null means default login uses checkup_id';
comment on column public.health_archives.profile_complete is 'false: user should contact health manager to finish onboarding';
comment on column public.health_archives.health_manager_content_id is 'FK to app_content.id (type doctor, tagged 健康管家)';

-- RLS: adjust to your project. Example policies if using anon key from the SPA:
-- 1) Allow authenticated reads for archives (existing policy may already cover this).
-- 2) For password updates from the user app without Supabase Auth uid, you may need:
--    create policy "user_updates_own_portal_fields" on public.health_archives
--      for update using (true) with check (true);
-- (Using true is permissive; tighten with service role or Edge Function in production.)
