# 전문가(COUNSELOR) 역할 - UI 가시성 명세서

> COUNSELOR 역할로 로그인했을 때 조건부로 보이거나 숨겨져야 하는 모든 UI 요소 정리

---

## 1. COUNSELOR 권한 요약


| 구분               | 권한                                                                                                              | 비고               |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- |
| **access_level** | `own`                                                                                                           | 본인 데이터만 조회/수정 가능 |
| **read**         | schedule, client, counseling, counseling_note, assessment_case, send_link, document, form_instance, notice      | 9개               |
| **write**        | member(본인만), schedule, client, counseling, counseling_note, assessment_case, send_link, document, form_instance | 9개               |
| **delete**       | schedule, counseling, assessment_case, document                                                                 | 4개               |


### 보유하지 않는 권한 (관리자 전용)


| 권한                        | 용도               |
| ------------------------- | ---------------- |
| `write:center`            | 센터 정보 수정         |
| `write:program`           | 프로그램 관리          |
| `write:room`              | 상담실 관리           |
| `write:member_invitation` | 구성원 초대           |
| `delete:member`           | 구성원 삭제           |
| `write:center_assessment` | 센터 검사 카탈로그 관리    |
| `write:form_template`     | 양식 템플릿 관리        |
| `write:role`              | 역할/권한 설정         |
| `write:notice`            | 공지사항 작성          |
| `read:member_invitation`  | 초대 목록 조회         |
| `read:activity_log`       | 활동 로그 조회         |
| `*`                       | 와일드카드 (ADMIN 전용) |


---

## 2. 사이드바 메뉴 가시성


| 메뉴    | 필요 권한                          | COUNSELOR 표시 | 현재 상태               |
| ----- | ------------------------------ | ------------ | ------------------- |
| 대시보드  | `write:center`, `*`            | **숨김**       | HIDDEN_MENU_IDS로 숨김 |
| 스케줄   | `read:schedule`                | **표시**       | OK                  |
| 내담자   | `read:client`                  | **표시**       | OK                  |
| 상담    | `read:counseling`              | **표시**       | OK                  |
| 심리검사  | `read:assessment_case`         | **표시**       | OK                  |
| 청구/결제 | `write:center`, `*`            | **숨김**       | HIDDEN_MENU_IDS로 숨김 |
| 구성원   | `write:member_invitation`, `*` | **숨김**       | OK (수정 완료)          |
| 설정    | `write:center`, `*`            | **숨김**       | OK                  |
| 공지사항  | `read:notice`                  | **표시**       | OK                  |
| 내 정보  | 제한 없음                          | **표시**       | OK                  |


**설정 하위 메뉴** (상위 메뉴가 숨겨지므로 모두 접근 불가):


| 하위 메뉴   | 필요 권한                     | COUNSELOR |
| ------- | ------------------------- | --------- |
| 센터 정보   | `write:center`            | 숨김        |
| 검사 관리   | `write:center_assessment` | 숨김        |
| 프로그램 관리 | `write:program`           | 숨김        |
| 상담실 관리  | `write:room`              | 숨김        |
| 양식 관리   | `__hidden__`              | 숨김        |
| 권한 설정   | `write:role`              | 숨김        |


> **파일**: `apps/web/src/lib/config/sidebar-permissions.ts`

---

## 3. 화면별 UI 요소 가시성

### 3.1 스케줄 (`/schedule`)

#### 캘린더 (`/schedule/calendar`)


| UI 요소       | 권한                      | COUNSELOR | 가드 방식             | 파일:라인                                |
| ----------- | ----------------------- | --------- | ----------------- | ------------------------------------ |
| "일정 추가" 버튼  | `write:schedule`        | **표시**    | `PermissionGuard` | `schedule/calendar/+page.svelte:207` |
| 담당자 필터 드롭다운 | `accessLevel === 'all'` | **숨김**    | `{#if canUseManagerFilter}` | `schedule/calendar/+page.svelte:267` |


#### 예약 현황 (`/schedule/reservations`)


| UI 요소  | 권한              | COUNSELOR | 비고                  |
| ------ | --------------- | --------- | ------------------- |
| 전체 페이지 | `read:schedule` | **표시**    | 본인 예약만 조회됨 (API 필터) |


#### 일정 설정 (`/schedule/settings`)


| UI 요소  | 권한  | COUNSELOR | 비고             |
| ------ | --- | --------- | -------------- |
| 전체 페이지 | -   | **표시**    | API 레벨에서 권한 제어 |


---

### 3.2 내담자 (`/clients`)

#### 목록 (`/clients`)


