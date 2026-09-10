# 인증 아키텍처

> HTTP-Only 쿠키 기반 JWT 인증 + 2FA (2단계 인증) 시스템

## 개요

본 시스템은 **서버 사이드 인증**을 기본으로 하며, 클라이언트에서 토큰에 직접 접근할 수 없도록 설계되었습니다.
Admin 로그인은 보안 강화를 위해 **2단계 인증(2FA)**을 적용합니다.

### 핵심 원칙

1. **HTTP-Only 쿠키**: 토큰은 JavaScript에서 접근 불가
2. **서버 프록시**: 모든 API 요청은 SvelteKit 서버를 경유
3. **자동 토큰 갱신**: 서버에서 투명하게 처리
4. **단일 책임**: 인증 로직은 `$lib/server/auth.ts`에 집중
5. **2FA 필수**: 이메일/비밀번호 인증 후 추가 인증 코드 검증 필요

---

## 인증 흐름도

### 1. 로그인 플로우 (2FA)

Admin 로그인은 2단계로 구성됩니다:

```
Step 1: email + password → pending_token (5분 유효)
Step 2: pending_token + 인증 코드 → access_token + refresh_token
```

#### Step 1: 이메일/비밀번호 인증

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Client    │     │  SvelteKit  │     │   Backend API    │
│  (Browser)  │     │   Server    │     │ /admin/auth/login│
└──────┬──────┘     └──────┬──────┘     └────────┬─────────┘
       │                   │                     │
       │ POST /api/auth/login                    │
       │ {email, password} │                     │
       │──────────────────>│                     │
       │                   │                     │
       │                   │ POST /admin/auth/login
       │                   │────────────────────>│
       │                   │                     │
       │                   │<────────────────────│
       │                   │ {requires_2fa: true,│
       │                   │  pending_token,     │
       │                   │  user: {email,name}}│
       │                   │                     │
       │<──────────────────│                     │
       │ {requires_2fa,    │                     │
       │  pending_token,   │  ※ 쿠키 설정 없음  │
       │  user}            │                     │
       │                   │                     │
       │ step → '2fa'      │                     │
       │ (6자리 코드 입력) │                     │
       └───────────────────┴─────────────────────┘
```

- `pending_token`: JWT, 5분 만료, `type: "admin_2fa_pending"`
- 실제 토큰(access/refresh)은 이 단계에서 발급하지 않음
- Rate Limiting: IP당 5회/15분, 이메일당 10회/15분

#### Step 2: 2FA 코드 검증

```
┌─────────────┐     ┌─────────────┐     ┌───────────────────────┐
│   Client    │     │  SvelteKit  │     │     Backend API       │
│  (Browser)  │     │   Server    │     │/admin/auth/verify-2fa │
└──────┬──────┘     └──────┬──────┘     └───────────┬───────────┘
       │                   │                        │
       │ POST /api/auth/verify-2fa                  │
       │ {pending_token,   │                        │
       │  code: "123456"}  │                        │
       │──────────────────>│                        │
       │                   │                        │
       │                   │ POST /admin/auth/verify-2fa
       │                   │───────────────────────>│
       │                   │                        │
       │                   │   pending_token 검증   │
       │                   │   (type, 만료 확인)    │
       │                   │   코드 비교            │
       │                   │                        │
       │                   │<───────────────────────│
       │                   │ {access_token,         │
       │                   │  refresh_token,        │
       │                   │  account, person}      │
       │                   │                        │
       │                   │ Set HTTP-Only Cookies  │
       │                   │                        │
       │<──────────────────│                        │
       │ Set-Cookie:       │                        │
       │ accessToken=xxx   │                        │
       │ (httpOnly)        │                        │
       │                   │                        │
       │ auth.login(user)  │                        │
       │ goto('/dashboard')│                        │
       └───────────────────┴────────────────────────┘
