# 다항식 숲 탐험

다항식 학습 게임과 계정별 비공개 학습 기록을 제공하는 정적 웹앱입니다.

## 로컬 검증

Node.js 24 이상에서 잠금 파일을 유지하고 의존성을 검토한 뒤 실행합니다.

```powershell
npm ci --ignore-scripts
npm test
npm run build
```

빌드는 `build/releases/<SHA-256>/`에 생성되고 `build/current.json`이 현재 릴리스를 가리킵니다. 저장소 루트 또는 `supabase/`를 정적 호스팅 루트로 사용하지 마세요. 의존성 설치 스크립트가 필요한 환경에서는 실행 대상을 별도로 검토해야 합니다.

## 인증 및 데이터베이스

현재 앱은 아이디·비밀번호 가입/로그인과 교사가 본인을 확인하는 관리자 비밀번호 재설정 흐름을 사용합니다. 초기 Google 인증 버전의 설명보다 현재 소스가 우선합니다.

새 격리 프로젝트에서는 `supabase/learning-records.sql` 다음 `supabase/simple-accounts.sql` 순서로 검토·적용합니다. 기존 데이터베이스에 재실행하는 마이그레이션 도구가 아니므로 먼저 스키마와 백업을 확인해야 합니다. `tests/database-check.sql`은 예약된 합성 계정 ID가 없는 격리 환경에서만 실행합니다. `tests/account-live.mjs`는 실제 계정을 생성하므로 자동으로 실행하지 마세요.

`public-config.json`에는 Supabase URL과 브라우저용 publishable key만 둡니다. `forest-account` Edge Function은 서버 환경의 `SUPABASE_URL`과 `SUPABASE_SECRET_KEYS` 또는 `SUPABASE_SERVICE_ROLE_KEY`를 읽습니다. 관리자 키는 저장소·브라우저·빌드 산출물에 넣지 마세요. 다른 프로젝트로 복제할 때 config, 함수의 허용 Origin, 관리자 스크립트의 대상 URL을 함께 검토해야 합니다. CORS는 인증을 대신하지 않습니다.

학습 기록의 소유자 RLS와 서버 검증은 필수입니다. 공개 소스에 운영 기록·개인정보·관리자 자격 증명은 포함하지 않습니다. 소스 공개는 웹 배포나 데이터베이스 변경을 수행하지 않습니다. 알려진 제한은 `PUBLICATION-SECURITY.md`를 확인하세요.