| UI 요소       | 권한              | COUNSELOR | 가드 방식             | 파일:라인                      |
| ----------- | --------------- | --------- | ----------------- | -------------------------- |
| "내담자 추가" 버튼 | `write:client`  | **표시**    | `PermissionGuard` | `clients/+page.svelte:109` |
| 내담자 삭제 메뉴   | `delete:client` | **표시**    | `PermissionGuard` | `clients/+page.svelte:245` |


> COUNSELOR는 `write:client`, `delete:client` 모두 보유 → 버튼 표시됨. 단, `accessLevel=own`이므로 API에서 본인 담당 내담자만 반환.

#### 등록 (`/clients/register`)


| UI 요소   | 권한             | COUNSELOR | 가드 방식                | 파일:라인                               |
| ------- | -------------- | --------- | -------------------- | ----------------------------------- |
| 등록 폼 전체 | `write:client` | **표시**    | `PermissionGuard` 래핑 | `clients/register/+page.svelte:425` |


#### 상세 (`/clients/[clientId]`)


| UI 요소  | 권한            | COUNSELOR | 비고                 |
| ------ | ------------- | --------- | ------------------ |
| 전체 페이지 | `read:client` | **표시**    | 본인 담당만 접근 가능 (API) |


---

### 3.3 상담 (`/counseling`)

#### 상담 현황 (`/counseling/status`)


| UI 요소           | 권한                      | COUNSELOR | 가드 방식                       | 파일:라인                                |
| --------------- | ----------------------- | --------- | --------------------------- | ------------------------------------ |
| "상담 접수하기" 버튼    | `write:counseling`      | **표시**    | `PermissionGuard`           | `counseling/status/+page.svelte:232` |
| "상담 삭제" 버튼 (일괄) | `delete:counseling`     | **표시**    | `PermissionGuard`           | `counseling/status/+page.svelte:446` |
| **담당자 필터 드롭다운** | `accessLevel === 'all'` | **숨김**    | `{#if canUseManagerFilter}` | `counseling/status/+page.svelte:273` |


> 담당자 필터가 숨겨지므로 COUNSELOR는 본인 상담만 볼 수 있음.

#### 상담 접수 (`/counseling/receive`)


| UI 요소 | 권한  | COUNSELOR | 비고                              |
| ----- | --- | --------- | ------------------------------- |
| 접수 폼  | -   | **표시**    | `isCounselor` 플래그로 전문가 전용 필드 조정 |


---

### 3.4 심리검사 (`/assessment`)

#### 검사 메인 (`/assessment`)


| UI 요소      | 권한                      | COUNSELOR | 가드 방식             | 파일:라인                         |
| ---------- | ----------------------- | --------- | ----------------- | ----------------------------- |
| "검사 추가" 버튼 | `write:assessment_case` | **표시**    | `PermissionGuard` | `assessment/+page.svelte:124` |
| 문서 편집 버튼   | `write:document`        | **표시**    | `PermissionGuard` | `assessment/+page.svelte:208` |
| 문서 조회 버튼   | `read:document`         | **표시**    | `PermissionGuard` | `assessment/+page.svelte:254` |


#### 검사 현황 (`/assessment/status`)


| UI 요소           | 권한                       | COUNSELOR | 가드 방식                       | 파일:라인                                |
| --------------- | ------------------------ | --------- | --------------------------- | ------------------------------------ |
| "검사 삭제" 버튼 (일괄) | `delete:assessment_case` | **표시**    | `PermissionGuard`           | `assessment/status/+page.svelte:622` |
| **담당자 필터 드롭다운** | `accessLevel === 'all'`  | **숨김**    | `{#if canUseManagerFilter}` | `assessment/status/+page.svelte:420` |


#### 검사 이력 (`/assessment/status/history`)


| UI 요소      | 권한                       | COUNSELOR | 가드 방식             | 파일:라인                                        |
| ---------- | ------------------------ | --------- | ----------------- | -------------------------------------------- |
| "검사 삭제" 버튼 | `delete:assessment_case` | **표시**    | `PermissionGuard` | `assessment/status/history/+page.svelte:652` |


#### 검사 접수 (`/assessment/receive`)


| UI 요소 | 권한  | COUNSELOR | 비고                             |
| ----- | --- | --------- | ------------------------------ |
| 접수 폼  | -   | **표시**    | `permissionContext`로 전문가 맥락 제공 |


---

### 3.5 구성원 (`/member`) - **전체 숨김**

> 사이드바에서 메뉴 자체가 숨겨지므로 정상적으로는 접근 불가. URL 직접 입력 시 페이지는 렌더링됨.

#### 목록 (`/member`)


