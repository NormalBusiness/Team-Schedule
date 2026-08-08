-- ============================================
-- 파트별 디렉터 지정 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

create table if not exists directors (
  category text primary key check (category in ('art', 'plan', 'dev', 'effect', 'sound')),
  user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz default now()
);

alter table directors enable row level security;

drop policy if exists "team members can view directors" on directors;
create policy "team members can view directors"
  on directors for select
  using (auth.role() = 'authenticated');

drop policy if exists "team members can set directors" on directors;
create policy "team members can set directors"
  on directors for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table directors;
