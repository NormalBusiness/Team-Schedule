-- ============================================
-- 컨펌(피드백) 기간을 업무 하나당 여러 개 지정 가능하도록 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

create table if not exists task_confirm_periods (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  constraint task_confirm_periods_range_check check (start_date <= end_date)
);

alter table task_confirm_periods enable row level security;

drop policy if exists "team members full access on confirm periods" on task_confirm_periods;
create policy "team members full access on confirm periods"
  on task_confirm_periods for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table task_confirm_periods;

-- 기존에 tasks.feedback_start / feedback_end 로 저장돼있던 컨펌 기간을
-- 새 테이블로 옮겨줌 (기존 데이터 유지)
insert into task_confirm_periods (task_id, start_date, end_date)
select id, feedback_start, feedback_end
from tasks
where feedback_start is not null and feedback_end is not null;
