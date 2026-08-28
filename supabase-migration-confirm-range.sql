-- ============================================
-- 컨펌(피드백) 기간을 업무 중간 어디든 지정 가능하도록 수정
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

alter table tasks add column if not exists feedback_end date;

-- 기존에 시작일만 있던 데이터는 종료일 = 업무 종료일로 채워줌 (하위 호환)
update tasks set feedback_end = end_date where feedback_start is not null and feedback_end is null;

alter table tasks drop constraint if exists tasks_feedback_start_check;
alter table tasks add constraint tasks_feedback_range_check
  check (
    (feedback_start is null and feedback_end is null)
    or (
      feedback_start is not null and feedback_end is not null
      and feedback_start <= feedback_end
      and feedback_start >= start_date and feedback_end <= end_date
    )
  );