```

- 코드 검증 성공 시 실제 `access_token` + `refresh_token` 발급
- HTTP-Only 쿠키에 토큰 설정
- Rate Limiting: IP당 10회/15분 (브루트포스 방어)
- 현재 인증 코드: **고정값 "123456"** (TODO: 이메일/SMS 발송으로 대체 예정)

### 2. API 요청 플로우

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  SvelteKit  │     │ /api/proxy  │     │ Backend API │
│  (Axios)    │     │   Server    │     │  /[...path] │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ GET /api/proxy/admin/centers          │                   │
       │ (쿠키 자동 포함)  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 쿠키에서 토큰 추출│                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ GET /admin/centers│
       │                   │                   │ Authorization:    │
       │                   │                   │ Bearer {token}    │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │<──────────────────│
       │                   │                   │ {data}            │
       │                   │                   │                   │
       │<──────────────────────────────────────│                   │
       │ {data}            │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### 3. 토큰 갱신 플로우

토큰 갱신은 **두 시점**에서 발생합니다:

#### 3.1 페이지 로드 시 (hooks.server.ts)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │hooks.server │     │   Auth API  │
│  (Request)  │     │     .ts     │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ GET /dashboard    │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ accessToken 만료? │
       │                   │ refreshToken 유효?│
       │                   │                   │
       │                   │ POST /auth/refresh│
       │                   │──────────────────>│
       │                   │                   │
       │                   │<──────────────────│
       │                   │ {new_access_token}│
       │                   │                   │
       │                   │ Set-Cookie 갱신   │
       │                   │ locals.user 설정  │
       │                   │                   │
       │<──────────────────│                   │
       │ 페이지 렌더링     │                   │
       │ + 새 쿠키         │                   │
       └───────────────────┴───────────────────┘
```

#### 3.2 API 401 응답 시 (proxy route)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ /api/proxy  │     │ Backend API │
│  (Axios)    │     │  /[...path] │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ GET /api/proxy/x  │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ GET /api/x        │
       │                   │──────────────────>│
       │                   │                   │
       │                   │<──────────────────│
       │                   │ 401 Unauthorized  │
       │                   │                   │
       │                   │ refreshToken으로  │
       │                   │ 토큰 갱신 시도    │
       │                   │──────────────────>│
       │                   │                   │
       │                   │<──────────────────│
       │                   │ {new_access_token}│
       │                   │                   │
       │                   │ 새 토큰으로 재요청│
       │                   │──────────────────>│
       │                   │                   │
       │                   │<──────────────────│
       │                   │ {data}            │
       │                   │                   │
       │<──────────────────│                   │
       │ {data} + 새 쿠키  │                   │
       └───────────────────┴───────────────────┘
```

---

## 파일 구조

```
src/
├── lib/server/
│   ├── config.ts          # API 서버 URL, 쿠키 설정
│   ├── auth.ts            # 인증 공통 유틸리티
│   └── api-proxy.ts       # 프록시 헬퍼 함수
│
├── routes/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/+server.ts       # Step 1: 로그인 → pending_token
│   │   │   ├── verify-2fa/+server.ts  # Step 2: 2FA 검증 → 쿠키 설정
│   │   │   ├── logout/+server.ts      # 로그아웃 (쿠키 삭제)
│   │   │   └── refresh/+server.ts     # 토큰 갱신
│   │   └── proxy/
│   │       └── [...path]/+server.ts   # 범용 API 프록시
│   │
│   ├── login/+page.svelte            # 로그인 페이지 (2단계 UI)
│   └── (protected)/
│       ├── +layout.server.ts         # 인증 가드
│       └── ...                       # 보호된 라우트들
│
├── hooks.server.ts                   # 서버 훅 (토큰 검증/갱신)
│
└── lib/stores/
    └── auth.ts                       # 클라이언트 인증 상태
