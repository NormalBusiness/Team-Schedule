-- ============================================
-- 팀원 1:1 채팅용 messages 테이블
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists messages_conversation_idx
  on messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);

alter table messages enable row level security;

drop policy if exists "users can view own conversations" on messages;
create policy "users can view own conversations"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "users can send messages" on messages;
create policy "users can send messages"
  on messages for insert
  with check (auth.uid() = sender_id);

alter publication supabase_realtime add table messages;
