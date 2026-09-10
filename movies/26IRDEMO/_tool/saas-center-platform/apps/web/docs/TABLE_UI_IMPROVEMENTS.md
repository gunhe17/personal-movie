# 목록(테이블·카드) UI 개선 작업

> 검사·상담·청구·단가·구성원·내담자 목록 화면 전반의 일관성·정보량·UX 개선 작업 내역.
> 작업일: 2026-06-01

---

## 개요

각 도메인 목록 화면이 날짜 포맷·배지·빈값 표현·액션 위치 등에서 제각각이던 것을
하나의 패턴으로 통일하고, 데이터가 있는데 노출되지 않던 정보를 컬럼으로 추가했다.
공용 `Table` 컴포넌트와 각 도메인 테이블/카드에 일괄 반영했다.

대부분 프론트 작업이며, 일부 항목은 목록 응답에 필드가 없어 백엔드(스키마·핸들러)를 함께 수정했다.
DB 스키마 변경은 없어 마이그레이션은 불필요하다.

---

## 1. 날짜 포맷 통일

모든 목록의 날짜를 **2줄(날짜 / 요일·시간)** 형식으로 통일했다.

- 상단: `YYYY-MM-DD` (진한 회색)
- 하단: `(목) HH:mm` (연한 회색, KST 변환)

`formatUtcToKst`로 UTC→KST 변환하며, 요일(`(d)`)을 포함한다. 셀에서 문자열을 split하던
방식 대신 ViewModel에 `dateLabel`/`timeLabel`을 분리 저장하는 방식으로 정리했다.

**적용 대상**

| 화면 | 컬럼 | 비고 |
| --- | --- | --- |
| 검사 현황 | 검사 일정 | D-day 포함 (아래 2번) |
| 상담 현황 | 다음 상담일 | D-day·상태 포함 (아래 2번) |
| 청구 내역 | 생성일 | |
| 단가 관리 | 생성일·수정일 | 생성일은 본 작업에서 2줄로 보정 |
| 구성원 | 등록일·초대일·만료일 | 등록일은 백엔드 `created_at` 추가 |
| 내담자 | 등록일 | |

**관련 파일**: `lib/utils/date.ts`(formatUtcToKst), 각 도메인 `view-model.ts`,
`AssessmentCaseTable.svelte`, `CounselingStatusTable.svelte`, `ClientListTable.svelte`,
`billing/+page.svelte`, `billing/price-list/+page.svelte`, `member/+page.svelte`

---

## 2. 상태/일정 배지 통일

상태성 표현을 pill 배지 + solid 아이콘 + 의미별 색으로 통일했다.

**상담 다음 상담일** — 구조화된 상태(`NextSessionInfo`)로 분기:

- `upcoming`/`overdue`: 날짜 + 시간 + D-day 배지
  - D-Day=빨강(`semantic-negative`), 예정=파랑(`primary-500`), 지남=회색
  - overdue는 "지난 일정" 빨강 배지 동반
- `unprocessed`(미처리): 삼각 경고 아이콘 + 빨강 배지 + 툴팁
- `needs_review`(연장·종결 확인): 원형 느낌표 아이콘 + 주황(amber) 배지 + 툴팁
- `completed`(상담 완료): 원형 체크 solid 아이콘 + 파랑(primary) 배지

**검사 일정** — 날짜/시간 + D-day(상담과 동일 색 규칙). 백엔드가 주는 `scheduled_start` 활용.

아이콘은 프로젝트 자산(`TriangleAlertSolidIcon`, `SemacticNoticeBang16`,
`CircleCheckSolidIcon`)으로 통일하여 인라인 SVG 산재를 제거했다.

**관련 파일**: `features/counseling/status/view-model.ts`(NextSessionInfo·computeNextSession),
`lib/types/assessmentStatus.ts`, `CounselingStatusTable.svelte`, `AssessmentCaseTable.svelte`,
카드 컴포넌트들

---

## 3. "외 N건/명" 툴팁

목록 셀에서 대표 1개만 보이고 나머지를 "외 N개"로 접던 항목에, 호버 시 전체를 보여주는
툴팁을 통일 적용했다.

