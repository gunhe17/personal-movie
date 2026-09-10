# 프런트엔드 아키텍처 V2 (검사 관리 페이지 적용 사례)

## 목표

- 팀 협업 시 중복 구현·재작업을 줄이고, 변경(필터/정렬/표현/계약) 파급 범위를 최소화한다.
- 단방향 데이터 흐름(UI → ViewModel → Service → Action → Fetch)을 유지해 책임을 분리한다.
- 계약(URL/파라미터/스키마), 표현(ViewModel), 캐싱/무효화/낙관적 업데이트를 표준화한다.
- **페이지 컴포넌트를 200줄 이하로 유지**하여 가독성과 유지보수성을 높인다.

## 레이어 개요 (6층 구조)

```
┌─────────────────────────────────────────────────────────────┐
│  1. 페이지 컨테이너 (+page.svelte)                           │
│     - 훅/핸들러 조합, 쿼리 구독, 템플릿 렌더링만 담당         │
│     - 비즈니스 로직 없음, 상태 관리 로직 없음                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. 훅 계층 (hooks.svelte.ts) 🆕                            │
│     - Svelte 5 runes 기반 상태 관리                         │
│     - 디바운스, URL 동기화, UI 상태 로직                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. 핸들러 계층 (handlers.ts) 🆕                            │
│     - 이벤트 핸들러 팩토리                                   │
│     - 모달 열기, CRUD 작업 등                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  4. ViewModel 계층 (view-model.ts)                          │
│     - API 응답 → UI 친화적 데이터 변환                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  5. 서비스/빌더 계층 (service.ts, filters.ts)               │
│     - 필터 ↔ URL ↔ API 파라미터 매핑                        │
│     - 쿼리/뮤테이션 빌더, 무효화/낙관적 업데이트 설정         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  6. API 액션 (actions/*.ts)                                 │
│     - endpoint/HTTP 호출만 담당                              │
└─────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
src/lib/features/assessment/manage/
├── constants.ts      # 타입, 상수, 옵션 배열
├── hooks.svelte.ts   # Svelte 5 runes 기반 커스텀 훅
├── handlers.ts       # 이벤트 핸들러 팩토리
├── view-model.ts     # API → UI 데이터 변환
├── filters.ts        # URL ↔ 필터 ↔ API 파라미터 변환
└── service.ts        # 쿼리/뮤테이션 빌더, 설정
```

## 핵심 파일 책임

### constants.ts
```typescript
// 타입 정의
export type TabType = 'enabled' | 'disabled'

// 상수
export const CENTER_ID = 'gangnam_center'
export const DEFAULT_PAGE_SIZE = 12
export const SEARCH_DEBOUNCE_DELAY = 500

// 옵션 배열
export const onlineFilterOptions = [
  { value: 'offline', title: '온라인/센터 방문' },
  { value: 'online', title: '온라인' }
]

export const sortOptions = [
  { value: 'oldest', title: '오래된 순' },
  { value: 'newest', title: '최신 순' }
]

// 모달 사이즈 설정
export const MODAL_SIZES = {
  assessmentToggle: { customWidth: 560, customHeight: 560 },
  packageSetting: { customWidth: 620, customHeight: 680 },
  // ...
}
```

### hooks.svelte.ts
```typescript
/**
 * 필터 상태 관리 훅
 * - URL 파싱으로 초기값 설정
 * - 디바운스된 검색어 관리
 * - URL 동기화
 */
export function useManageFilters(initialUrl: URL, pathname: string) {
  // 상태 정의
  let currentPage = $state(initialFilters.page)
  let searchQuery = $state(initialFilters.search)
  let debouncedSearchQuery = $state(initialFilters.search)
  // ...

  // 디바운스 $effect
  $effect(() => {
    // 검색어 디바운싱 로직
  })

  // URL 동기화 $effect
  $effect(() => {
    // 필터 변경 시 URL 업데이트
  })

  return {
    // getter/setter
    get currentPage() { return currentPage },
    set currentPage(value) { currentPage = value },
    // 메서드
    buildFilters,
    resetFilters,
    changeTab
  }
}

/**
 * 탭 인디케이터 애니메이션 훅
 */
export function useTabIndicator() {
  let tabsContainer = $state(null)
  let indicatorStyle = $state({ left: 0, width: 0 })

  function updateIndicator(activeTab) { /* ... */ }

  return { tabsContainer, tabRefs, indicatorStyle, updateIndicator }
}
```

