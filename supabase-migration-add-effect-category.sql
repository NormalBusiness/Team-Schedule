-- ============================================
-- 카테고리에 '이펙트(effect)' 추가 마이그레이션
-- 이미 프로젝트를 만들어서 supabase-schema.sql을 실행했다면,
-- Supabase 대시보드 > SQL Editor 에서 이 파일만 추가로 실행하세요.
-- (새로 프로젝트를 만드는 경우엔 필요 없습니다. supabase-schema.sql에 이미 반영되어 있어요.)
-- ============================================

alter table tasks drop constraint if exists tasks_category_check;

alter table tasks add constraint tasks_category_check
  check (category in ('art', 'plan', 'dev', 'effect'));
