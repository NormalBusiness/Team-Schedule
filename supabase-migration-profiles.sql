-- ============================================
-- 팀원 이름(프로필) 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "team members can view all profiles" on profiles;
create policy "team members can view all profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert own profile" on profiles;
create policy "users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- 회원가입 시 auth.users에 새 행이 생기면 자동으로 profiles에도 이름을 넣어주는 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 이미 가입한 팀원이 있다면, 기존 계정에도 profiles 행을 채워줍니다 (이름은 이메일로 대체됨)
insert into public.profiles (id, name)
select id, coalesce(raw_user_meta_data->>'name', email) from auth.users
on conflict (id) do nothing;