- 상담: 내담자/상담사 다중 → 전체 명단 툴팁 (기존 패턴)
- 검사: 검사명 "외 N건" → 전체 검사명 툴팁 (신규)
- 내담자: 바우처 "외 N개" → 전체 바우처(잔여/총) 툴팁 (신규)

**관련 파일**: `AssessmentCaseTable.svelte`, `ClientListTable.svelte`,
`lib/components/common/Tooltip.svelte`

---

## 4. 진행률 표시 통일

진행률을 바 + 명시적 숫자 라벨로 통일했다.

- 상담: `완료 N · 예약 N / 총 N` (예약 회기 `scheduled_sessions` 강조)
- 검사: `완료 N / 총 N` (검사는 예약 개념 없음)

공용 `ProgressBar`는 그대로 두고 `showLabel={false}` 후 셀에서 커스텀 라벨을 렌더하여
다른 화면 영향 없이 적용.

**관련 파일**: `CounselingStatusTable.svelte`, `AssessmentCaseTable.svelte`,
`CounselingCard.svelte`, `AssessmentCaseCard.svelte`

---

## 5. 청구 컬럼

상담·검사 목록에 청구 상태 컬럼을 추가했다.

- 표시: 미청구 시 청구서 아이콘(`BillsIconCurrent20`) + "청구 필요"(mint 색, 청구하기 버튼과 동일),
  미청구 없으면 회색 `–`
- 색·아이콘을 청구 도메인 시그니처(mint)에 맞춰 다른 경고색과 구분되게 톤다운

**검사 청구(백엔드 추가)**: 검사 목록 응답에 청구 정보가 없어
`AssessmentCaseListItem`에 `has_uninvoiced_sessions` 추가, `list_cases.py`에서
`BillableFacade`로 미청구 계산(상담과 동일 패턴, `related_type=assessment_*`).
일정 없는 검사는 세션이 없어 케이스 단위 청구 대상이므로, 케이스 청구 미확인 시 미청구로 판정.

**관련 파일**: `application/schemas.py`, `application/handlers/assessment/list_cases.py`,
`lib/types/assessmentStatus.ts`, `CounselingStatusTable.svelte`, `AssessmentCaseTable.svelte`, 카드들

---

## 6. 내담자 바우처 컬럼 (백엔드 조합)

내담자 목록에 보유 바우처 요약을 추가했다.

- 표시: 가장 활성인 바우처명 + 잔여회기, 2개 이상이면 "외 N개" 툴팁
- "가장 활성" 기준: 유효기간 내 우선 → 잔여회기 많은 순

목록 응답에 바우처가 없어, `list_clients.py`의 cross-module enrich 패턴(`_enrich_next_sessions`와
동일 구조)으로 `_enrich_vouchers`를 추가. `ClientVoucherFacade`로 센터 바우처를 한 번에 조회 후
`client_id`로 그룹화(N+1 회피). next_session 정렬 경로는 페이징 후 enrich로 최소화.
바우처명은 `catalog.name`에서 가져온다.

**관련 파일**: `client/profile/schemas.py`(ClientVoucherBrief),
`client/profile/handlers/list_clients.py`, `lib/hooks/actions/client.action.ts`,
`features/clients/view-model.ts`, `ClientListTable.svelte`, `ClientCard.svelte`

---

## 7. 구성원 등록일·고용형태·필터

- **등록일 컬럼**(백엔드 추가): 목록 응답에 없어 `MemberListSummary`에 `created_at` 추가
  (모델 BaseModel 상속, facade·application 핸들러 양쪽에서 전달). 2줄 날짜 포맷.
- **고용형태 컬럼**: `employment_type` 코드를 `MEMBER_EMPLOYMENT_TYPE_MAP`으로 라벨화
  (정규직/계약직/프리랜서). 구성원 탭·수락대기 탭 모두.
- **고용형태 필터**: 역할 필터와 동일 구조로 추가(클라이언트 필터, 백엔드 무수정).
  URL 동기화(`?employment=`), 초기화 버튼·페이지 리셋 연동. 수락대기 탭에도 적용.

