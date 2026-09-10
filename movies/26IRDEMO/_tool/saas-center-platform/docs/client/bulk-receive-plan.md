# Plan: 단체 검사 접수 - 엑셀 일괄 등록 개선

> 작성일: 2026-03-19
> 최종 업데이트: 2026-03-19
> 관련 기능: 검사 접수 (`/assessment/receive`) 단체 모드

---

## 배경

A초등학교 10명처럼 단체로 검사를 접수할 때 하나씩 등록하기 불편하다는 피드백.
엑셀 업로드를 통한 일괄 처리 기능을 복원·개선하는 작업.

---

## 최종 구현 플로우

```
단체 탭 선택 (Switch 컴포넌트)
  → 엑셀 업로드 버튼 클릭
  → ExcelUploadModal (파일 선택/드래그)
  → parseExcelFile() - XLSX 파싱
  → excelUploadStore에 저장 + receiveFormStore에 폼 상태 저장
  → ExcelPreviewOverlay (fixed inset-0 오버레이, z-200)
      → ExcelClientListConfirm (행 단위 편집 + 중복 경고 표시)
      → 진입 시 duplicate-check API 1회 호출
      → 🔴 높음 / 🟡 낮음 배지 + 호버 툴팁 (기존 내담자 정보)
      → 등록하기 클릭
          → 중복 있으면 확인 모달 → 확인
          → POST /clients/bulk-from-excel (즉시 등록, 로딩 스피너)
          → 등록 완료 → onDone 콜백 → 오버레이 닫힘
  → groupMembers 복원 (excelUploadStore → hooks.loadGroupMembersFromExcel)
  → 기관/단체 섹션에서 기관 검색/선택 또는 신규 등록
  → 검사/담당자 선택
  → 접수 버튼 → createBatchAssessmentCase() API
```

---

## 이슈 1: 기존 내담자 중복 경고 ✅ 완료

### 중복 판단 기준

| 레벨 | 조건 | 표시 | 등록 결과 |
|------|------|------|-----------|
| 높음 (high) | 이름 + 생년월일 + 보호자 연락처(또는 생년월일) 일치 | 🔴 높음 | 등록 제외, 기존 내담자로 처리 |
| 낮음 (low) | 이름 + 생년월일 일치 (보호자 정보 불일치 또는 없음) | 🟡 낮음 | 등록 제외, 기존 내담자로 처리 |
| 없음 | 불일치 또는 생년월일 없는 경우 | - | 신규 등록 |

> bulk-from-excel API에서 실제 중복 판단은 이름+생년월일 기준으로 처리됨 (`skipped: true`).
> high/low는 사전 경고 목적.

### 중복 체크 API

```
POST /centers/{center_id}/clients/duplicate-check

Request:
{
  "clients": [
    { "name": "홍길동", "birth_date": "2015-03-15", "guardian_phone": "010-1234-5678" },
    { "name": "김철수", "birth_date": "2010-07-22", "guardian_phone": null }
  ]
}

Response:
{
  "results": [
    {
      "index": 0,
      "duplicate_level": "high",
      "matched_client": { "name": "홍길동", "birth_date": "...", "phone": "...", "created_at": "..." }
    },
    { "index": 1, "duplicate_level": "none", "matched_client": null }
  ]
}
```

- 1번 쿼리로 N명 체크 (PostgreSQL 튜플 IN 절)
- `birth_date` 없는 행은 체크 제외

### 확인 모달 문구 (중복 있을 때)

```
제목: 중복 가능성이 있는 내담자가 있어요

이름·생년월일·보호자 정보가 같은 내담자 N명,
이름·생년월일이 같은 내담자 N명은
기존 내담자로 처리되어 신규 등록에서 제외됩니다.
계속 진행할까요?
```

---

## 이슈 2: 기관 선택/생성 UI ✅ 완료

### 구현 방식 (B안 채택: 폼 드롭다운)

- 기관 검색 드롭다운 (`OrganizationSearchDropdown`) 컴포넌트
  - `ClientMultiSelect`와 동일한 portal 기반 드롭다운 방식
  - 기존 기관 검색 → 선택
  - 없으면 "새 기관 등록" → `OrganizationRegisterModal` 모달
- `ReceiveFormPanel` 내 내담자 섹션 **아래**에 독립된 "기관/단체" 섹션으로 배치
- `clientType` 변경 시 `groupMembers` + `selectedOrganization` 초기화

### OrganizationRegisterModal

- `BaseModal` (size="fit"), 본문 `w-120`
- 기관명 + 연락처 grid col-2
- 주소: 카카오 주소 검색 버튼 + 상세주소 입력
- 푸터: 확인 버튼 1개 (취소 없음)

