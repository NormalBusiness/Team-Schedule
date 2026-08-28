-- ============================================
-- 중간 컨펌(마일스톤) 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

alter table tasks add column if not exists is_milestone boolean not null default false;
