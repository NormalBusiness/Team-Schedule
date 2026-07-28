-- ============================================
-- 디스코드 멘션을 위한 discord_id 컬럼 추가
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

alter table profiles add column if not exists discord_id text;
