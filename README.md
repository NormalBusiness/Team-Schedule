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

## 5. 폴더 구조

```
team-schedule/
  supabase-schema.sql   ← Supabase SQL Editor에서 실행
  src/
    supabaseClient.js   ← Supabase 연결 설정
    App.jsx             ← 로그인 상태 관리 및 라우팅
    pages/
      Login.jsx          ← 로그인/가입
      Projects.jsx        ← 프로젝트 목록
      Board.jsx           ← 간트 차트 보드
```
# Team-Schedule
