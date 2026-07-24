-- ============================================
-- 프로젝트 기간(시작일/종료일) 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

alter table projects add column if not exists start_date date;
alter table projects add column if not exists end_date date;

-- 기존에 만들어둔 프로젝트가 있다면 기본값(오늘 ~ 30일 뒤)으로 채워줍니다
update projects
set start_date = coalesce(start_date, current_date),
    end_date = coalesce(end_date, current_date + 30)
where start_date is null or end_date is null;

alter table projects alter column start_date set not null;
alter table projects alter column start_date set default current_date;
alter table projects alter column end_date set not null;
alter table projects alter column end_date set default (current_date + 30);
