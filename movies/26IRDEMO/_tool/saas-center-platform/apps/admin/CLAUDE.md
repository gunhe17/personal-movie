# CLAUDE.md

admin 폴더 외부 파일을 수정할 경우 수정하지말고 확인을 먼저 하고 알려줘.

api의 수정이 필요하다면 admin route 이외의 부분은 기본적으로 수정하지 말고 수정이 필수적이라면 수정하지 말고 알려줘.

## Plan 작성 시 참조 문서 (필수)

plan 모드 진입 시 `apps/admin/docs/platform-admin.md` 문서를 우선 참조할 것. 이 문서에 백엔드 모듈 구조, API 설계, 프론트엔드 구조, 인증/인가, Phase별 구현 우선순위가 정의되어 있음.

## 백엔드 API 아키텍처 (필수)

**신규 API 추가 또는 기존 코드 리팩토링 시 반드시 참조:**
`apps/admin/docs/API_ARCHITECTURE.md`

핵심 구조: `Router → Handler → Service → Repository → DB`
- Handler: `uow.repo()` → Service 호출 + `audit.log` + `uow.commit`
- Service: 조회 → 권한 검증 → 비즈니스 로직 (도메인 예외만, HTTPException 금지)
- Repository: 순수 쿼리만 (비즈니스 로직 금지, Boolean은 `.is_(True)/.is_(False)`)
- 표준 패턴 참고 모듈: `cs_memo` (repository + services + handlers 모두 갖춤)

## 감사 로그 (Audit Log) 체크리스트 (필수)

> 설계 상세: `apps/admin/docs/audit-log/plan.md`

**백엔드에 새 변경 행위(POST/PATCH/DELETE) Handler를 추가할 때 반드시 확인:**

- [ ] Router에 `audit: AuditLogger = Depends(get_audit_logger)` 주입했는가?
- [ ] Handler 파라미터에 `audit: AuditLogger` 추가했는가?
- [ ] `async with uow:` 블록 내, `uow.commit()` 직전에 `await audit.log(...)` 호출했는가?
- [ ] `action` 값이 `{target_type}.{행위}` 형식인가? (예: `center_application.approved`)
- [ ] `summary`가 사람이 읽을 수 있는 한국어 문장인가? (예: `"센터 신청 승인"`)
- [ ] `apps/admin/docs/audit-log/plan.md`의 기록 대상 행위 목록에 추가했는가?

**예외 (로그 불필요):**
- GET 요청 (조회만)
- 로그인/로그아웃 (`auth.*`) — `current_admin` 없는 시점이므로 별도 직접 기록 방식 사용

---

상담센터 SaaS 플랫폼 - 관리자(어드민) 대시보드. 센터 관리, 사용자 관리, 시스템 설정.

## Tech Stack

- **Frontend**: SvelteKit 5 + TypeScript + TailwindCSS 4
- **State**: TanStack Query v5 (svelte-query) + Svelte 5 Runes
- **HTTP**: Axios with interceptors + SvelteKit 서버 프록시
- **Auth**: JWT (HTTP-only cookies), admin 전용 토큰

## Commands

```bash
pnpm dev             # 개발 서버 (0.0.0.0:3504)
pnpm build           # 프로덕션 빌드
pnpm check           # Svelte 타입 체크
```

---

## 프로젝트 구조

```
src/
├── app.d.ts                  # AdminUser 타입, App.Locals 정의
├── app.css                   # 디자인 시스템 (색상, 타이포, 유틸)
├── hooks.server.ts           # 서버 훅 (토큰 검증/갱신, locals 설정)
├── lib/
│   ├── components/           # 공통 컴포넌트
│   │   ├── AdminSidebar.svelte
│   │   ├── Snackbar.svelte
│   │   └── Typography.svelte
│   ├── hooks/
│   │   ├── actions/          # API action 함수 (endpoint 정의)
│   │   │   ├── center.action.ts
│   │   │   └── user.action.ts
│   │   └── queries/
│   │       └── builder.ts    # queryBuilder / mutationBuilder
│   ├── server/               # 서버 전용 (auth, config)
│   │   ├── auth.ts           # JWT 디코드, 토큰 갱신
│   │   └── config.ts         # API_URL, 쿠키 설정
│   ├── services/api/
│   │   ├── instances.ts      # Axios 인스턴스 + HTTP 메서드
│   │   └── interceptors.ts   # 401 → 로그아웃 처리
│   ├── stores/
│   │   ├── auth.ts           # 인증 상태 스토어
│   │   ├── sidebar.svelte.ts # 사이드바 접힘 상태
│   │   └── snackbar.ts       # 토스트 알림
│   ├── types/
│   │   └── apiResponse.ts    # ApiResponse, Action, Pagination 타입
│   └── utils/
│       └── errorHandler.ts   # 에러 메시지 추출 + 스낵바 표시
└── routes/
    ├── +layout.svelte        # QueryClientProvider 래핑
    ├── login/                # 로그인 페이지 (public)
    ├── api/
    │   ├── auth/             # 로그인/로그아웃 API
    │   └── proxy/[...path]/  # 백엔드 프록시 (토큰 주입)
    └── (protected)/          # 인증 필요 라우트
        ├── dashboard/
        ├── centers/
        ├── users/
        └── settings/
```