### handlers.ts
```typescript
interface HandlerDependencies {
  centerId: string
  getPackages: () => PackageType[]
  mutations: { create, update, delete }
  modals: { AssessmentToggleModal, PackageSettingModal, AssessmentRequestModal }
}

/**
 * 모달 핸들러 생성 (팩토리 패턴)
 */
export function createModalHandlers(deps: HandlerDependencies) {
  function openAssessmentToggleModal() { /* ... */ }
  function openPackageSettingModal() { /* ... */ }
  function openAssessmentRequestModal() { /* ... */ }
  function openEditPackageModal(packageId: string) { /* ... */ }
  function deletePackage(packageId: string) { /* ... */ }

  return {
    openAssessmentToggleModal,
    openPackageSettingModal,
    openAssessmentRequestModal,
    openEditPackageModal,
    deletePackage
  }
}
```

### view-model.ts
```typescript
// API 응답 → UI 데이터 변환
export function mapAssessmentToVM(item: Assessment): AssessmentVM {
  return {
    id: item.uid,
    titleKo: item.kor_name,
    titleEn: item.eng_name,
    // ...
  }
}

export function mapAssessmentsToVM(list: Assessment[]): AssessmentVM[] {
  return list.map(mapAssessmentToVM)
}
```

### filters.ts
```typescript
// URL → 내부 필터 모델
export function parseFiltersFromUrl(url: URL): ManageFilters { /* ... */ }

// 내부 필터 모델 → URL
export function toSearchParams(filters: ManageFilters): URLSearchParams { /* ... */ }

// 내부 필터 모델 → API 파라미터
export function toAssessmentsQueryParams(filters: ManageFilters): GetAssessmentsQueryParams { /* ... */ }
```

### service.ts
```typescript
// 쿼리 입력 빌더
export function buildAssessmentsQueryInput(filters: ManageFilters) { /* ... */ }
export function buildPackageListInput(centerId: string) { /* ... */ }

// 뮤테이션 설정 (무효화, 메시지, 낙관적 업데이트)
export const packageMutationConfig = {
  create: { invalidate: ['packages'], options: { successMessage: '...' } },
  update: { invalidate: ['packages'], options: { successMessage: '...' } },
  delete: { invalidate: ['packages'], optimistic: { onMutate, onError } }
}
```

## 페이지 컴포넌트 구조

```svelte
<script lang="ts">
  // 1. 컴포넌트 import
  import Pagination from '$lib/components/Pagination.svelte'
  // ...

  // 2. Feature 모듈 import
  import { CENTER_ID, onlineFilterOptions, sortOptions } from './constants'
  import { useManageFilters, useTabIndicator } from './hooks.svelte'
  import { createModalHandlers } from './handlers'
  import { mapAssessmentsToVM, mapPackagesToVM } from './view-model'
  import { buildAssessmentsQueryInput, packageMutationConfig } from './service'

  // 3. 훅 초기화
  const filters = useManageFilters(page.url, page.url.pathname)
  const tabIndicator = useTabIndicator()

  // 4. 쿼리 설정
  const assessmentsQuery = queryBuilder(getAssessments, () =>
    buildAssessmentsQueryInput(filters.buildFilters())
  )

  // 5. Mutations
  const createPackageMutation = mutationBuilder(createPackage, packageMutationConfig.create.invalidate, ...)

  // 6. 핸들러 초기화
  const modalHandlers = createModalHandlers({
    centerId: CENTER_ID,
    getPackages: () => packages,
    mutations: { create, update, delete },
    modals: { AssessmentToggleModal, PackageSettingModal, AssessmentRequestModal }
  })

  // 7. Derived states
  const packages = $derived.by(() => packagesData?.data ?? [])
  const packagesVM = $derived.by(() => mapPackagesToVM(packages))

  // 8. 최소한의 $effect (UI 관련만)
  $effect(() => {
    if (filters.mounted) {
      tabIndicator.updateIndicator(filters.activeTab)
    }
  })
</script>

<!-- 9. 템플릿: 훅/핸들러 사용만 -->
<div>
  <input bind:value={filters.searchQuery} />
  <button onclick={modalHandlers.openPackageSettingModal}>세트 추가</button>
  <!-- ... -->
</div>
```

## 데이터 흐름 예시