```

### 백엔드 구조 (Admin Auth 모듈)

```
apps/api/app/modules/admin/auth/
├── __init__.py
├── router.py                    # POST /login, POST /verify-2fa
├── schemas.py                   # AdminLoginRequest/Response, Verify2FARequest
└── handlers/
    ├── __init__.py
    ├── login.py                 # Step 1: 인증 → pending_token (5분 JWT)
    └── verify_2fa.py            # Step 2: 코드 검증 → access_token + refresh_token
```

---

## 핵심 컴포넌트 설명

### 1. 로그인 페이지 (`login/+page.svelte`)

2단계 UI를 제공합니다:

| Step | UI | 동작 |
|------|----|------|
| `credentials` | 이메일/비밀번호 입력 폼 | Step 1 API 호출 → pending_token 저장 |
| `2fa` | 6자리 개별 입력 박스 | 6자리 입력 완료 시 자동 인증, 실패 시 초기화 |

2FA 입력 UX:
- 6개의 독립된 정사각형 입력 박스
- 숫자 입력 시 자동으로 다음 칸 포커스
- Backspace로 이전 칸 이동
- 붙여넣기(paste) 지원
- 6자리 모두 입력 시 자동 인증 (버튼 없음)
- 인증 실패 시 입력 초기화 + 첫 칸 포커스

### 2. `$lib/server/auth.ts`

인증 관련 모든 공통 로직을 담당합니다.

| 함수 | 역할 |
|------|------|
| `decodeJwt` | JWT 토큰 디코딩 |
| `isTokenExpired` | 토큰 만료 확인 |
| `extractUserFromToken` | 토큰에서 사용자 정보 추출 |
| `refreshAccessToken` | 리프레시 토큰으로 새 토큰 발급 |
| `tryRefreshAndSetCookies` | 토큰 갱신 + 쿠키 설정 |
| `clearAuthCookies` | 인증 쿠키 삭제 |
| `setAuthCookies` | 인증 쿠키 설정 |

### 3. SvelteKit 서버 엔드포인트

#### `api/auth/login/+server.ts` (Step 1)

- 백엔드 `POST /admin/auth/login` 호출
- 응답의 `pending_token`과 `user` 정보를 클라이언트에 반환
- **쿠키 설정 없음** (아직 인증 미완료)

#### `api/auth/verify-2fa/+server.ts` (Step 2)

- 백엔드 `POST /admin/auth/verify-2fa` 호출
- 인증 성공 시 HTTP-Only 쿠키에 `access_token`, `refresh_token` 설정
- 클라이언트에 사용자 정보 반환

### 4. `hooks.server.ts`

모든 요청에서 토큰 유효성을 검사하고 `locals`에 사용자 정보를 설정합니다.

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  // 1. 기본값 설정
  event.locals.user = null;
  event.locals.accessToken = null;

  // 2. public 경로는 스킵
  if (isPublicPath) return resolve(event);

  // 3. 토큰 검증
  if (accessToken && !isTokenExpired(accessToken)) {
    event.locals.user = extractUserFromToken(accessToken);
  } else if (refreshToken) {
    // 4. 토큰 갱신 시도
    await tryRefreshAndSetCookies(event.cookies, isProduction);
  }

  return resolve(event);
};
```

### 5. `+layout.server.ts` (protected)

보호된 라우트에서 인증 가드 역할을 합니다.

```typescript
export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, `/login?redirectTo=${url.pathname}`);
  }
  return { user: locals.user };
};
```

### 6. 클라이언트 인증 스토어

```typescript
// $lib/stores/auth.ts
export const auth = createAuthStore();

// 사용법
auth.login(user);      // 로그인 상태 설정
auth.logout();         // 상태 초기화
auth.initialize(user); // 서버에서 받은 user로 초기화
```

---

## 백엔드 인증 API

### 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/v1/admin/auth/login` | Step 1: 이메일/비밀번호 인증 → pending_token |
| `POST` | `/api/v1/admin/auth/verify-2fa` | Step 2: 2FA 코드 검증 → 실제 토큰 발급 |

