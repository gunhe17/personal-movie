# CLAUDE.md

web 폴더 외부 파일을 수정할 경우 수정하지말고 확인을 먼저 하고 알려줘.

심리상담 센터 SaaS 플랫폼 - 내담자 관리, 심리검사, 예약 시스템

## Tech Stack

- **Frontend**: SvelteKit 5 + TypeScript + TailwindCSS 4
- **State**: TanStack Query v5 (svelte-query) + Svelte 5 Runes
- **HTTP**: Axios with JWT interceptors
- **Testing**: Vitest + Playwright

## Commands

```bash
npm run dev          # 개발 서버 (0.0.0.0:5173)
npm run build        # 프로덕션 빌드
npm run check        # Svelte 타입 체크
npm run format       # Prettier 포맷팅
npm run test:unit    # Vitest 단위 테스트
```

---

## 📐 Feature 모듈 아키텍처 (V4)

> **핵심 원칙**: 페이지는 "조합/렌더"만 수행. 비즈니스 로직은 Feature 모듈에 캡슐화.

### 레이어 구조 (5단)

```
1. 페이지 (+page.svelte)     → 훅 초기화 + 쿼리/서비스 주입 + 렌더/이벤트 연결만
2. 훅 (hooks.svelte.ts)      → 상태/디바운스/URL 동기화 (필요시만)
3. 서비스 (*-service.ts)     → 쿼리/뮤테이션 + invalidate + 토스트 + 모달 캡슐화
4. ViewModel (view-model.ts) → API → UI 포맷 변환 (라벨/색상/이미지 등)
5. API 액션 (*.action.ts)    → endpoint/HTTP 호출만 (순수)
```

### Feature 디렉터리 스캐폴드

```
src/lib/features/{domain}/{sub-domain}/
├── constants.ts          # 상수, 타입, 모달 사이즈 등
├── filters.ts            # URL ↔ 필터 모델 ↔ API 변환
├── query-builders.ts     # 쿼리/뮤테이션 입력 빌더, 폼 데이터 타입
├── view-model.ts         # API → UI 표현 전용 변환기
├── {name}-service.ts     # 서비스+핸들러 (모달/토스트/invalidate)
├── hooks.svelte.ts       # (옵션) runes 훅: 상태, 디바운스, URL sync
└── components/           # (옵션) 도메인 전용 컴포넌트
```

### 현재 도메인 구조

```
src/lib/features/
├── common/              # 공통 필터 유틸
├── assessment/          # 심리검사
│   ├── manage/          # 검사 관리
│   ├── status/          # 검사 현황
│   ├── status-detail/   # 검사 상세
│   ├── receive/         # 검사 접수
│   └── reservation/     # 검사 예약
├── counseling/          # 상담
│   └── status/          # 상담 현황
├── clients/             # 내담자 관리
├── members/             # 직원 관리
└── schedule/            # 일정
    ├── calendar/        # 캘린더
    ├── reservations/    # 예약 현황
    └── settings/        # 일정 설정
```

---

## 🆕 새 도메인 추가 가이드

### 필수 파일 생성 순서

1. **constants.ts** - 상수/타입 정의
2. **filters.ts** - URL ↔ 필터 변환 (common/filters 확장)
3. **query-builders.ts** - API 입력 빌더
4. **view-model.ts** - UI 표현 변환기
5. **{name}-service.ts** - 비즈니스 로직 캡슐화
6. **(옵션) hooks.svelte.ts** - 복잡한 상태/URL 동기화 필요시

### 각 파일 패턴

#### constants.ts

```typescript
// 모달 사이즈, 상태값, 매직넘버 등
export const MODAL_SIZES = {
  create: { size: 'md' as const },
  edit: { size: 'lg' as const }
}

export const STATUS_LABELS = {
  pending: '대기',
  completed: '완료'
} as const
```

#### filters.ts

```typescript
import { createFilterManager } from '$lib/features/common/filters'

export interface DomainFilters {
  page: number
  search: string
  status?: string
}

export function createDomainFilters(url: URL, pathname: string) {
  const manager = createFilterManager<DomainFilters>(url, pathname, {
    page: 1,
    search: ''
  })
  // URL ↔ 모델 ↔ API 변환 로직
  return manager
}
```

#### query-builders.ts

```typescript
import { getDomainList } from '$lib/hooks/actions/domain.action'

// 쿼리 입력 빌더
export function buildDomainListInput(centerId: string, filters: DomainFilters) {
  return {
    action: getDomainList,
    params: { centerId, ...filters }
  }
}

// 폼 데이터 타입
export interface DomainFormData {
  name: string
  description?: string
}
```