### 검색어 입력 → API 호출
```
1. 사용자 입력
   → filters.searchQuery 변경 (bind:value)

2. 디바운스 처리 (hooks.svelte.ts)
   → 500ms 후 debouncedSearchQuery 업데이트

3. URL 동기화 (hooks.svelte.ts)
   → goto() 호출하여 URL 쿼리 파라미터 업데이트

4. 쿼리 재실행 (+page.svelte)
   → buildAssessmentsQueryInput(filters.buildFilters()) 반응형 실행

5. API 호출 (builder.ts → actions)
   → getAssessments 실행

6. 데이터 변환 (view-model.ts)
   → mapAssessmentsToVM()

7. UI 렌더링
```

### 패키지 삭제 (낙관적 업데이트)
```
1. 버튼 클릭
   → modalHandlers.deletePackage(packageId)

2. 낙관적 업데이트 (service.ts onMutate)
   → 캐시에서 즉시 항목 제거

3. API 호출
   → deletePackage mutation 실행

4. 성공 시: 캐시 무효화
   실패 시: 롤백 (onError)
```

## 변경 시 이점

| 변경 유형 | 수정 파일 | 영향 범위 |
|-----------|-----------|-----------|
| 필터 추가/정렬 변경 | `filters.ts`, `constants.ts` | 서비스 계층만 |
| 표현 변경(라벨/색상) | `view-model.ts` | ViewModel만 |
| 상태 로직 변경 | `hooks.svelte.ts` | 훅만 |
| 이벤트 핸들러 변경 | `handlers.ts` | 핸들러만 |
| API 계약 변경 | `service.ts`, `actions/` | 서비스/액션만 |
| UI 레이아웃 변경 | `+page.svelte` | 템플릿만 |

## 코드량 비교

| 항목 | V1 (기존) | V2 (개선) | 감소율 |
|------|-----------|-----------|--------|
| +page.svelte 전체 | 641줄 | 354줄 | -45% |
| Script 블록 | ~400줄 | ~150줄 | -62% |
| 상태 변수 정의 | ~50줄 | ~10줄 | -80% |
| 이벤트 핸들러 | ~130줄 | ~5줄 | -96% |

## 확장 가이드

### 새 페이지에 패턴 적용하기

1. **constants.ts 생성**
   - 타입 정의
   - 상수 값
   - 옵션 배열

2. **filters.ts 생성** (필터가 있는 경우)
   - URL ↔ 내부 모델 ↔ API 파라미터 변환

3. **hooks.svelte.ts 생성**
   - 상태 로직
   - 디바운스
   - URL 동기화

4. **handlers.ts 생성**
   - 모달 핸들러
   - CRUD 핸들러

5. **view-model.ts 생성**
   - API → UI 데이터 변환

6. **service.ts 생성**
   - 쿼리/뮤테이션 빌더
   - 무효화/낙관적 업데이트 설정

7. **+page.svelte 작성**
   - 훅/핸들러 조합
   - 쿼리 구독
   - 템플릿 렌더링

## 검증 체크리스트

- [ ] 페이지 컴포넌트가 200줄 이하인가?
- [ ] Script 블록에 비즈니스 로직이 없는가?
- [ ] 상태 관리 로직이 hooks.svelte.ts에 있는가?
- [ ] 이벤트 핸들러가 handlers.ts에 있는가?
- [ ] API 응답 변환이 view-model.ts에 있는가?
- [ ] 필터 변환이 filters.ts에 있는가?
- [ ] 뮤테이션 설정이 service.ts에 있는가?
- [ ] 상수/옵션이 constants.ts에 있는가?

## V1 → V2 마이그레이션

기존 페이지를 V2 패턴으로 마이그레이션하는 순서:

1. **constants.ts**: 타입, 상수, 옵션 배열 추출
2. **hooks.svelte.ts**: 상태 변수, $effect 로직 추출
3. **handlers.ts**: 이벤트 핸들러 추출
4. **+page.svelte**: 훅/핸들러 import 및 조합

예시:
```typescript
// Before (in +page.svelte)
let searchQuery = $state('')
let debouncedSearchQuery = $state('')
$effect(() => { /* 디바운스 로직 */ })

// After (in hooks.svelte.ts)
export function useManageFilters(initialUrl, pathname) {
  let searchQuery = $state(...)
  let debouncedSearchQuery = $state(...)
  $effect(() => { /* 디바운스 로직 */ })
  return { get searchQuery() {...}, set searchQuery(v) {...}, ... }
}

// After (in +page.svelte)
const filters = useManageFilters(page.url, pathname)
// 템플릿에서: bind:value={filters.searchQuery}
```
