-- ============================================
-- 팀 일정 관리 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요
-- ============================================

create extension if not exists "pgcrypto";

-- 프로젝트 테이블 (프로젝트별로 완전히 분리된 보드)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date not null default current_date,
  end_date date not null default (current_date + 30),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 팀원 프로필 (회원가입 시 이름 저장)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  discord_id text,
  created_at timestamptz default now()
);

-- 팀원 1:1 채팅
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- 일정(업무) 테이블
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  category text not null check (category in ('art', 'plan', 'dev', 'effect', 'sound')),
  assignee text,
  start_date date not null,
  end_date date not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  description text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 행 수준 보안 활성화
alter table projects enable row level security;
alter table tasks enable row level security;
alter table profiles enable row level security;

-- 로그인한 팀원은 모든 프로젝트/일정을 읽고 쓸 수 있음
create policy "team members full access on projects"
  on projects for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "team members full access on tasks"
  on tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "team members can view all profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

alter table messages enable row level security;

create policy "users can view own conversations"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "users can send messages"
  on messages for insert
  with check (auth.uid() = sender_id);

-- 회원가입 시 auth.users에 새 행이 생기면 자동으로 profiles에도 이름을 넣어주는 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 실시간 동기화를 위해 tasks 테이블을 realtime publication에 추가
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table messages;
