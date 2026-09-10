# 프런트엔드 아키텍처 (검사 관리 페이지 적용 사례)

## 목표

- 팀 협업 시 중복 구현·재작업을 줄이고, 변경(필터/정렬/표현/계약) 파급 범위를 최소화한다.
- 단방향 데이터 흐름(UI → ViewModel → Service → Action → Fetch)을 유지해 책임을 분리한다.
- 계약(URL/파라미터/스키마), 표현(ViewModel), 캐싱/무효화/낙관적 업데이트를 표준화한다.

## 레이어 개요

1. **페이지 컨테이너** (`routes/**/+page.svelte`)

   - URL/로컬 상태 관리, 어떤 서비스/뷰모델을 사용할지 결정.
   - 네트워크/비즈니스 로직 없음.

2. **프리젠테이션 컴포넌트** (`lib/components/**`)

   - UI 렌더 전담. ViewModel만 props로 소비.

3. **ViewModel 계층** (`lib/features/assessment/manage/view-model.ts`)

   - API 응답 → UI 친화적 데이터(라벨/색상/배경 등) 변환.
   - 테이블/그리드/카드가 동일 ViewModel을 재사용해 중복 계산 제거.

4. **서비스/빌더 계층** (`lib/features/assessment/manage/service.ts`, `filters.ts`)

   - 필터 ↔ URL ↔ API 파라미터 매핑.
   - 쿼리/뮤테이션 입력 빌더, 공통 뮤테이션 설정(무효화, 메시지, 낙관적 업데이트).

5. **API 액션** (`lib/hooks/actions/*.ts`)
   - 실제 endpoint/쿼리스트링/HTTP 호출. 비즈니스·표현 로직 없음.

## 핵심 파일 책임

- `filters.ts`: URL → 내부 필터 모델 → API 파라미터 변환 (검색/활성/온라인/정렬/페이지).
- `service.ts`: 쿼리 입력 빌더, 패키지 CRUD 요청 빌더, 뮤테이션 설정(`packageMutationConfig`: 무효화 키, 메시지, 낙관적 업데이트/롤백).
- `view-model.ts`: Assessment/Package 응답을 카드·그리드용 ViewModel로 변환.
- `builder.ts` (공통): `queryBuilder`, `mutationBuilder`; mutation은 `onMutate/onError/onSettled` 지원으로 낙관적 업데이트/롤백 주입 가능.
- `+page.svelte`: centerId 상수화, 빌더/VM 소비, UI 이벤트 처리만 담당.

## 데이터 흐름 예시 (패키지 조회)

UI 이벤트/초기 진입  
→ `buildPackageListInput(centerId)` (service)  
→ `queryBuilder(getPackageListByCenterId, input)` (builder)  
→ API 액션이 fetch 실행  
→ 응답을 `mapPackagesToVM`으로 변환 (view-model)  
→ 프리젠테이션 컴포넌트가 ViewModel 렌더.

## 변경 시 이점

- **필터 추가/정렬 변경**: `filters.ts`만 수정하면 URL·API·쿼리 빌더가 일관 동작.
- **표현 변경(라벨/색상/배경)**: `view-model.ts`만 수정, UI·서비스·API 불변.
- **계약 변경(파라미터/응답 스키마)**: `service.ts`/`actions`에서 국소 수정.
- **캐싱/무효화/낙관적 업데이트**: `packageMutationConfig` 등 설정으로 표준화, 페이지마다 반복 로직 제거.

## 낙관적 업데이트/롤백 (예: 패키지 삭제)

- `packageMutationConfig.delete.optimistic`에서 onMutate/onError 정의:
  - onMutate: 캐시 `['packages']`에서 항목 제거 후 이전 스냅샷 저장.
  - onError: 실패 시 스냅샷으로 복원.
- 페이지에서는 mutationBuilder 옵션에 이 설정을 주입만 하면 됨.

## 단방향 의존 원칙

UI(페이지/컴포넌트) → ViewModel → Service/Filters → API Action → Fetch  
부수효과(네트워크/캐시 조작)는 Service/Action/Builder에서만 수행, UI는 데이터 소비와 이벤트 전달에 집중.

## 확장 가이드

- 다른 도메인/페이지(`assessment/status` 등)에도 동일한 5층을 적용:
  - filters: URL↔모델↔API 파라미터
  - service: 쿼리/뮤테이션 빌더, 무효화/낙관적 업데이트 설정
  - view-model: UI 표현 변환
  - action: HTTP 호출
  - page: 상태/이벤트만
- ViewModel을 소비하는 공용 리스트/그리드/카드 컴포넌트로 중복 방지.

## 검증 체크리스트

- 필터 추가/정렬 변경 시 페이지 수정 없이 동작하는가? (filters/service만 수정)
- API 응답 구조 변경 시 ViewModel/Service만 수정해 UI가 그대로 동작하는가?
- 낙관적 업데이트 실패 시 캐시 롤백이 정상 동작하는가?
- 무효화 키가 도메인별로 일관되게 정의되었는가?