### 기관 address JSONB → 문자열 변환

백엔드 `Institution.address`는 JSONB (`{zip_code, address, detail}`).
`InstitutionFacade.get_summary()`에서 평탄화하여 문자열로 저장:

```python
# apps/api/app/modules/institution/facade/institution_facade.py
addr = institution.address
if isinstance(addr, dict):
    parts = [addr.get("zip_code"), addr.get("address"), addr.get("detail")]
    address_str = " ".join(p for p in parts if p) or None
```

---

## 이슈 3: 내담자 bulk 등록 시점 ✅ 완료 (B안 채택)

### 구현 방식

- 프리뷰 "등록하기" 클릭 시 즉시 `POST /clients/bulk-from-excel` 호출
- 보호자 정보 있는 행: 보호자 + 자녀 + 관계 자동 생성
- 이름+생년월일 중복 행: 기존 내담자 반환 (`skipped: true`)
- 등록 완료 → store의 임시 id를 실제 DB id로 교체 → 오버레이 닫힘
- 로딩 중 스피너 표시 + 버튼 비활성화

### 엑셀 프리뷰: 별도 라우트 → 오버레이 전환

기존 `/excel-preview` 라우트 방식에서 `ExcelPreviewOverlay` 컴포넌트(`fixed inset-0 z-200`)로 전환.
- `history.back()` 루프 문제 해결
- 페이지 이동 없이 동일 페이지 위에 오버레이

---

## 엑셀 템플릿 컬럼 (최종)

| # | 컬럼 | 필수 | 비고 |
|---|------|------|------|
| 0 | 이름 | ✅ | |
| 1 | 성별 | ✅ | 남/여 |
| 2 | 생년월일 | ✅ | YYYY-MM-DD |
| 3 | 보호자 이름 | - | 있으면 관계/연락처도 필수 |
| 4 | 관계 | 조건부 | 보호자 있을 때 필수 |
| 5 | 보호자 연락처 | 조건부 | 보호자 있을 때 필수 |
| 6 | 보호자 성별 | 조건부 | 보호자 있을 때 필수 |
| 7 | 보호자 생년월일 | 조건부 | 보호자 있을 때 필수 |

> `상태` 컬럼 제거됨 (중복은 API가 자동 판단)

---

## 구현 완료 체크리스트

### 백엔드

- [x] `POST /clients/duplicate-check` — 엑셀 프리뷰용 중복 체크 API
- [x] `POST /clients/bulk-from-excel` — 엑셀 일괄 등록 전용 API (보호자/관계 자동 생성)
- [x] `InstitutionFacade.get_summary()` — address JSONB → 문자열 평탄화 버그 수정

### 프론트엔드

- [x] `ExcelPreviewOverlay` 컴포넌트 (오버레이, `/excel-preview` 라우트 대체)
- [x] `ExcelClientListConfirm` — 반응형 개선 (fr 기반 그리드, truncate)
- [x] `ExcelClientListConfirm` — 중복 배지 + 호버 툴팁 (기존 내담자 정보)
- [x] `ExcelClientListConfirm` — 툴팁 문구 실제 로직 기준으로 수정
- [x] `ExcelClientListConfirm` — 등록하기 버튼 로딩 스피너 (`isRegistering` prop)
- [x] `OrganizationSearchDropdown` — portal 기반 드롭다운 (ClientMultiSelect 패턴)
- [x] `OrganizationRegisterModal` — 카카오 주소 검색 포함 기관 등록 모달
- [x] `ReceiveFormPanel` — "기관/단체" 섹션 분리 (내담자 섹션 아래 독립 배치)
- [x] `hooks.svelte.ts` — `clientType` 변경 시 groupMembers + selectedOrganization 초기화
- [x] `hooks.svelte.ts` — `loadGroupMembersFromExcel()` 함수 추가
- [x] `receive-service.ts` — `saveExcelAndNavigate()` → onReady 콜백 방식으로 변경

---

## 관련 API 정리

```
# 내담자
POST /centers/{id}/clients/duplicate-check   # 엑셀 프리뷰용 중복 체크
POST /centers/{id}/clients/bulk-from-excel   # 엑셀 일괄 등록 전용

# 기관
GET  /centers/{id}/institutions?keyword=...  # 기관 검색
POST /centers/{id}/institutions              # 기관 신규 생성

# 검사 접수
POST /centers/{id}/assessment-cases/individual  # 개인 접수
POST /centers/{id}/assessment-cases/batch       # 단체 접수 (institution_id 필수)
```
