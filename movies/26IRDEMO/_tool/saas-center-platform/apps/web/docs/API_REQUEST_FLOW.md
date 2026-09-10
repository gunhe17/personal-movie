# API 요청 흐름 (클라이언트 ↔ SvelteKit ↔ 백엔드)

> HTTP-Only 쿠키 환경에서 API URL이 "두 번" 보이는 이유와 요청 흐름 정리

## 개요

클라이언트는 **SvelteKit 서버 라우트**만 호출합니다.  
서버 라우트가 실제 **백엔드 API URL**을 결정하고 토큰/권한 헤더를 붙입니다.

즉, URL이 두 번 설정되는 것처럼 보이지만 **역할이 분리**되어 있습니다.

- **클라이언트**: "내부 라우트"만 알고 요청
- **서버 라우트**: 실제 외부 API URL 매핑 + 인증 처리

---

## 왜 두 군데에서 URL을 보게 되나?

### 1) 클라이언트 액션/인스턴스

- 브라우저는 외부 API 주소를 몰라도 됨
- 모든 요청은 `/api/...`로 고정

예:

- `axios` 기본값: `/api/proxy`
- `getCenters`: `/api/proxy/centers`

### 2) 서버 라우트(+server.ts)

- 환경 변수로 실제 API 서버 주소를 관리
- 쿠키에서 토큰 추출 → Authorization 헤더 구성
- 401 시 토큰 갱신 시도

---

## 흐름도

### A. 범용 프록시 흐름 (`/api/proxy/...`)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  SvelteKit  │     │ /api/proxy  │     │ Backend API │
│  (Axios)    │     │   Server    │     │  /[...path] │     │   Server    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ GET /api/proxy/clients               │                   │
       │ (쿠키 자동 포함)  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │ 쿠키에서 토큰 추출│                   │
       │                   │ Authorization 추가│                   │
       │                   │ 서버 선택 + URL 조립                │
       │                   │──────────────────>│                   │
       │                   │                   │ GET /api/clients  │
       │                   │                   │──────────────────>│
       │                   │                   │<──────────────────│
       │<──────────────────│                   │                   │
       │ {data}            │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### B. 센터 API도 프록시 경유 (`/api/proxy/centers`)

센터 API도 범용 프록시에서 `centers` 경로로 라우팅됩니다.

---

## 라우팅 규칙 요약

| 클라이언트 요청 | 서버 라우트 | 실제 백엔드 |
|----------------|------------|-------------|
| `/api/proxy/*` | `routes/api/proxy/[...path]/+server.ts` | `API_BUSINESS_URL` / `API_AUTH_URL` / `API_CENTERS_URL` |

---

## 관련 파일

- 서버 URL 설정: `src/lib/server/config.ts`
- 범용 프록시: `src/routes/api/proxy/[...path]/+server.ts`
- 클라이언트 액션: `src/lib/hooks/actions/center.action.ts`
- Axios 인스턴스: `src/lib/services/api/instances.ts`
*** End Patch}כעsyntax code error caused by trailing characters in patch; expected newline before this token '*** End Patch}'; or ended with corrupted or non-terminated patch. The error was: 