| UI 요소     | 권한                        | COUNSELOR | 가드 방식     | 파일:라인                       |
| --------- | ------------------------- | --------- | --------- | --------------------------- |
| 구성원 삭제 메뉴 | `delete:member`           | **숨김**    | 직접 권한 체크  | `member/+page.svelte:56-60` |
| 구성원 초대 버튼 | `write:member_invitation` | **숨김**    | 서비스 레벨 체크 | `members-service.ts:76`     |


#### 초대 (`/member/invite`)


| UI 요소   | 권한                        | COUNSELOR | 비고          |
| ------- | ------------------------- | --------- | ----------- |
| 초대 폼 전체 | `write:member_invitation` | **숨김**    | 서비스 레벨에서 차단 |


#### 구성원 상세 (`/member/[memberId]`)


| UI 요소     | 권한             | COUNSELOR | 가드 방식             | 파일                            |
| --------- | -------------- | --------- | ----------------- | ----------------------------- |
| 프로필 수정 버튼 | `write:member` | **표시**    | `PermissionGuard` | `MemberProfileCard.svelte:20` |
| 근무시간 수정   | `write:member` | **표시**    | `PermissionGuard` | `WorkScheduleTab.svelte:36`   |
| 경력 수정     | `write:member` | **표시**    | `PermissionGuard` | `CareerTab.svelte:32`         |


> COUNSELOR는 `write:member`를 보유하여 수정 버튼이 표시되지만, `accessLevel=own`이므로 API에서 본인 외 수정 시 403 반환. 사이드바에서 구성원 메뉴 자체가 숨겨져 정상 경로로는 접근 불가하며, URL 직접 접근 시에도 API 레벨에서 보호됨.

---

### 3.6 센터 관리 (`/center`) - **전체 숨김**

> 사이드바 "설정" 메뉴가 숨겨지므로 정상적으로는 접근 불가.

#### 센터 정보 (`/center/info`)


| UI 요소       | 권한             | COUNSELOR | 가드 방식             | 파일:라인                          |
| ----------- | -------------- | --------- | ----------------- | ------------------------------ |
| 센터 정보 수정 버튼 | `write:center` | **숨김**    | `PermissionGuard` | `center/info/+page.svelte:285` |


#### 상담실 관리 (`/center/room`)


| UI 요소     | 권한           | COUNSELOR | 가드 방식             | 파일:라인                         |
| --------- | ------------ | --------- | ----------------- | ----------------------------- |
| 상담실 추가 버튼 | `write:room` | **숨김**    | `PermissionGuard` | `center/room/+page.svelte:51` |
| 상담실 관리 UI | `write:room` | **숨김**    | `PermissionGuard` | `RoomSection.svelte:67`       |


#### 프로그램 관리 (`/center/program`)


| UI 요소      | 권한              | COUNSELOR | 가드 방식             | 파일:라인                            |
| ---------- | --------------- | --------- | ----------------- | -------------------------------- |
| 프로그램 추가 버튼 | `write:program` | **숨김**    | `PermissionGuard` | `center/program/+page.svelte:54` |


#### 검사 관리 (`/center/manage`)


| UI 요소      | 권한                       | COUNSELOR | 가드 방식             | 파일:라인                                |
| ---------- | ------------------------ | --------- | ----------------- | ------------------------------------ |
| "검사 추가" 버튼 | `write:assessment_case`  | **표시**    | `PermissionGuard` | `center/manage/+page.svelte:150,241` |
| "검사 삭제" 버튼 | `delete:assessment_case` | **표시**    | `PermissionGuard` | `center/manage/+page.svelte:252`     |


> **주의**: 검사 관리 페이지의 추가/삭제 버튼은 COUNSELOR에게도 표시됨. 이 페이지는 센터 검사 카탈로그 관리 페이지인데, 검사 케이스 권한(`write:assessment_case`)으로 가드되어 있음. 센터 검사 관리는 `write:center_assessment` 권한이 필요해야 할 수 있음 → **검토 필요**.

#### 권한 설정 (`/center/authorization`)


| UI 요소       | 권한                           | COUNSELOR | 가드 방식                | 파일:라인                                       |
| ----------- | ---------------------------- | --------- | -------------------- | ------------------------------------------- |
| 페이지 전체      | `write:role`                 | **숨김**    | `PermissionGuard` 래핑 | `center/authorization/+page.svelte:285`     |
| 역할 수정/삭제 메뉴 | `write:role` + `super_admin` | **숨김**    | 직접 체크                | `center/authorization/+page.svelte:358,383` |


---

### 3.7 공지사항 (`/notice`)


| UI 요소   | 권한             | COUNSELOR | 가드 방식             | 파일:라인                    |
| ------- | -------------- | --------- | ----------------- | ------------------------ |
| 공지사항 목록 | `read:notice`  | **표시**    | 사이드바 권한           | -                        |
| "작성" 버튼 | `write:notice` | **숨김**    | `PermissionGuard` | `notice/+page.svelte:36` |


