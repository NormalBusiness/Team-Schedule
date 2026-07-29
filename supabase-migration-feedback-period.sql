-- ============================================
-- 피드백(컨펌) 기간 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

alter table tasks add column if not exists feedback_start date;

alter table tasks drop constraint if exists tasks_feedback_start_check;
alter table tasks add constraint tasks_feedback_start_check
  check (feedback_start is null or (feedback_start >= start_date and feedback_start <= end_date));