#### view-model.ts

```typescript
import type { DomainType } from '$lib/hooks/actions/domain.action'

export interface DomainVM {
  id: string
  name: string
  statusLabel: string
  statusColor: string
}

export function mapToDomainVM(item: DomainType): DomainVM {
  return {
    id: item.uid,
    name: item.name,
    statusLabel: STATUS_LABELS[item.status],
    statusColor: item.status === 'completed' ? 'green' : 'gray'
  }
}
```

#### {name}-service.ts

```typescript
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'

// centerId를 deps로 받지 않음 — 실행 시점에 requireCenterId()로 가져옴
export interface DomainDeps {
  queryClient: QueryClient
}

export function createDomainService(deps: DomainDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getDomainList'],
      exact: false
    })

  // CRUD + 모달 + 토스트 + invalidate 캡슐화
  const openCreateModal = () => {
    modalStore.open({
      component: DomainModal,
      props: {
        onConfirm: async (data: DomainFormData) => {
          // centerId는 이벤트 핸들러 실행 시점에 가져옴 (null 안전)
          await createDomain().request({
            centerId: requireCenterId(),
            payload: data
          })
          snackbarStore.success('생성되었습니다!')
          invalidateList()
        }
      },
      options: MODAL_SIZES.create
    })
  }

  return { openCreateModal, invalidateList }
}
```

---

## Core Patterns

### Query/Mutation 빌더