---

## Feature 모듈 아키텍처 (3단 레이어)

> **핵심 원칙**: 단순한 건 단순하게. 복잡해지면 그때 분리.

### 레이어 구조

```
기본 (단순 CRUD):
  페이지 (+page.svelte) → queryBuilder/mutationBuilder 직접 사용 → Action (*.action.ts)

복잡한 경우:
  페이지 (+page.svelte) → 서비스 ({name}-service.ts) → Action (*.action.ts)
```

### 분리 기준

| 기준 | 페이지에서 직접 | 서비스로 분리 |
| ---- | -------------- | ------------- |
| API 호출 | 1~2개 queryBuilder | 3개 이상 또는 연쇄 호출 |
| 후처리 | mutationBuilder의 successMessage로 충분 | invalidate 여러 개 + 토스트 + 모달 조합 |
| 데이터 변환 | 3줄 이하 인라인 | 변환 로직이 복잡하거나 재사용 |
| 상태 관리 | `$state` 몇 개 | 필터/URL동기화/디바운스 등 복합 상태 |

### Feature 디렉터리

```
src/lib/features/{domain}/
├── constants.ts          # 상수, 타입
├── {name}-service.ts     # 복잡한 로직 있을 때만 (invalidate + 토스트 + 모달)
├── hooks.svelte.ts       # (옵션) 필터/URL동기화 필요시만
└── components/           # (옵션) 도메인 전용 컴포넌트
```

### 파일 생성 규칙

- **무조건 만들지 않는다** — 필요할 때만 생성
- 파일 하나가 200줄 넘으면 분리 검토
- ViewModel 변환이 3줄 이하면 페이지에서 인라인
- hooks.svelte.ts는 URL 동기화나 복합 필터가 필요할 때만

### 서비스 패턴 (필요시)

```typescript
import type { QueryClient } from '@tanstack/svelte-query'

export interface CentersDeps {
  queryClient: QueryClient
}

export function createCentersService(deps: CentersDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['getCenterList'], exact: false })

  const changeStatus = async (centerId: string, isActive: boolean) => {
    await patchCenterStatus().request({ centerId, is_active: isActive })
    snackbarStore.success('상태가 변경되었습니다.')
    invalidateList()
  }

  return { changeStatus, invalidateList }
}
```

---

## Core Patterns

### Query/Mutation 빌더

```typescript
// 조회 - queryBuilder 사용
const list = $derived(
  queryBuilder(getCenterList, () => buildQueryInput(filters))
)

// 생성/수정/삭제 - mutationBuilder 사용
const mutation = mutationBuilder(patchCenterStatus, ['getCenterList'], [], {
  successMessage: '상태가 변경되었습니다.'
})
```

### Action 패턴

```typescript
// Action = { key, request } 구조
export const getCenterList = (): Action<CenterListResponse, CenterListResponse> => ({
  key: ['getCenterList'],
  request: async (params?: { skip?: number; limit?: number }) => {
    return get<CenterListResponse>('/admin/centers', params)
  }
})
```

### Svelte 5 Runes

```typescript
let value = $state('')           // 반응형 상태
let computed = $derived(expr)    // 계산된 값
$effect(() => { ... })           // 사이드 이펙트
let { prop }: Props = $props()   // props
```

### Error Handling

- 모든 에러는 Snackbar(toast)로 표시
- `showErrorSnackbar()` / `showSuccessSnackbar()` 유틸 사용
- mutationBuilder에서 자동 에러/성공 메시지 처리

---

## Authentication

- JWT (access/refresh token) in HTTP-only cookies
- 쿠키명: `admin_accessToken`, `admin_refreshToken`
- 역할: `admin` (관리자 전용)
- `(protected)` 라우트 그룹으로 인증 강제
- 프록시에서 401 시 자동 토큰 갱신 → 실패 시 interceptor에서 로그아웃

### 인증 흐름

```
브라우저 → Axios(/api/proxy/...) → SvelteKit 프록시(토큰 주입) → 백엔드 API
                                     ↓ 401 시
                                   토큰 갱신 시도 → 재요청 or 401 반환
                                                      ↓
                                              interceptor → 로그아웃 → /login
```

---

## API 호출 규칙

```typescript
// GOOD - 프록시 경유 (instances.ts의 get/post/patch/deleteResource 사용)
import { get, post } from '$services/api/instances'
const data = await get<CenterListResponse>('/admin/centers', params)

// BAD - 외부 서버 직접 호출
const data = await fetch('http://localhost:3502/api/v1/admin/centers')
```

---

## Path Aliases

