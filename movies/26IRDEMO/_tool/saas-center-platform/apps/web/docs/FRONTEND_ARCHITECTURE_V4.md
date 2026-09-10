# 프런트엔드 아키텍처 V4 (Svelte 5 Runes, Feature 모듈 고정)

## 목표

- Svelte 5 runes 기반으로 페이지를 “조합/렌더”만 하도록 단순화.
- Feature 디렉터리 내에 필수 4종(필터·쿼리빌더·서비스핸들러·ViewModel)을 고정해 이식성을 높임.
- 쿼리/뮤테이션, 모달, 토스트, invalidate를 서비스핸들러에 캡슐화하여 페이지는 호출만 수행.

## 주요 변화(V3 → V4)

- Svelte 5 runes 사용: `$state`, `$derived`, `$effect`로 지역 상태와 파생값 관리.
- 서비스+핸들러 표준화: 모달 열기/확정, invalidate, 토스트까지 한 곳에 포함.
- QueryBuilder 강제 사용: `queryBuilder(action, keyId?, options?)`로 키/옵션 일관화.
- 필터 규약: `filters.ts`에서 URL ↔ 모델 ↔ API 변환을 통합, runes 훅(`hooks.svelte.ts`)으로 URL 동기화.
- Feature 디렉터리 스캐폴드 고정: `constants.ts`, `filters.ts`, `query-builders.ts`, `view-model.ts`, `manage-service.ts`, `(옵션) hooks.svelte.ts`.

## 레이어 (5단)

1. 페이지(+page.svelte): 훅 초기화 → 쿼리/서비스 주입 → 파생 상태 → 렌더/이벤트 연결만 수행.
2. 훅(옵션, runes): 상태 복잡·디바운스·URL 동기화가 필요할 때만 `hooks.svelte.ts`로 분리.
3. 서비스+핸들러: 쿼리/뮤테이션 호출, invalidate, 토스트, 모달 오픈/확정 로직을 캡슐화.
4. ViewModel: API → UI 포맷(라벨/색상/이미지 등) 변환.
5. API 액션: endpoint/쿼리스트링/HTTP 호출만 담당(순수).

## 디렉터리 스캐폴드 예시 (assessment/manage)

```
src/lib/features/assessment/manage/
├── constants.ts          # 상수/타입
├── filters.ts            # URL ↔ 필터 모델 ↔ API 변환
├── query-builders.ts     # 액션 입력 빌더/폼 데이터 타입
├── view-model.ts         # 표현 전용 변환기
├── manage-service.ts     # 서비스+핸들러(모달/토스트/invalidates)
└── hooks.svelte.ts       # (옵션) runes 훅: 상태, 디바운스, URL sync
```

## 페이지 패턴(+page.svelte) — `assessment/manage`

- **초기화**: pathname, `useManageFilters(page.url, pathname)`, `useTabIndicator()`, `useQueryClient()`, `createManageService(...)`.
- **쿼리 선언**: `queryBuilder(getAssessments, () => buildAssessmentsQueryInput(filters.buildFilters()))`, 동일 패턴으로 summary/packages 쿼리 선언.
- **파생 상태**: `$derived`로 로딩/에러/데이터, `map…ToVM`으로 UI 전용 모델 구성.
- **이벤트 연결**: 모달/삭제 핸들러는 서비스에서 받아와 `onclick={handleOpen...}` 식으로 전달, 페이지는 비즈니스 세부를 알지 않음.

## 서비스+핸들러 규칙 (`manage-service.ts`)

- API 액션 호출, invalidate, 토스트/모달을 한 함수 안에 묶어 페이지는 함수만 호출.
- invalidate 키는 액션 키와 맞추고 `exact: false`로 프리픽스 무효화 허용.
- 모달: `modalStore.open({ component, props: { onConfirm }, options })` 패턴 고정, onConfirm 내부에서 API 호출+토스트+invalidate 수행.
- 생성/수정/삭제의 낙관 vs 비관은 도메인 정책에 맞게 서비스에서 결정.

## 쿼리/뮤테이션 빌더 가이드 (`$lib/hooks/queries/builder.ts`)

- `queryBuilder`는 `action().key`를 필수로 사용하고, keyId를 함수로 주면 반응형 키를 자동 생성.
- 기본 옵션: `placeholderData: keepPreviousData`, `throwOnError: true`, `refetchOnMount/reconnect: false`, `staleTime: 0`.
- `mutationBuilder`는 `action.key` 배열과 추가 `useInvalidate`/`extraInvalidate`를 모두 invalidate, 성공/에러 토스트 옵션 지원.

## 필터/쿼리 빌더 (`filters.ts`, `query-builders.ts`)

- URL 파싱/쓰기: 공통 필터(`common/filters`)를 확장해 pagination/search와 도메인 필터를 모두 다룸.
- API 변환: `toAssessmentsQueryParams`에서 status/sort/online 등을 API 스키마에 매핑.
- 쿼리 입력 빌더: `buildAssessmentsQueryInput(filters)`, `buildPackageListInput(centerId)` 등 액션 입력을 한 곳에 정의.

## ViewModel (`view-model.ts`)

- API 스키마를 UI 표현 전용 모델로 변환. 색상/배경 이미지는 매퍼를 통해 주입해 UI/도메인 분리 유지.
- 페이지는 VM만 렌더, 표현 변경 시 VM만 수정.

## 훅 (`hooks.svelte.ts`)

- runes 기반 상태 + URL 동기화: `$state`로 상태, `$effect`로 디바운스/URL 업데이트.
- 디바운스 패턴: 검색어 변경 → 타임아웃 → `debouncedSearchQuery` 업데이트 → 페이지 1로 리셋.
- 탭 인디케이터 훅: DOM 참조를 runes로 보관, active 탭의 위치/폭을 계산해 스타일 제공.

## Lite 모드

- 상태/핸들러가 단순하면 `hooks.svelte.ts`를 생략 가능하나, `filters`, `query-builders`, `view-model`, `service`는 유지(계약/표현/비즈니스 분리).

## 관찰성/에러/계약

- 에러 UX: 서비스단에서 코드별 분기(401/403/422/409/5xx) 처리/토스트/리다이렉트 정책 적용.
- 계약: API I/O는 액션 레벨에서 스키마 검증(zod/valibot 권장), 페이지/서비스는 신뢰된 타입 사용.
- 로그/트레이스: route/user/entity ID, 낙관 실패/롤백 이벤트를 Sentry/로그에 포함.

## 캐시·낙관 가이드

- 키 규칙: 액션 `key`와 invalidate 키를 동일하게 사용, prefix 무효화 허용 시 `exact: false`.
- 낙관 시 snapshot 보관 후 오류 시 롤백, 토스트는 서비스에서 처리.

## 테스트 체크리스트

- 필터: URL ↔ 모델 ↔ API 파라미터 변환.
- ViewModel: 표현 필드/색상/이미지 매핑.
- 서비스핸들러: 모달 onConfirm에서 API 호출, invalidate 호출 여부, 토스트 노출.
- 쿼리/뮤테이션: key 생성, invalidate 대상, 에러 핸들링.
