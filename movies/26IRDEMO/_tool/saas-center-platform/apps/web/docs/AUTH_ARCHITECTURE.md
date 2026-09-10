# 인증 아키텍처

> HTTP-Only 쿠키 기반 JWT 인증 시스템

## 개요

본 시스템은 **서버 사이드 인증**을 기본으로 하며, 클라이언트에서 토큰에 직접 접근할 수 없도록 설계되었습니다.

### 핵심 원칙

1. **HTTP-Only 쿠키**: 토큰은 JavaScript에서 접근 불가
2. **서버 프록시**: 모든 API 요청은 SvelteKit 서버를 경유
3. **자동 토큰 갱신**: 서버에서 투명하게 처리
4. **단일 책임**: 인증 로직은 `$lib/server/auth.ts`에 집중

---

## 인증 흐름도

### 1. 로그인 플로우

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  SvelteKit  │     │  /api/auth  │     │   Auth API  │
│  (Browser)  │     │   Server    │     │   /login    │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ POST /api/auth/login                  │                   │
       │ {email, password} │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ POST /auth/login  │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ POST /auth/login  │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │<──────────────────│
       │                   │                   │ {access_token,    │
       │                   │                   │  refresh_token}   │
       │                   │                   │                   │
       │                   │<──────────────────│                   │
       │                   │ Set HTTP-Only     │                   │
       │                   │ Cookies           │                   │
       │                   │                   │                   │
       │<──────────────────│                   │                   │
       │ Set-Cookie:       │                   │                   │
       │ accessToken=xxx   │                   │                   │
       │ (httpOnly)        │                   │                   │
       │                   │                   │                   │
       │ auth.login(user)  │                   │                   │
       │ (클라이언트 상태) │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### 2. API 요청 플로우

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  SvelteKit  │     │ /api/proxy  │     │ Backend API │
│  (Axios)    │     │   Server    │     │  /[...path] │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ GET /api/proxy/clients               │                   │
       │ (쿠키 자동 포함)  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 쿠키에서 토큰 추출│                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ GET /api/clients  │
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
│   ├── config.ts          # API 서버 URL 설정 (환경 변수)
│   ├── auth.ts            # 인증 공통 유틸리티
│   └── api-proxy.ts       # 프록시 헬퍼 함수
│
├── routes/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/+server.ts    # 로그인 엔드포인트
│   │   │   └── logout/+server.ts   # 로그아웃 엔드포인트
│   │   └── proxy/
│   │       └── [...path]/+server.ts # 범용 API 프록시
│   │
│   ├── login/+page.svelte          # 로그인 페이지
│   └── (protected)/
│       ├── +layout.server.ts       # 인증 가드
│       └── ...                     # 보호된 라우트들
│
├── hooks.server.ts                 # 서버 훅 (토큰 검증/갱신)
│
└── lib/stores/
    └── auth.ts                     # 클라이언트 인증 상태
```

---

## 핵심 컴포넌트 설명

### 1. `$lib/server/config.ts`

API 서버 URL을 환경 변수에서 관리합니다.

```typescript
import { env } from '$env/dynamic/private';

export const API_SERVERS = {
  business: env.API_BUSINESS_URL || 'http://localhost:3000',
  auth: env.API_AUTH_URL || 'http://localhost:3502/api/v1',
  centers: env.API_CENTERS_URL || 'http://localhost:9000/api'
};
```

**환경 변수 (.env)**:
```bash
API_BUSINESS_URL=http://192.168.1.8:3000
API_AUTH_URL=http://192.168.1.8:3502/api/v1
API_CENTERS_URL=http://192.168.1.207:9000/api
```

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

### 3. `hooks.server.ts`

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

### 4. `+layout.server.ts` (protected)

보호된 라우트에서 인증 가드 역할을 합니다.

```typescript
export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, `/login?redirectTo=${url.pathname}`);
  }
  return { user: locals.user };
};
```

### 5. 클라이언트 인증 스토어

```typescript
// $lib/stores/auth.ts
export const auth = createAuthStore();

// 사용법
auth.login(user);      // 로그인 상태 설정
auth.logout();         // 로그아웃 (서버 API 호출 + 상태 초기화)
auth.initialize(user); // 서버에서 받은 user로 초기화
```

---

## API 프록시 라우팅

클라이언트 요청이 실제 API 서버로 라우팅되는 규칙:

| 클라이언트 요청 | 라우팅 대상 |
|----------------|-------------|
| `/api/proxy/auth/*` | `API_AUTH_URL/auth/*` |
| `/api/proxy/centers/*` | `API_CENTERS_URL/api/centers/*` |
| `/api/proxy/pre-design/*` | `API_CENTERS_URL/api/pre-design/*` |
| `/api/proxy/*` (기타) | `API_BUSINESS_URL/api/*` |

---

## 쿠키 설정

| 쿠키 | 용도 | 만료 | 옵션 |
|------|------|------|------|
| `accessToken` | API 인증 | 24시간 | httpOnly, secure*, sameSite=strict |
| `refreshToken` | 토큰 갱신 | 7일 | httpOnly, secure*, sameSite=strict |

> *secure는 HTTPS 환경에서만 활성화

---

## 보안 고려사항

### 적용된 보안 조치

1. **HTTP-Only 쿠키**: XSS 공격으로부터 토큰 보호
2. **SameSite=strict**: CSRF 공격 방지
3. **서버 프록시**: 토큰이 클라이언트 코드에 노출되지 않음
4. **자동 토큰 갱신**: 사용자 경험 저하 없이 세션 유지

### 개발 환경 (DEV only)

개발 편의를 위해 mock 로그인이 존재하나, **프로덕션 빌드에서는 제외**됩니다:

```typescript
if (import.meta.env.DEV) {
  // mock 로그인 로직 (개발 환경에서만 실행)
}
```

---

## 역할(Role) 기반 접근 제어

| 역할 | 설명 |
|------|------|
| `counselor` | 상담사 (기본) |
| `manager` | 센터 관리자 |
| `super_admin` | 시스템 관리자 |

역할 정보는 JWT 토큰의 `role` 클레임에 포함되며, `locals.user.role`로 접근 가능합니다.

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

### API 요청이 실패하는 경우

1. 프록시 라우트 확인 (`/api/proxy/...`)
2. `config.ts`의 API_SERVERS URL 확인
3. 환경 변수 설정 확인 (`.env`)