```typescript
// 조회 - queryBuilder 필수 사용
const list = $derived(
  queryBuilder(getDomainList, () => buildQueryInput(filters))
)

// 생성/수정/삭제 - mutationBuilder 또는 서비스에서 직접 호출
const mutation = mutationBuilder(postEntity, ['invalidateKey'], [], {
  successMessage: '성공 메시지',
  errorMessage: '실패 메시지'
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

- **모든 에러는 Snackbar(toast)로 표시** - inline validation 없음
- 서비스에서 `snackbarStore.error()` / `snackbarStore.success()` 호출
- 에러 코드별 분기: 401/403/422/409/5xx

### Modal Pattern

```typescript
// 서비스에서 모달 열기 + onConfirm에서 API 호출 + invalidate
modalStore.open({
  component: ModalComponent,
  props: { onConfirm: async (data) => { ... } },
  options: { size: 'md' }
})
```

---

## Key Files

| 용도          | 파일                                 |
| ------------- | ------------------------------------ |
| API 빌더      | `src/lib/hooks/queries/builder.ts`   |
| 공통 필터     | `src/lib/features/common/filters.ts` |
| Axios 설정    | `src/lib/services/api/instances.ts`  |
| 에러 처리     | `src/lib/utils/errorHandler.ts`      |
| 모달 스토어   | `src/lib/stores/modal.ts`            |
| 스낵바 스토어 | `src/lib/stores/snackbar.ts`         |
| 인증 스토어   | `src/lib/stores/auth.ts`             |

---

## Authentication & Roles

- JWT (access/refresh token) in HTTP-only cookies
- `(protected)` 라우트 그룹으로 인증 강제
- 토큰 만료 시 interceptor에서 자동 갱신

### 역할 (SaaS web의 사용 주체)

SaaS web은 **관리자와 상담사가 함께 사용**하는 멀티 역할 환경이다.

| 역할 | 코드값 | 주요 사용처 |
|------|--------|------------|
| 상담사 | `counselor` | 내담자·상담·검사 현장 업무. 모바일 앱과 동일 범위 + 데스크탑 작업 필요 영역 |
| 관리자 | `manager` | 센터 운영 (멤버, 결제/청구, 일정 설정, 대시보드 등) — **web 전용 영역** |
| 슈퍼관리자 | `super_admin` | 플랫폼 전역 관리 — **web 전용 영역** |

**판단 기준:**
- 같은 화면이라도 역할에 따라 노출 섹션·액션이 달라질 수 있다. 신규 기능 추가 시 어느 역할이 사용하는지 명확히 한 뒤 PermissionGuard·역할 분기를 적용한다.
- **모바일 앱은 counselor 전용**이다. 따라서 manager/super_admin 전용 화면(예: member, billing, dashboard)은 모바일과 비교하지 않는다.
- web의 counselor 시점이 모바일과 1:1 대응되는 기준이며, 두 앱의 일관성은 이 시점을 기준으로 맞춘다.

---

## Git Commits

> **한글로 작성 (필수)**

| Prefix     | 용도           | 예시                        |
| ---------- | -------------- | --------------------------- |
| `feat:`    | 새 기능 추가   | `feat: 검사 예약 기능 추가` |
| `modify:`  | 기존 기능 수정 | `modify: 필터 로직 개선`    |
| `fix:`     | 버그 수정      | `fix: 날짜 파싱 오류 수정`  |
| `style:`   | 스타일 변경    | `style: 버튼 색상 변경`     |
| `publish:` | 배포           | `publish: v1.2.0 배포`      |

---

## Quirks & Gotchas

- Select 컴포넌트: `{ value, label }[]` 또는 `string[]` 지원
- Modal size: `'sm' | 'md' | 'lg' | 'xl' | 'wide'`
- Input: native `<input>` + Tailwind 클래스 사용 (별도 컴포넌트 없음)
- 쿼리 키와 invalidate 키 일치시키기 (`exact: false`로 프리픽스 무효화)
- **`{@const}`는 블록 태그 안에서만 사용 가능** (`{#if}`, `{#each}`, `{#snippet}` 등). 일반 마크업이나 `<section>` 안에서 직접 사용 불가. 파생 값이 필요하면 `<script>`에서 `$derived`를 사용할 것.

---

## SSR / centerId 안전 가이드 (필수)

> SvelteKit은 SSR을 사용하므로, **서버에서 실행되는 코드**와 **클라이언트에서만 실행되는 코드**를 반드시 구분해야 한다.

### 1. centerId 사용 규칙

`centerStore`는 localStorage 기반이라 **SSR에서는 항상 null**이다. `centerStore.initialize()`는 `(protected)/+layout.svelte`의 `onMount`에서 실행되므로, 컴포넌트 초기화 시점에는 아직 값이 없다.

```typescript
// BAD - 컴포넌트 top-level에서 즉시 실행 → SSR에서 에러 또는 null 캡처
const service = createService({ centerId: requireCenterId() }) // SSR에서 throw
const service = createService({ centerId: $centerId! }) // null이 고정됨

// GOOD - 서비스에서 centerId를 캡처하지 않고, 실행 시점에 가져오기
// service 내부에서:
const id = requireCenterId() // 이벤트 핸들러 안에서 호출 (클라이언트 전용)

// GOOD - 쿼리에서는 반응형 $centerId 사용 (값 변경 시 자동 재실행)
const query = queryBuilder(getList, () => buildInput($centerId!))
```

**핵심 원칙:**

- **컴포넌트 top-level**: `$centerId` (반응형, null 허용) 사용. `requireCenterId()` 금지.
- **이벤트 핸들러/콜백 내부**: `requireCenterId()` 사용 가능 (클라이언트 전용이므로 안전).
- **서비스 팩토리 deps**: `centerId`를 받지 말고, 서비스 내부 함수에서 `requireCenterId()`로 실행 시점에 가져오기.
- **action.ts request 함수**: centerId가 null/빈값이면 빈 결과 반환 (`if (!params.centerId) return []`).

### 2. SSR vs Client 구분

```typescript
// onMount → 클라이언트에서만 실행 ✅
// onDestroy → SSR에서도 실행됨 ⚠️
// 컴포넌트 <script> top-level → SSR에서도 실행됨 ⚠️
// 이벤트 핸들러 (onclick 등) → 클라이언트에서만 실행 ✅

// BAD - onDestroy에서 브라우저 전용 API 직접 호출
onDestroy(() => {
  cancelAnimationFrame(rafId) // SSR에서 ReferenceError
})

// GOOD - browser 가드 필수
import { browser } from '$app/environment'
onDestroy(() => {
  if (browser) cancelAnimationFrame(rafId)
})
```

### 3. API 호출 패턴 (프록시)

모든 API는 SvelteKit 서버 프록시를 통해 호출한다. `fetch('/api/proxy/...')`를 사용하며, 프록시가 `API_URL/{path}`로 변환한다.

```typescript
// GOOD - 프록시 경유
const url = `/api/proxy/centers/${centerId}/center-assessments`
const response = await fetch(url)

// BAD - 외부 서버 직접 호출 (CORS, 인증 문제)
const url = `http://192.168.1.8:3502/api/v1/centers/${centerId}/center-assessments`
```

---

## 상세 문서

- 프론트엔드 모델 도식화 및 레이어: `docs/frontend-model-and-layers.md`
- 아키텍처 상세: `apps/web/docs/FRONTEND_ARCHITECTURE_V4.md`
- API 패턴: `apps/web/src/lib/hooks/queries/builder.ts` 주석
- 타입 정의: `apps/web/src/lib/types/` 디렉토리
