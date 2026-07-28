-- ============================================
-- 카테고리에 '사운드(sound)' 추가 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

alter table tasks drop constraint if exists tasks_category_check;

alter table tasks add constraint tasks_category_check
  check (category in ('art', 'plan', 'dev', 'effect', 'sound'));