| Alias         | 경로                       |
| ------------- | -------------------------- |
| `$stores`     | `src/lib/stores/`          |
| `$utils`      | `src/lib/utils/`           |
| `$types`      | `src/lib/types/`           |
| `$services`   | `src/lib/services/`        |
| `$components` | `src/lib/components/`      |
| `$hooks`      | `src/lib/hooks/`           |
| `$root`       | `src/`                     |

---

## Key Files

| 용도           | 파일                                |
| -------------- | ----------------------------------- |
| API 빌더       | `src/lib/hooks/queries/builder.ts`  |
| Axios 설정     | `src/lib/services/api/instances.ts` |
| 인터셉터       | `src/lib/services/api/interceptors.ts` |
| 에러 처리      | `src/lib/utils/errorHandler.ts`     |
| 스낵바 스토어  | `src/lib/stores/snackbar.ts`        |
| 인증 스토어    | `src/lib/stores/auth.ts`            |
| 서버 인증      | `src/lib/server/auth.ts`            |
| 프록시 라우트  | `src/routes/api/proxy/[...path]/+server.ts` |

---

## 디자인 스타일 가이드

### 목록 페이지 레이아웃

```
┌─────────────────────────────────────────────┐
│ PageHeader (title + description · 총 N개)   │  ← PageHeader 컴포넌트
│                              [액션 버튼]    │
├─────────────────────────────────────────────┤
│ [🔍 검색] [Select 필터] [↻ 초기화]          │  ← 필터 바
├─────────────────────────────────────────────┤
│ Table                                       │  ← section-border 래핑
├─────────────────────────────────────────────┤
│ Pagination                                  │
└─────────────────────────────────────────────┘
```

### 필터 바 규칙

- 컨테이너: `flex shrink-0 flex-wrap items-center gap-2 mb-4`
- 검색 입력: `SearchIcon` + `<input>` 을 `w-75 h-11 rounded-lg border border-gray-200 bg-white px-4` 박스로 감싸기
- 필터 셀렉트: `Select` 컴포넌트 사용 (`h-11 bg-white rounded-lg`, `showActiveHighlight={true}`, `defaultValue` 지정)
- 초기화 버튼: `RefreshIcon` + `h-11 w-11 rounded-lg border border-gray-200 bg-white`
- `resetFilters()` 함수 필수 (search, debouncedSearch, 필터 상태, currentPage 초기화 + `url.reset()`)

### 상세 보기 방식 (모달 vs 디테일 페이지)

| 기준 | 모달 (Modal) | 디테일 페이지 (Route) |
| ---- | ------------ | --------------------- |
| 표시 정보량 | 필드 5~8개 이하, 단순 조회 | 필드 10개 이상, 섹션이 여러 개 |
| 수정 기능 | 없거나 단순 상태 변경 (잠금/해제 등) | 인라인 수정 폼 (보기↔수정 모드 전환) |
| 예시 | 계정 상세, 접수 상세 | 센터 상세, 검사 상세 |
| 라우팅 | 없음 (modalStore.open) | `/resource/[id]` |

**규칙:**
- 모달: `BaseModal` 사용, size `sm`~`lg`, 읽기 전용 `<dl>` + 하단 액션 버튼
- 디테일 페이지: `← 목록` 뒤로가기 + 섹션별 `section-border p-6` 카드, 보기/수정 모드 토글

### 테이블 규칙

- `Table` + `TableColumn` 컴포넌트 사용
- 커스텀 렌더링은 `{#snippet}` 으로 정의 후 `render` 속성에 전달
- 상태 뱃지: `rounded-full px-2.5 py-1 text-xs font-medium` + 색상별 bg/text 클래스
- 코드 뱃지: `rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600`
- 행 클릭: `onRowClick` + `hoverEnabled`

### 폼 입력 스타일

- input: `w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500`
- select: `w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-500`
- label: `block text-sm font-medium text-gray-700 mb-1.5`
- 필수 표시: `<span class="text-red-500">*</span>`
- 그리드: `grid grid-cols-1 gap-4 md:grid-cols-2`

### 공통 UI 패턴

- 로딩: `section-border flex items-center justify-center py-16` + Typography "불러오는 중..."
- 빈 상태: `section-border py-16` + `NoDataSection`
- 성공/에러 메시지: `snackbarStore.success()` / `snackbarStore.error()` 또는 mutationBuilder의 `successMessage`
- 버튼: `Button` 컴포넌트 (`size="md"`, `color="primary"` / `"light"`)

---

## Git Commits

> **한글로 작성 (필수)**

| Prefix     | 용도           | 예시                           |
| ---------- | -------------- | ------------------------------ |
| `feat:`    | 새 기능 추가   | `feat: 센터 목록 페이지 구현`  |
| `modify:`  | 기존 기능 수정 | `modify: 사용자 필터 로직 개선` |
| `fix:`     | 버그 수정      | `fix: 로그인 리다이렉트 오류`  |
| `style:`   | 스타일 변경    | `style: 사이드바 디자인 수정`  |
| `publish:` | 배포           | `publish: v1.0.0 배포`         |