**관련 파일**: `center/member/schemas.py`, `center/facade/member_facade.py`,
`application/handlers/member/list_members.py`, `features/members/`(constants·filters·hooks·view-model·index),
`member/+page.svelte`, `MemberCard.svelte`

---

## 8. 결과 전송 → 케밥 액션

검사 현황의 "결과 전송" 전용 컬럼을 제거(주석 처리)하고 행 케밥 메뉴 액션으로 이동했다.

- **완료된 검사(`completed`)에서만** 노출 (기존엔 상태 무관 전 행에 버튼 노출되어 오해 소지)
- 이미 전송 시 `sentResultIds` 기준으로 "결과 재전송" 라벨, 베타 숨김 플래그 존중

**관련 파일**: `AssessmentCaseTable.svelte`

---

## 9. 구성원 삭제 케밥 (리스트)

카드에만 있던 멤버 삭제를 리스트에도 케밥 메뉴로 추가했다.

- `canDeleteMember` 권한이 있을 때만 케밥 컬럼 노출(`$derived` 조건부 컬럼, 카드와 동일 기준)
- 삭제 흐름은 카드와 동일(`membersService.openDeleteConfirm`)

**관련 파일**: `member/+page.svelte`

---

## 10. 빈값/메모 표현 + truncate

- 메모 빈값을 회색 "메모가 없습니다"로 통일(테이블·카드), 단순 데이터 미입력은 `–`
- 메모 셀 truncate 수정: `<Typography tag="span" className="truncate">`는 inline span이라
  말줄임이 동작하지 않던 것을 `block w-full truncate`로 보정 (구성원·내담자 메모 셀)

**관련 파일**: `member/+page.svelte`, `ClientListTable.svelte`, `MemberCard.svelte`,
`ClientCard.svelte`, `billing/price-list/+page.svelte`

---

## 11. 노데이터 영역 통일

구성원 페이지 등에서 다른 화면과 다르게(테두리 박스 안) 노출되던 빈 상태를
공용 `NoDataSection` + 중앙 정렬(`flex-center xl:h-full py-12`) 패턴으로 통일.

**관련 파일**: `member/+page.svelte`

---

## 12. 사이드바 하이라이트 버그 수정

서브메뉴 활성 판정이 단순 `startsWith`라, 형제 메뉴의 prefix가 되는 경로(예: 청구 내역 `/billing`이
단가 관리 `/billing/price-list`의 prefix)에서 둘 다 하이라이트되던 문제를 수정.

- `isActive(path, siblings)`로 형제 목록을 받아, 더 구체적으로 매칭되는 형제가 있으면
  짧은 prefix는 정확 일치(`===`)만 활성으로 인정
- 동일 버그가 있던 스케줄 메뉴(`/schedule` vs `/schedule/field-notes`)도 함께 해결

**관련 파일**: `common/components/layout/UnifiedSidebar.svelte`

---

## 13. 테이블 스크롤 인지 (공용 Table)

테이블에 가려진 추가 행이 있음을 사용자가 인지하지 못하던 문제를, 공용 `Table`에
"아래로 더 보기" 화살표로 해결.

- `canScrollDown`(scrollTop + clientHeight < scrollHeight) 추적
- 더 볼 게 있을 때만 하단 중앙에 떠다니는 ↓ 화살표(은은한 bounce) + fade gradient 노출,
  끝까지 내리면 사라짐
- 화살표 클릭 시 80%만큼 부드럽게 스크롤
- scroll·데이터 변경·ResizeObserver(반응형)로 재계산

**관련 파일**: `lib/components/Table.svelte`, `src/app.css`(`bounce-soft` keyframe·토큰)

---

## 백엔드 변경 요약

프론트 표시를 위해 목록 응답에 필드를 추가한 항목(모두 응답 스키마/조합 추가, DB 변경 없음):

- 검사 목록: `has_uninvoiced_sessions` (청구)
- 내담자 목록: `voucher_primary` / `voucher_count` / `vouchers` (바우처)
- 구성원 목록: `created_at` (등록일)
- 검사 목록: `scheduled_start` 등은 기존 응답 활용 (무수정)

마이그레이션 불필요.
