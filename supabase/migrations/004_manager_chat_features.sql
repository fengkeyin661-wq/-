-- 004_manager_chat_features.sql
-- 健康管家会话与推荐能力：消息扩展字段 + 云端 RLS 读写策略

begin;

-- 聊天消息扩展字段（文本/图片/推荐卡）
alter table if exists public.app_chat_messages
  add column if not exists message_type text default 'text',
  add column if not exists media_url text,
  add column if not exists thumb_url text,
  add column if not exists metadata jsonb;

comment on column public.app_chat_messages.message_type is 'text|image|card_recommend';
comment on column public.app_chat_messages.media_url is '图片消息URL';
comment on column public.app_chat_messages.thumb_url is '缩略图URL';
comment on column public.app_chat_messages.metadata is '推荐卡等扩展数据';

alter table if exists public.app_chat_messages enable row level security;
alter table if exists public.app_interactions enable row level security;

-- 清理历史策略（幂等）
drop policy if exists chat_select_authenticated_all on public.app_chat_messages;
drop policy if exists chat_insert_authenticated_all on public.app_chat_messages;
drop policy if exists chat_update_authenticated_all on public.app_chat_messages;
drop policy if exists inter_select_authenticated_all on public.app_interactions;
drop policy if exists inter_insert_authenticated_all on public.app_interactions;
drop policy if exists inter_update_authenticated_all on public.app_interactions;

-- 回收 anon 权限，统一使用 authenticated
revoke all on table public.app_chat_messages from anon;
revoke all on table public.app_interactions from anon;

grant select, insert, update on public.app_chat_messages to authenticated;
grant select, insert, update on public.app_interactions to authenticated;

create policy chat_select_authenticated_all
on public.app_chat_messages
for select
to authenticated
using (true);

create policy chat_insert_authenticated_all
on public.app_chat_messages
for insert
to authenticated
with check (true);

create policy chat_update_authenticated_all
on public.app_chat_messages
for update
to authenticated
using (true)
with check (true);

create policy inter_select_authenticated_all
on public.app_interactions
for select
to authenticated
using (true);

create policy inter_insert_authenticated_all
on public.app_interactions
for insert
to authenticated
with check (true);

create policy inter_update_authenticated_all
on public.app_interactions
for update
to authenticated
using (true)
with check (true);

commit;