### Step 1 응답

```json
{
  "requires_2fa": true,
  "pending_token": "eyJhbG...",
  "user": {
    "email": "admin@test.com",
    "name": "김원장"
  }
}
```

### Step 2 응답

```json
{
  "account": { "id": "uuid", "email": "admin@test.com", ... },
  "person": { "id": "uuid", "name": "김원장", "phone": "010-..." },
  "access_token": "eyJhbG...",
  "refresh_token": "Xs2hNC...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### pending_token 구조

```json
{
  "account_id": "uuid",
  "person_id": "uuid",
  "email": "admin@test.com",
  "type": "admin_2fa_pending",
  "token_version": 2,
  "account_token_version": 0,
  "exp": 1772605058
}
```

- `type: "admin_2fa_pending"`: 일반 access_token과 구분
- 5분 만료: 인증 코드 입력 제한 시간

### Rate Limiting

| 단계 | 키 | 제한 |
|------|----|------|
| Step 1 | `admin_ip:{ip}` | 5회/15분 |
| Step 1 | `admin_email:{email}` | 10회/15분 |
| Step 2 | `admin_2fa_ip:{ip}` | 10회/15분 |

인증 성공 시 해당 Rate Limit 카운터 초기화.

---

## API 프록시 라우팅

클라이언트 요청이 실제 API 서버로 라우팅되는 규칙:

| 클라이언트 요청 | 라우팅 대상 |
|----------------|-------------|
| `/api/proxy/admin/*` | `API_URL/admin/*` |
| `/api/proxy/auth/*` | `API_URL/auth/*` |
| `/api/proxy/*` (기타) | `API_URL/*` |

---

## 쿠키 설정

| 쿠키 | 용도 | 만료 | 옵션 |
|------|------|------|------|
| `admin_accessToken` | API 인증 | 30분 | httpOnly, secure*, sameSite=strict |
| `admin_refreshToken` | 토큰 갱신 | 7일 | httpOnly, secure*, sameSite=strict |

> *secure는 HTTPS 환경에서만 활성화

---

## 보안 고려사항

### 적용된 보안 조치

1. **HTTP-Only 쿠키**: XSS 공격으로부터 토큰 보호
2. **SameSite=strict**: CSRF 공격 방지
3. **서버 프록시**: 토큰이 클라이언트 코드에 노출되지 않음
4. **자동 토큰 갱신**: 사용자 경험 저하 없이 세션 유지
5. **2FA 인증**: 추가 인증 필요
6. **pending_token 분리**: 2FA 미완료 시 API 접근 불가 (`type` 필드로 구분)
7. **Rate Limiting**: 브루트포스 공격 방어 (IP/이메일 기반)
8. **5분 제한**: pending_token 만료로 인증 코드 입력 시간 제한

### TODO

- [ ] 인증 코드를 이메일/SMS로 발송 (현재 고정값 "123456")
- [ ] TOTP (Google Authenticator 등) 지원 검토

---

## 트러블슈팅

### 401 에러가 계속 발생하는 경우

1. 리프레시 토큰 만료 확인
2. 쿠키가 제대로 설정되었는지 확인 (DevTools > Application > Cookies)
3. `hooks.server.ts`에서 토큰 갱신 로직 확인

### 로그인 후 리다이렉트가 안 되는 경우

1. `auth.login()` 호출 확인
2. `goto()` 호출 확인
3. `+layout.server.ts`에서 `locals.user` 반환 확인

### 2FA 코드 입력이 안 되는 경우

1. pending_token 만료 여부 확인 (5분 제한)
2. Rate Limit 초과 여부 확인
3. 백엔드 로그에서 `admin_2fa_pending` 토큰 디코딩 오류 확인

### API 요청이 실패하는 경우

1. 프록시 라우트 확인 (`/api/proxy/...`)
2. `config.ts`의 API URL 확인
3. 환경 변수 설정 확인 (`.env`)