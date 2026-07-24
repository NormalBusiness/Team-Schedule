# 팀 일정 관리

프로젝트별로 분리된 보드에서 아트/기획/플밍 카테고리로 일정을 간트 차트로 관리하는 팀 웹앱입니다.
팀원은 이메일/비밀번호로 로그인하고, 실시간으로 서로의 수정 사항을 확인할 수 있습니다.

---

## 1. Supabase 설정 (데이터베이스 + 로그인)

1. https://supabase.com 에서 무료 계정을 만들고 새 프로젝트를 생성합니다.
2. 프로젝트가 생성되면 좌측 메뉴 **SQL Editor**로 이동해서, 이 폴더의 `supabase-schema.sql` 파일 내용을 전체 복사해 붙여넣고 **Run**을 누릅니다.
   - `projects`, `tasks` 테이블이 생성되고, 로그인한 팀원만 접근 가능하도록 보안 정책이 설정됩니다.
   - 실시간 동기화(realtime)도 함께 활성화됩니다.
3. 좌측 메뉴 **Project Settings → API**로 이동해서 다음 두 값을 복사해둡니다.
   - `Project URL`
   - `anon public` 키
4. (선택) **Authentication → Providers → Email**에서 "Confirm email"을 꺼두면, 팀원이 가입 즉시 로그인할 수 있어 편리합니다. (내부 팀용이므로 꺼도 무방합니다.)
5. (선택, 권장) **Authentication → Settings**에서 "Allow new users to sign up"을 팀원 가입이 끝난 뒤 꺼두면, 외부인이 링크를 알아도 가입할 수 없습니다. 이후 신규 팀원은 관리자가 **Authentication → Users → Add user**로 직접 추가하면 됩니다.

## 2. 로컬에서 실행해보기

```bash
npm install
cp .env.example .env
```

`.env` 파일을 열어 Supabase에서 복사한 값을 입력합니다.

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx
```

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 후 가입/로그인해서 테스트합니다.

## 3. Vercel로 배포하기 (팀원 전체 공유)

1. 이 프로젝트를 GitHub 저장소로 올립니다 (private repo 권장).
2. https://vercel.com 에서 GitHub 계정으로 로그인 후 **New Project**로 이 저장소를 import 합니다.
3. **Environment Variables**에 다음을 추가합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**를 누르면 몇 분 뒤 `https://your-project.vercel.app` 형태의 주소가 생성됩니다.
5. 이 링크를 팀원에게 공유하고, 각자 이메일/비밀번호로 가입하게 하면 됩니다.

이후 코드를 수정해서 GitHub에 push하면 Vercel이 자동으로 재배포합니다.

## 4. 사용 방법

- 로그인 후 프로젝트 목록에서 **+ 새 프로젝트**로 프로젝트(예: MoneyPulate, 다음 작품 등)를 만듭니다.
- 프로젝트 카드를 클릭하면 해당 프로젝트의 간트 보드로 이동합니다.
- **+ 새 일정 추가**로 업무를 등록하고, 막대를 클릭하면 상세 내역을 볼 수 있습니다.
- 팀원이 같은 프로젝트에서 일정을 추가/수정하면 실시간으로 화면에 반영됩니다.

## 6. 디스코드 알림 설정 (업무 배정 / 마감 임박)

담당자가 배정되면 즉시, 마감 임박·초과 일정은 매일 아침 자동으로 디스코드 채널에 알림이 올라옵니다.

**1) 디스코드 웹훅 URL 만들기**
1. 알림 받을 디스코드 채널에서 채널 설정(⚙️) → **연동(Integrations)** → **웹훅(Webhooks)** → **새 웹훅**
2. 이름을 정하고 **웹훅 URL 복사**

**2) Supabase에 Edge Function 배포**
1. Supabase 대시보드 → 좌측 메뉴 **Edge Functions** → **Deploy a new function**
2. 함수 이름: `notify-discord`
3. `supabase/functions/notify-discord/index.ts` 파일 내용을 그대로 붙여넣고 **Deploy**

**3) Discord 웹훅 URL을 시크릿으로 등록**
1. Supabase 대시보드 → **Project Settings → Edge Functions → Secrets**
2. 이름 `DISCORD_WEBHOOK_URL`, 값에 1)에서 복사한 웹훅 URL 입력 후 저장

**4) 매일 아침 요약 알림 스케줄 등록 (GitHub Actions)**
1. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
2. 아래 두 개를 등록:
   - `SUPABASE_URL`: `.env`에 있는 값과 동일 (예: `https://xxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase 대시보드 → Project Settings → API → **service_role** 키 (anon 키 아님! 외부에 노출되면 안 되는 키라 반드시 GitHub Secrets에만 저장하세요)
3. `.github/workflows/deadline-digest.yml`이 저장소에 push되어 있으면 매일 한국시간 오전 9시에 자동 실행됩니다. **Actions** 탭에서 `Run workflow` 버튼으로 즉시 테스트도 가능해요.

설정 후 담당자를 지정해서 일정을 저장하면 바로 디스코드에 알림이 뜨는지 확인해보세요.


## 5. 폴더 구조

```
team-schedule/
  supabase-schema.sql   ← Supabase SQL Editor에서 실행
  supabase/functions/notify-discord/index.ts  ← 디스코드 알림 Edge Function
  .github/workflows/deadline-digest.yml       ← 매일 아침 마감 임박 알림 스케줄
  src/
    supabaseClient.js   ← Supabase 연결 설정
    App.jsx             ← 로그인 상태 관리 및 라우팅
    pages/
      Login.jsx          ← 로그인/가입
      Projects.jsx        ← 프로젝트 목록
      Board.jsx           ← 간트 차트 보드
```
