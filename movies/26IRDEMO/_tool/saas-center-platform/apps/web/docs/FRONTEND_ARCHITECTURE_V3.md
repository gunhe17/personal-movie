# 프런트엔드 아키텍처 V3 (서비스+핸들러 통합, ViewModel 유지)

## 목표

- 책임 분리를 유지하되 서비스+핸들러 통합으로 페이지는 “호출만” 하게 단순화.
- ViewModel로 표현 로직을 캡슐화해 페이지가 도메인 세부를 몰라도 렌더 가능.
- Lite 모드 허용: 단순 페이지는 훅/핸들러를 페이지에 둘 수 있지만 filters/service-handlers/view-model은 유지.

## 레이어 (5층)

1. 페이지(+page.svelte): 조합/렌더만.
2. 훅(옵션): 상태·디바운스·URL 동기화가 복잡할 때만 분리.
3. 서비스+핸들러: 쿼리/뮤테이션 빌더, 낙관/비관, invalidate, 토스트, 모달 핸들러 포함.
4. ViewModel: API → UI 데이터 변환(라벨/색상/포매팅).
5. API 액션: endpoint/쿼리스트링/HTTP 호출만 담당(순수).

## 적용 디렉토리 (assessment/manage)

```
src/lib/features/assessment/manage/
├── constants.ts
├── filters.ts
├── service-handlers.ts   # 서비스 + 핸들러 통합
├── view-model.ts
└── (옵션) hooks.svelte.ts
```

## 서비스+핸들러 설계 (정책/표준)

- API 액션은 기존 hooks/actions/\*.ts 호출(순수 HTTP 유지).
- 낙관/비관 선택: create/update는 기본 비관, delete는 도메인/UX에 따라 선택.
- invalidate 키: 실제 쿼리 키와 일치(예: `['getPackages']`).
- 캐시 shape: PaginationRes 등 setQueryData 시 타입 명시.
- 토스트/에러: 서비스-핸들러가 처리, 페이지는 호출만.
- 모달: 초기값 주입, onConfirm에서 API+invalidate까지 캡슐화.

### 서비스 핸들러 스니펫

```ts
export function createManageService({ centerId, queryClient }) {
  const invalidatePackages = () =>
    queryClient.invalidateQueries({ queryKey: ['getPackages'], exact: false })

  const fetchPackages = () =>
    getPackageListByCenterId().request(buildPackageListInput(centerId))

  const createPackage = (data) =>
    actionCreatePackage().request(makeCreatePackageRequest(centerId, data))

  const deletePackage = async (id) => {
    await actionDeletePackage().request(makeDeletePackageRequest(centerId, id))
    invalidatePackages()
  }

  const openCreatePackageModal = () =>
    modalStore.open({
      component: PackageSettingModal,
      props: {
        onConfirm: async (data) => {
          await createPackage(data)
          snackbarStore.success('검사 세트가 추가되었어요!')
          invalidatePackages()
        }
      },
      options: { customWidth: 620, customHeight: 680 }
    })

  return { fetchPackages, createPackage, deletePackage, openCreatePackageModal }
}
```

## ViewModel 유지 이유

- 표현(라벨/색/포매팅) 변경 시 ViewModel만 수정하면 UI·서비스·API를 건드리지 않음.
- 페이지는 도메인 세부를 몰라도 ViewModel만 렌더.

## Lite 모드 가이드

- 상태 변수 < 10, 핸들러 < 5, 필터 단순 → hooks.svelte.ts 생략 가능.
- 그래도 filters/service-handlers/view-model은 유지(계약/표현 분리).

## 계약/검증·에러/관찰성

- 계약: OpenAPI/JSON Schema 소스 → zod/valibot으로 I/O parse.
- 에러 UX: 401/403(재인증/리다이렉트), 422(필드 매핑), 409(경합), 5xx(재시도/알림) 정책 명시.
- 관찰성: Sentry/로그 태그에 route/user/entity ID, 낙관 실패/롤백 이벤트 로깅.

## 캐시/낙관 안전 가이드

- 키 규칙: 액션 key와 invalidate/setQueryData 키 일치.
- shape: `QueryClient.setQueryData<YourType>(['getPackages'], next)`.
- create/update 비관, delete는 선택(낙관 시 스냅샷 복원 필수).

## 테스트 체크리스트

- filters 변환(URL ↔ 모델 ↔ API 파라미터)
- view-model 변환/포매팅
- service-handlers: invalidate 호출, 낙관 롤백 동작
- 에러 UX: 코드별 처리(401/403/422/409/5xx)

## 페이지 적용 요약

1. constants/filters/view-model 작성
2. service-handlers: 쿼리/뮤테이션/모달/토스트/invalidates 캡슐화
3. +page.svelte: service-handlers 함수 호출 + ViewModel 렌더
4. 필요 시 hooks.svelte.ts로 상태/디바운스/URL 동기화 분리(Lite면 생략)