---

### 3.8 내 정보 (`/myInfo`)


| UI 요소  | 권한             | COUNSELOR | 비고                                      |
| ------ | -------------- | --------- | --------------------------------------- |
| 전체 페이지 | 제한 없음          | **표시**    | `$permissionStore.context?.memberId` 사용 |
| 프로필 수정 | `write:member` | **표시**    | 본인 프로필                                  |


---

### 3.9 스케줄 캘린더 컴포넌트


| UI 요소       | 권한             | COUNSELOR | 가드 방식             | 파일                                 |
| ----------- | -------------- | --------- | ----------------- | ---------------------------------- |
| 담당자 배정 드롭다운 | `write:member` | **표시**    | `PermissionGuard` | `ManagerSelectDropDown.svelte:102` |


> COUNSELOR가 `write:member` 보유로 담당자 배정 UI가 표시되나, `accessLevel=own`이므로 API에서 본인 일정만 수정 가능. 타인 일정의 담당자 변경은 API 레벨에서 차단됨.

---

## 4. accessLevel 기반 데이터 범위 제어

COUNSELOR는 `accessLevel: 'own'`이므로 다음 필터가 자동 적용됨:


| 화면       | 영향받는 UI     | 동작                  |
| -------- | ----------- | ------------------- |
| 상담 현황    | 담당자 필터 드롭다운 | **숨김** (본인 데이터만 표시) |
| 검사 현황    | 담당자 필터 드롭다운 | **숨김** (본인 데이터만 표시) |
| 전체 목록 조회 | API 응답      | 본인 담당 건만 반환         |


> **파일**: `assessment/status/+page.svelte:78-85`, `counseling/status/+page.svelte:68-89`

---

## 5. 잠재적 문제점 및 검토 필요 사항

### 5.1 `write:member` + `accessLevel=own` 조합으로 보호

COUNSELOR는 `write:member`를 보유하지만 `accessLevel=own`이므로:
- 구성원 상세 페이지에서 수정 버튼이 표시되더라도 **API가 본인 외 수정을 거부 (403)**
- 사이드바에서 구성원 메뉴가 숨겨져 정상 경로로 접근 불가
- 담당자 배정 드롭다운도 본인 일정에만 적용 가능

**결론**: 권한 분리 없이 현재 `accessLevel` 체계로 충분히 보호됨.

### 5.2 URL 직접 접근 미차단

다음 페이지는 사이드바에서 숨겨지지만, URL 직접 입력 시 렌더링될 수 있음:


| 경로               | 현재 상태               | 권장                          |
| ---------------- | ------------------- | --------------------------- |
| `/member`        | 사이드바만 숨김, 페이지 접근 가능 | 라우트 가드 또는 페이지 래핑 필요         |
| `/member/invite` | 서비스 레벨 차단만          | 페이지 레벨 `PermissionGuard` 추가 |
| `/center/`*      | 사이드바만 숨김            | 라우트 가드 추가 권장                |


### 5.3 검사 관리 페이지 권한 불일치


| 경로                     | 현재 권한                    | 예상 권한                     |
| ---------------------- | ------------------------ | ------------------------- |
| `/center/manage` 검사 추가 | `write:assessment_case`  | `write:center_assessment` |
| `/center/manage` 검사 삭제 | `delete:assessment_case` | `write:center_assessment` |


> 센터 검사 카탈로그 관리는 검사 케이스 CRUD와 다른 도메인. 현재 권한 매핑이 맞는지 확인 필요.

---

## 6. 요약 매트릭스

### COUNSELOR에게 보이는 것


| 카테고리        | 항목                             |
| ----------- | ------------------------------ |
| **메뉴**      | 스케줄, 내담자, 상담, 심리검사, 공지사항, 내 정보 |
| **CRUD 버튼** | 일정/내담자/상담/검사의 추가/수정/삭제 (본인 것만) |
| **데이터**     | 본인 담당 건만 (accessLevel=own)     |


### COUNSELOR에게 숨겨지는 것


| 카테고리    | 항목                           |
| ------- | ---------------------------- |
| **메뉴**  | 대시보드, 청구/결제, 구성원, 설정(전체)     |
| **필터**  | 담당자 선택 드롭다운 (상담/검사 현황)       |
| **버튼**  | 공지사항 작성, 구성원 초대/삭제           |
| **페이지** | 권한 설정, 센터 정보 수정, 상담실/프로그램 관리 |
| **데이터** | 다른 전문가의 상담/검사/일정             |


