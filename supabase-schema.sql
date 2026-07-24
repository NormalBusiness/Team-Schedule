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
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 일정(업무) 테이블
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  category text not null check (category in ('art', 'plan', 'dev', 'effect')),
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

-- 로그인한 팀원은 모든 프로젝트/일정을 읽고 쓸 수 있음
create policy "team members full access on projects"
  on projects for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "team members full access on tasks"
  on tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 실시간 동기화를 위해 tasks 테이블을 realtime publication에 추가
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table projects;
