# MindScope Mobile App - 기능 명세서

> React Native (Expo) 기반 심리상담 센터 SaaS 모바일 앱의 전체 기능, 동작, API 명세

---

## 목차

1. [앱 구조 개요](#1-앱-구조-개요)
2. [인증 시스템](#2-인증-시스템)
3. [홈 탭](#3-홈-탭)
4. [일정 탭](#4-일정-탭)
5. [내담자 탭](#5-내담자-탭)
6. [더보기 탭](#6-더보기-탭)
7. [일정 상세](#7-일정-상세)
8. [상담 현황](#8-상담-현황)
9. [상담 케이스 상세](#9-상담-케이스-상세)
10. [상담 세션 상세](#10-상담-세션-상세)
11. [상담 노트](#11-상담-노트)
12. [검사 현황](#12-검사-현황)
13. [검사 케이스 상세](#13-검사-케이스-상세)
14. [내담자 상세](#14-내담자-상세)
15. [내담자 등록](#15-내담자-등록)
16. [필드노트 (녹음)](#16-필드노트-녹음)
17. [알림](#17-알림)
18. [알림 설정](#18-알림-설정)
19. [푸시 알림 시스템](#19-푸시-알림-시스템)
20. [API 엔드포인트 전체 목록](#20-api-엔드포인트-전체-목록)

---

## 1. 앱 구조 개요

### 네비게이션 구조

```
app/
├── (auth)/                     # 인증 플로우 (비로그인)
│   ├── login.tsx               # 로그인 화면
│   └── center-select.tsx       # 센터 선택 화면
│
└── (main)/                     # 메인 플로우 (로그인 후)
    ├── (tabs)/                 # 하단 탭 네비게이션
    │   ├── index.tsx           # 홈
    │   ├── schedule.tsx        # 일정
    │   ├── clients.tsx         # 내담자
    │   └── more.tsx            # 더보기
    │
    ├── schedule/[id].tsx       # 일정 상세
    ├── counseling/
    │   ├── index.tsx           # 상담 현황 리스트
    │   ├── [id].tsx            # 상담 케이스 상세
    │   ├── session/[id].tsx    # 상담 세션 상세
    │   └── note/[sessionId].tsx # 상담 노트 작성
    ├── assessment/
    │   ├── index.tsx           # 검사 현황 리스트
    │   └── [id].tsx            # 검사 케이스 상세
    ├── client/
    │   ├── [id].tsx            # 내담자 상세
    │   └── register.tsx        # 내담자 등록
    ├── field-note/[scheduleId].tsx  # 필드노트 (녹음)
    ├── notifications/index.tsx      # 알림 목록
    └── notification-settings/index.tsx  # 알림 설정
```

### 탭 구성 (4개)

| 탭 | 아이콘 | 라벨 | 역할별 라벨 |
|----|--------|------|------------|
| 홈 | `home` | 홈 | - |
| 일정 | `calendar` | 일정 | - |
| 내담자 | `people` | 내담자 | 상담사: "내 내담자" |
| 더보기 | `ellipsis-horizontal` | 더보기 | - |

### 역할 시스템

| 역할코드 | 라벨 | 데이터 접근 |
|----------|------|------------|
| `ADMIN` | 관리자 | 센터 전체 데이터 |
| `MANAGER` | 매니저 | 센터 전체 데이터 |
| `COUNSELOR` | 상담사 | 본인 담당 케이스만 |

### 상태 관리

| Store | 라이브러리 | 용도 | 영속성 |
|-------|-----------|------|--------|
| `useAuthStore` | Zustand | 인증 상태, 유저 정보 | TokenStorage (SecureStore) |
| `useCenterStore` | Zustand + persist | 센터 ID, 이름, 역할 | AsyncStorage |
| React Query | TanStack Query v5 | 서버 상태 캐시 | 메모리 (staleTime 기반) |

---

## 2. 인증 시스템

### 로그인 화면 (`login.tsx`)

| 기능 | 동작 | API |
|------|------|-----|
| 이메일/비밀번호 로그인 | 로그인 요청 → 토큰 저장 → 센터 선택으로 이동 | `POST /api/v1/auth/login` |

**로그인 응답 구조:**
```
{ account, person, access_token, refresh_token, centers[] }
```

### 센터 선택 화면 (`center-select.tsx`)

| 기능 | 동작 |
|------|------|
| 센터 목록 표시 | 로그인 응답의 `centers[]`에서 렌더링 |
| 센터 선택 | `useCenterStore.setCenterContext(id, name, roleCode)` 저장 후 메인 진입 |

### 토큰 관리

| 동작 | 구현 |
|------|------|
| 토큰 저장 | `TokenStorage` (SecureStore / AsyncStorage) |
| 자동 갱신 | Axios 인터셉터: 401 → `POST /api/v1/auth/refresh` |
| 갱신 실패 | `forceLogout()` → 로그인 화면 리다이렉트 |
| 세션 복원 | 앱 시작 시 `hydrate()` → `GET /api/v1/auth/me` |

**API 목록:**

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/v1/auth/login` | 로그인 |
| `POST` | `/api/v1/auth/refresh` | 토큰 갱신 |
| `GET` | `/api/v1/auth/me` | 내 정보 조회 |

---

## 3. 홈 탭

**파일:** `app/(main)/(tabs)/index.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 오늘 일정 요약 | 센터명 + 날짜 + 예정 일정 수 표시 | `useScheduleList(centerId, today)` |
| 다음 일정 카드 | 가장 가까운 일정 강조 표시 (카운트다운) | 위 쿼리에서 계산 |
| 일정 리스트 | 오늘 전체 일정 시간순 표시 | 위 쿼리에서 필터 |
| 타입 필터 칩 | 전체/상담/검사 필터링 | 로컬 state |
| 알림 벨 아이콘 | 미읽음 알림 수 뱃지 표시 | `useUnreadCount(centerId)` |
| 필드노트 상태 | 각 일정에 녹음중/기록됨 뱃지 | `useFieldNoteStatuses(centerId, scheduleIds)` |
| 카운트다운 갱신 | 30초마다 "N분 후" 텍스트 갱신 | `setInterval(30_000)` |
| Pull to refresh | 일정 목록 새로고침 | `refetch()` |
| 일정 카드 탭 | 일정 상세 화면으로 이동 | `router.push('/(main)/schedule/${id}')` |
| 알림 벨 탭 | 알림 목록으로 이동 | `router.push('/(main)/notifications')` |

### 일정 카드 정보 구성

```
[상담] [진행중]                   🎤 녹음중
홍길동 (만 12세) 외 1명
09:00 - 10:00 · 2상담실
```

- **1행:** 타입 뱃지 + 상태 뱃지 + 필드노트 뱃지
- **2행:** 이름 + 나이 + 외 N명
- **3행:** 시간 범위 · 상담실

### 다음 일정 카드 정보 구성

```
│ [30분 후] [상담]               🎤 녹음중
│ 홍길동 (만 12세) 외 1명
│ 09:00 - 10:00 · 2상담실
```

- 좌측 4px 컬러 바 (진행중: 초록, 예정: 빨강)
- 카운트다운 뱃지 + 타입 뱃지 + 필드노트 뱃지

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/schedules/` | 날짜별 일정 목록 | `['schedules', centerId, dateStr]` |
| `GET` | `/centers/{id}/notifications/unread-count` | 미읽음 알림 수 | `['notificationUnreadCount', centerId]` |
| `GET` | `/centers/{id}/field-notes/statuses` | 필드노트 상태 일괄 조회 | `['fieldNote', 'statuses', centerId, ids]` |

---

## 4. 일정 탭

**파일:** `app/(main)/(tabs)/schedule.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 날짜 스트립 | 오늘 기준 -3일 ~ +3일 (7일) 표시 | 로컬 계산 |
| 날짜 선택 | 날짜 탭 시 해당 날짜 일정 조회 | `useScheduleList(centerId, selectedDate)` |
| 타임라인 뷰 | 08:00~21:00 시간대별 세로 타임라인 | hourRows 계산 |
| 일정 블록 | 시간대에 맞춰 블록 표시 (여러 시간 스팬 지원) | 위 쿼리에서 계산 |
| 블록 색상 | 좌측 바: 타입별 색상, 배경: gray[50] 통일 | 상수 매핑 |
| Pull to refresh | 일정 목록 새로고침 | `refetch()` |
| 일정 블록 탭 | 일정 상세 화면으로 이동 | `router.push('/(main)/schedule/${id}')` |

### 타임라인 블록 정보

```
08:00 │ ┃ 상담 · 홍길동          2상담실 · 09:00 - 10:00
      │ ┃
09:00 │
```

- 좌측 3px 컬러 바 (상담: primary, 검사: accent)
- 블록 높이: spanHours에 비례 (여러 시간 걸치는 일정 지원)

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/schedules/` | 날짜별 일정 목록 | `['schedules', centerId, dateStr]` |

**쿼리 파라미터:** `start=YYYY-MM-DDT00:00:00`, `end=YYYY-MM-DDT23:59:59`

---

## 5. 내담자 탭

**파일:** `app/(main)/(tabs)/clients.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 내담자 목록 | 카드 리스트 (아바타 + 이름 + 코드 + 성별/나이) | `useClientList(centerId, search)` |
| 검색 | 이름/코드/전화번호 디바운스 검색 (400ms) | 위 쿼리의 `search` 파라미터 |
| 역할별 필터링 | ADMIN/MANAGER: 전체, COUNSELOR: 담당만 | 서버 사이드 필터링 |
| 아바타 팔레트 | 이름 첫 글자 기반 4색 순환 | `charCodeAt(0) % 4` |
| 카운트 표시 | "전체 · N명" 또는 "내 담당 · N명" | `data.total` |
| Pull to refresh | 목록 새로고침 | `refetch()` |
| 내담자 카드 탭 | 내담자 상세로 이동 | `router.push('/(main)/client/${id}')` |
| 상담사 안내 | 하단에 "담당자로 배정된 내담자만 표시됩니다" 안내 | `isCounselor` 조건 |

### 내담자 카드 구성

```
[👤 홍] 홍길동    C-0001
        여 · 만 12세
```

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/clients/` | 내담자 목록 | `['clientList', centerId, search]` |

**쿼리 파라미터:** `search`, `limit=100`, `sort=desc`

---

## 6. 더보기 탭

**파일:** `app/(main)/(tabs)/more.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 프로필 카드 | 이름, 이메일, 센터명, 역할 뱃지 표시 | `useAuthStore`, `useCenterStore` |
| 상담 현황 바로가기 | 상담 현황 리스트로 이동 | `router.push('/(main)/counseling')` |
| 검사 현황 바로가기 | 검사 현황 리스트로 이동 | `router.push('/(main)/assessment')` |
| 알림 설정 | 알림 설정 화면으로 이동 | `router.push('/(main)/notification-settings')` |
| 업데이트 확인 | EAS Update 확인 | `checkForUpdate()` |
| 센터 전환 | 푸시 토큰 해제 → 센터 선택 화면 | `unregisterCurrentDevice()` → `clearCenter()` |
| 로그아웃 | 확인 Alert → 푸시 토큰 해제 → 토큰 삭제 → 로그인 화면 | `logout()` → `clearCenter()` |
| 앱 버전 | 하단에 "MindScope vX.X.X" 표시 | `expo-constants` |

### 사용 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `DELETE` | `/centers/{id}/notifications/push-tokens/{token}` | 로그아웃/센터 전환 시 토큰 해제 |

---

## 7. 일정 상세

**파일:** `app/(main)/schedule/[id].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 일정 정보 표시 | 날짜, 시간, 상담실, 내담자, 상담사, 프로그램 | `useScheduleDetail(centerId, scheduleId)` |
| 세션 상태 표시 | 뱃지: 예정/완료/노쇼/취소 | 상수 매핑 |
| 세션 상태 변경 | 완료/노쇼/취소 버튼 (확인 Alert) | `useUpdateSessionStatus()` |
| 메모 조회/수정 | 메모 카드에서 수정/저장/취소 | `useUpdateScheduleNote()` |
| 충돌 배너 | 겹치는 일정 경고 표시 | 상세 응답의 `conflicting_schedules` |
| 필드노트 버튼 | 필드노트 화면으로 이동 (녹음중/기록됨 상태) | `useFieldNoteBySchedule(centerId, scheduleId)` |
| 상담 노트 링크 | 세션의 참여자별 노트 작성/조회 링크 | `useNotesBySession()` |
| 검사 상세 링크 | 검사 케이스 상세로 이동 | `router.push('/(main)/assessment/${id}')` |
| 상담 상세 링크 | 상담 세션 상세로 이동 | `router.push('/(main)/counseling/session/${id}')` |
| 자동 스크롤 | 메모 편집 시 해당 카드로 자동 스크롤 | `scrollRef`, `onLayout + onFocus` |

### 세션 상태 변경 API 분기

| 일정 타입 | API | 액션 매핑 |
|-----------|-----|----------|
| 상담 (`counseling`) | `PATCH /centers/{id}/counseling/sessions/{sid}` | `{ status: 'completed' \| 'no_show' \| 'cancelled' }` |
| 검사 (`assessment`) | `POST /centers/{id}/assessment-sessions/{sid}/{action}` | `attend` / `noshow` / `cancel` |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/schedules/{sid}` | 일정 상세 | `['schedule', centerId, scheduleId]` |
| `PATCH` | `/centers/{id}/schedules/{sid}` | 메모 수정 | mutation |
| `PATCH` | `/centers/{id}/counseling/sessions/{sid}` | 상담 세션 상태 변경 | mutation |
| `POST` | `/centers/{id}/assessment-sessions/{sid}/{action}` | 검사 세션 상태 변경 | mutation |
| `GET` | `/centers/{id}/field-notes/by-schedule/{sid}` | 필드노트 조회 | `['fieldNote', 'bySchedule', ...]` |
| `GET` | `/centers/{id}/counseling/sessions/{sid}/notes` | 상담 노트 목록 | `['counselingNotes', ...]` |

---

## 8. 상담 현황

**파일:** `app/(main)/counseling/index.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 케이스 목록 | 카드 리스트 (아바타 + 이름 + 상태 + 진행률) | `useCounselingCaseList(centerId, status)` |
| 상태 필터 탭 | 전체 / 진행중 / 종결 | 로컬 state → API 파라미터 |
| 진행률 표시 | 프로그레스 바 + "N/M회" 텍스트 | `completed_sessions / total_sessions` |
| 다음 회기 날짜 | "다음 회기: M/d" 표시 | `next_session_start` |
| Pull to refresh | 목록 새로고침 | `refetch()` |
| 카드 탭 | 상담 케이스 상세로 이동 | `router.push('/(main)/counseling/${id}')` |

### 상담 케이스 카드 구성

```
[👤 홍] 홍길동          [진행중]
        개인상담 프로그램명
        ████░░░░░ 5/10회
        다음 회기: 3/25
```

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/counseling/` | 상담 케이스 목록 | `['counselingCaseList', centerId, status]` |

**쿼리 파라미터:** `status`, `size=50`

---

## 9. 상담 케이스 상세

**파일:** `app/(main)/counseling/[id].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 기본 정보 | 케이스 코드, 프로그램, 유형, 기간, 주호소, 회기 수 | `useCounselingCaseDetail(centerId, caseId)` |
| 상태 뱃지 | 진행중/종결/취소 | 상수 매핑 |
| 내담자 목록 | 참여 내담자 카드 (성별, 나이) | 상세 응답의 `clients[]` |
| 세션 아코디언 | 회기별 접기/펼치기 리스트 | 상세 응답의 `sessions[]` |
| 세션 정보 | 회기 번호, 상태, 날짜, 시간, 상담실 | 각 session 데이터 |
| 참여자 출석 상태 | 참석/불참/지각/사전결석 뱃지 | `clients[].attendance_status` |
| 노트 링크 | 참여자별 "노트" 버튼 → 노트 화면 이동 | `has_note` 체크 |
| 상담사 정보 | 주 상담사 + 부 상담사 표시 | `counselors[]` |
| 세션 상세 링크 | 세션 행 탭 → 세션 상세 이동 | `router.push('/(main)/counseling/session/${id}')` |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/counseling/{caseId}` | 상담 케이스 상세 | `['counselingCaseDetail', centerId, caseId]` |

---

## 10. 상담 세션 상세

**파일:** `app/(main)/counseling/session/[id].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 세션 정보 | 케이스 코드, 회기 번호, 날짜, 시간, 상담실 | `useSessionDetail(centerId, sessionId)` |
| 세션 상태 뱃지 | 예정/완료/노쇼/취소 | 상수 매핑 |
| 출석 체크 | 참여자별 출석 상태 표시/변경 (드롭다운) | `useSessionParticipants()` + `useUpdateAttendance()` |
| 출석 상태 선택 | BottomSheet 모달에서 참석/불참/지각/사전결석 선택 | `useUpdateAttendance()` |
| 상담사 정보 | 주 상담사 + 부 상담사 | 세션 상세 응답 |
| 상담 노트 현황 | 참여자별 노트 작성 상태 + 이동 링크 | `useNotesBySession()` |
| 필드노트 링크 | 필드노트 화면으로 이동 (상태 표시) | `useFieldNoteBySchedule()` |
| 세션 상태 변경 | 완료/노쇼/취소 버튼 (확인 Alert) | `useUpdateSessionStatus()` |
| 세션 취소 | 별도 취소 API 호출 | `useCancelSession()` |

### 출석 변경 옵션

| 값 | 라벨 | 색상 |
|----|------|------|
| `attended` | 참석 | 초록 |
| `absent` | 불참 | 빨강 |
| `late` | 지각 | 주황 |
| `excused` | 사전결석 | 파랑 |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/counseling/sessions/{sid}` | 세션 상세 | `['counselingSession', ...]` |
| `GET` | `/centers/{id}/counseling/sessions/{sid}/participants` | 참여자 목록 | `['sessionParticipants', ...]` |
| `PATCH` | `/centers/{id}/counseling/sessions/{sid}` | 세션 상태 변경 | mutation |
| `POST` | `/centers/{id}/counseling/sessions/{sid}/cancel` | 세션 취소 | mutation |
| `PATCH` | `/centers/{id}/counseling/session-participants/{pid}` | 출석 상태 변경 | mutation |
| `GET` | `/centers/{id}/counseling/sessions/{sid}/notes` | 노트 목록 | `['counselingNotes', ...]` |
| `GET` | `/centers/{id}/field-notes/by-schedule/{sid}` | 필드노트 조회 | `['fieldNote', 'bySchedule', ...]` |

---

## 11. 상담 노트

**파일:** `app/(main)/counseling/note/[sessionId].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 노트 조회 | 기존 노트 자동 감지 → view 모드 | `useNotesBySession(centerId, sessionId, clientId)` |
| 노트 작성 | 3개 카드: 상담 내용, 요약, 비공개 메모 | `useCreateNote()` |
| 노트 수정 | 수정 모드 진입 → 편집 → 저장 | `useUpdateNote()` |
| 노트 삭제 | 확인 Alert → 삭제 → 목록으로 돌아감 | `useDeleteNote()` |
| 변경 감지 | dirty 체크 → 뒤로가기 시 "저장하지 않은 내용" 확인 | 로컬 state 비교 |
| 자동 스크롤 | TextInput 포커스 시 해당 카드로 스크롤 | `scrollRef + onLayout + onFocus` |

### 노트 내용 구조 (NoteContent)

| 필드 | 라벨 | 설명 |
|------|------|------|
| `raw_notes` | 상담 내용 | 자유 형식 텍스트 |
| `summary` | 요약 | 상담 요약 |
| `private_notes` | 비공개 메모 | 상담사 개인 메모 |
| `mood` | 기분 | (미사용 - 향후) |
| `main_topic` | 주요 주제 | (미사용 - 향후) |
| `intervention` | 개입 | (미사용 - 향후) |
| `progress` | 진행 | (미사용 - 향후) |
| `homework` | 과제 | (미사용 - 향후) |
| `next_goal` | 다음 목표 | (미사용 - 향후) |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/counseling/sessions/{sid}/notes` | 세션별 노트 조회 | `['counselingNotes', ...]` |
| `POST` | `/centers/{id}/counseling/sessions/{sid}/notes` | 노트 생성 | mutation |
| `PATCH` | `/centers/{id}/counseling/notes/{nid}` | 노트 수정 | mutation |
| `DELETE` | `/centers/{id}/counseling/notes/{nid}` | 노트 삭제 | mutation |

---

## 12. 검사 현황

**파일:** `app/(main)/assessment/index.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 케이스 목록 | 카드 리스트 (아바타 + 이름 + 상태 + 검사 목록) | `useAssessmentCaseList(centerId, status)` |
| 상태 필터 탭 | 전체 / 진행중 / 완료 | 로컬 state → API 파라미터 |
| 검사 목록 칩 | 검사명 칩 최대 3개 + "외 N개" | `assessments[]` |
| 날짜 정보 | 생성일 / 완료일 표시 | `created_at`, `completed_at` |
| Pull to refresh | 목록 새로고침 | `refetch()` |
| 카드 탭 | 검사 케이스 상세로 이동 | `router.push('/(main)/assessment/${id}')` |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/assessment-cases` | 검사 케이스 목록 | `['assessmentCaseList', centerId, status]` |

**쿼리 파라미터:** `status`, `size=50`

---

## 13. 검사 케이스 상세

**파일:** `app/(main)/assessment/[id].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 기본 정보 | 케이스 코드, 유형, 생성일, 완료일, 테스트 세트, 최종 보고서 여부 | `useAssessmentCaseDetail(centerId, caseId)` |
| 상태 뱃지 | 대기/진행중/완료/취소 | 상수 매핑 |
| 내담자 목록 | 참여 내담자 카드 (성별, 나이) | 상세 응답의 `clients[]` |
| 검사 과제 목록 | 검사명 + 상태 뱃지 + 실행 방법(대면/온라인) | `tasks[]` |
| 세션 일정 | 날짜/시간 + 상태 표시 | `sessions[]` |
| 일정 상세 링크 | 일정 탭 → 해당 일정 상세 | `router.push('/(main)/schedule/${id}')` |
| 상담사 정보 | 담당 검사자 + 보조 검사자 | `counselor`, `assistants[]` |
| 기관 정보 | 집단검사 시 기관 정보 표시 | `institution` |

### 검사 과제 상태

| 상태 | 라벨 | 색상 |
|------|------|------|
| `pending` | 대기 | 회색 |
| `in_progress` | 진행중 | 파랑 |
| `submitted` | 제출완료 | 주황 |
| `completed` | 검수완료 | 초록 |
| `refused` | 거부 | 빨강 |
| `cancelled` | 취소 | 회색 |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/assessment-cases/{caseId}` | 검사 케이스 상세 | `['assessmentCaseDetail', centerId, caseId]` |

---

## 14. 내담자 상세

**파일:** `app/(main)/client/[id].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 프로필 카드 | 아바타 + 이름 + 성별/나이/코드 + 전화/문자 버튼 | `useClientDetail(centerId, clientId)` |
| 탭 전환 | 정보 / 상담 / 검사 (뱃지 카운트 포함) | 로컬 state |
| **정보 탭** | 기본 정보(생년월일, 전화, 이메일, 주소, 등록일) | 상세 응답 |
| 보호자 카드 | 보호자 관계 + 이름 + 전화 + 전화 버튼 | `useClientRelations(centerId, clientId)` |
| 메모 | 메모 텍스트 표시 | 상세 응답의 `memo` |
| **상담 탭** | 다음 회기 하이라이트 + 진행중/종결 케이스 | `useCounselingCases(centerId, clientId, clientName)` |
| 상담 케이스 카드 | 프로그램명 + 진행률 서클 + 상태 뱃지 | 케이스 응답 |
| 상담 케이스 탭 | 상담 케이스 상세로 이동 | `router.push('/(main)/counseling/${id}')` |
| **검사 탭** | 대기중/완료 검사 케이스 | `useClientCases(centerId, clientId)` |
| 검사 케이스 카드 | 케이스 코드 + 상태 + 검사명 칩 | 케이스 응답 |
| 검사 케이스 탭 | 검사 케이스 상세로 이동 | `router.push('/(main)/assessment/${id}')` |
| 전화 걸기 | `Linking.openURL('tel:010...')` | `react-native` Linking |
| 문자 보내기 | `Linking.openURL('sms:010...')` | `react-native` Linking |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/clients/{cid}` | 내담자 상세 | `['clientDetail', centerId, clientId]` |
| `GET` | `/centers/{id}/clients/{cid}/relations` | 보호자 관계 | `['clientRelations', centerId, clientId]` |
| `GET` | `/centers/{id}/assessment-cases/by-client/{cid}` | 검사 케이스 (클라이언트별) | `['clientCases', centerId, clientId]` |
| `GET` | `/centers/{id}/counseling/` | 상담 케이스 (이름 검색) | `['counselingCases', centerId, clientId, name]` |

> **참고:** 상담 케이스는 `client_name` 파라미터로 LIKE 검색 후 `client_id`로 필터링 (백엔드에 by-client 엔드포인트 없음)

---

## 15. 내담자 등록

**파일:** `app/(main)/client/register.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 다단계 폼 | 7단계 위저드 형식 등록 | 로컬 state |
| 이름 입력 | 필수 필드, 빈 값 검증 | Step 1 |
| 생년월일/성별 | 생년월일 자동 포맷 + 성별 선택 칩 | Step 2 |
| 전화번호 | 자동 포맷 (010-1234-5678) | Step 3 |
| 보호자 여부 | "보호자를 등록하시겠습니까?" 선택 | Step 4 |
| 보호자 정보 | 관계(엄마/아빠/...) + 이름 + 전화 (복수 등록) | Step 5 |
| 추가 정보 | 이메일 + 메모 (선택) | Step 6 |
| 확인 & 등록 | 입력 내용 리뷰 → 등록 실행 | Step 7 |
| 개별 등록 | 보호자 없을 때 단일 내담자 생성 | `useCreateClient()` |
| 일괄 등록 | 보호자 있을 때 내담자+보호자 일괄 생성 | `useBatchCreateClients()` |
| 409 처리 | 중복 내담자 시 에러 Alert | API 에러 핸들링 |
| 애니메이션 | 단계 전환 시 fade 효과 | `Animated.Value` |
| 프로그레스 바 | 상단 진행률 표시 | `step / totalSteps` |

### 보호자 관계 옵션

`엄마`, `아빠`, `할머니`, `할아버지`, `이모`, `고모`, `삼촌`, `기타`

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `POST` | `/centers/{id}/clients/` | 단일 내담자 생성 | mutation |
| `POST` | `/centers/{id}/clients/batch` | 내담자+보호자 일괄 생성 | mutation |

---

## 16. 필드노트 (녹음)

**파일:** `app/(main)/field-note/[scheduleId].tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 녹음 시작 | 마이크 권한 요청 → 녹음 시작 → 필드노트 생성 | `useRecorder()` + `useCreateFieldNote()` |
| 녹음 일시정지/재개 | pause/resume 토글 | `useRecorder().pauseRecording/resumeRecording` |
| 녹음 종료 | 마지막 청크 업로드 → 녹음 완료 처리 | `useFinishRecording()` |
| 청크 업로드 | 30초마다 오디오 청크 자동 업로드 | `useUploadAudioChunk()` |
| 타이머 | HH:MM:SS 실시간 표시 | `useTimer()` |
| 웨이브폼 | 녹음 중 애니메이션 (25바) | `Animated` + `setInterval` |
| REC 표시 | 깜빡이는 녹음 인디케이터 | `Animated.loop` |
| 태그 입력 | 관찰/행동/감정/기타 태그 추가 (타임스탬프 포함) | `useAddEntry(type: 'tag')` |
| 메모 입력 | 자유 텍스트 메모 추가 (타임스탬프 포함) | `useAddEntry(type: 'memo')` |
| 트랜스크립트 | STT 변환 결과 실시간 표시 (5초 폴링) | `useFieldNote(polling: true)` |
| 기존 녹음 재개 | `recording` 상태 필드노트 감지 시 이어서 녹음 | `useFieldNoteBySchedule()` |
| 완료 후 추가 녹음 | 완료 상태에서 "추가 녹음 시작" 버튼 | `useCreateFieldNote()` 재호출 |
| 다크 테마 UI | 녹음 화면 전용 다크 모드 | 인라인 스타일 |

### 오디오 청크 시스템

```
녹음 시작 → [30초 녹음] → 청크 업로드 → [30초 녹음] → 청크 업로드 → ... → 녹음 종료
```

- **청크 간격:** 30초 (`CHUNK_INTERVAL_SECONDS`)
- **폴링 간격:** 5초 (`POLLING_INTERVAL_MS`) - 트랜스크립트 갱신
- **파일 형식:** `audio/mp4` (m4a)
- **백그라운드:** `staysActiveInBackground: true`, 포그라운드 복귀 시 자동 재개
- **플랫폼:** Android: FCM 네이티브 토큰, iOS: Expo Push Token

### 태그 카테고리

| 카테고리 | 라벨 | 색상 |
|----------|------|------|
| `observation` | 관찰 | 파랑 |
| `behavior` | 행동 | 초록 |
| `emotion` | 감정 | 핑크 |
| `other` | 기타 | 회색 |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `POST` | `/centers/{id}/field-notes` | 필드노트 생성 | mutation |
| `GET` | `/centers/{id}/field-notes/{fid}` | 필드노트 상세 (폴링) | `['fieldNote', centerId, fid]` |
| `GET` | `/centers/{id}/field-notes/by-schedule/{sid}` | 일정별 필드노트 | `['fieldNote', 'bySchedule', ...]` |
| `POST` | `/centers/{id}/field-notes/{fid}/entries` | 메모/태그 추가 | mutation |
| `POST` | `/centers/{id}/field-notes/{fid}/audio` | 오디오 청크 업로드 | mutation |
| `PATCH` | `/centers/{id}/field-notes/{fid}/finish` | 녹음 종료 | mutation |

---

## 17. 알림

**파일:** `app/(main)/notifications/index.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 알림 목록 | 날짜별 그룹화 (오늘/어제/날짜) | `useNotificationList(centerId)` |
| 무한 스크롤 | 20개씩 페이지네이션 | `fetchNextPage()` |
| 읽지 않음 표시 | 파란 dot + bold 텍스트 | `is_read` 필드 |
| 알림 읽기 | 알림 탭 시 읽음 처리 | `useMarkAsRead()` |
| 전체 읽기 | 헤더 "모두 읽기" 버튼 | `useMarkAllAsRead()` |
| 낙관적 업데이트 | 읽음 처리 시 카운트 즉시 감소 | `onMutate` 낙관적 업데이트 |
| 카테고리 아이콘 | 상담/검사/시스템별 아이콘+색상 | `CATEGORY_CONFIG` 상수 |
| 딥링크 | 알림 탭 → 관련 화면으로 이동 | `handleNotificationNavigation()` |
| Pull to refresh | 목록 새로고침 | `refetch()` |

### 알림 카테고리

| 카테고리 | 아이콘 | 색상 |
|----------|--------|------|
| `counseling` | `chatbubbles` | 파랑 |
| `assessment` | `clipboard` | 빨강 |
| `system` | `settings` | 회색 |

### 딥링크 네비게이션 규칙

| `data.type` | 이동 대상 |
|-------------|----------|
| `assessment` | `/(main)/assessment` |
| `counseling` | `/(main)/counseling` |
| `schedule` + `schedule_id` | `/(main)/schedule/${schedule_id}` |
| `client` + `client_id` | `/(main)/client/${client_id}` |
| 기타 | `/(main)/notifications` |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/notifications` | 알림 목록 (페이지) | `['notificationList', centerId]` |
| `PATCH` | `/centers/{id}/notifications/{nid}/read` | 개별 읽기 | mutation |
| `PATCH` | `/centers/{id}/notifications/read-all` | 전체 읽기 | mutation |
| `GET` | `/centers/{id}/notifications/unread-count` | 미읽음 카운트 | `['notificationUnreadCount', centerId]` |

---

## 18. 알림 설정

**파일:** `app/(main)/notification-settings/index.tsx`

### 기능 목록

| 기능 | 동작 | 사용 Hook/API |
|------|------|--------------|
| 설정 목록 | 4개 카테고리별 알림 설정 카드 | `useNotificationSettings(centerId)` |
| 토글 변경 | 인앱/푸시 알림 ON/OFF 토글 | `useUpsertNotificationSetting()` |
| 글로벌 설정 | `*` 카테고리: 전체 알림 ON/OFF | 특별 카드 (primary 테두리) |

### 카테고리 설정

| 카테고리 | 라벨 | 설명 |
|----------|------|------|
| `*` | 전체 알림 | 모든 알림을 한번에 관리 |
| `assessment` | 검사 알림 | 검사 관련 알림 |
| `counseling` | 상담 알림 | 상담 관련 알림 |
| `system` | 시스템 알림 | 시스템 공지/점검 알림 |

### 토글 채널

| 채널 | 설명 |
|------|------|
| `channel_in_app` | 앱 내 알림 표시 |
| `channel_push` | 푸시 알림 발송 |
| `channel_alarmtalk` | 알림톡 (카카오) — 현재 미사용 |

### 사용 API

| Method | Endpoint | 설명 | Query Key |
|--------|----------|------|-----------|
| `GET` | `/centers/{id}/notification-settings` | 알림 설정 조회 | `['notificationSettings', centerId]` |
| `PUT` | `/centers/{id}/notification-settings` | 알림 설정 변경 | mutation |

---

## 19. 푸시 알림 시스템

**파일:** `src/features/notification/push.ts`

### 동작 흐름

```
앱 시작 → 권한 요청 → 토큰 획득 → 서버 등록
        ↓
포그라운드 알림 수신 → 배너 표시 + 목록 새로고침
        ↓
알림 탭 → 딥링크 네비게이션
        ↓
백그라운드 → 포그라운드 복귀 → 미읽음 카운트 새로고침
```

### 플랫폼별 토큰 전략

| 플랫폼 | 토큰 타입 | 발송 경로 |
|--------|----------|----------|
| Android | FCM 네이티브 토큰 | 서버 → FCM → 디바이스 |
| iOS | Expo Push Token | 서버 → Expo Push API → APNs → 디바이스 |

### 이벤트 리스너

| 이벤트 | 동작 |
|--------|------|
| `addNotificationReceivedListener` | 포그라운드 수신 → 알림 목록/카운트 새로고침 |
| `addNotificationResponseReceivedListener` | 알림 탭 → 딥링크 네비게이션 |
| `addPushTokenListener` | 토큰 갱신 → 서버에 재등록 |
| `AppState 'active'` | 포그라운드 복귀 → 카운트 새로고침 |

### 사용 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/centers/{id}/notifications/push-tokens` | 푸시 토큰 등록 |
| `DELETE` | `/centers/{id}/notifications/push-tokens/{token}` | 푸시 토큰 해제 |

---

## 20. API 엔드포인트 전체 목록

> 모든 엔드포인트의 Base URL: `{API_BASE_URL}/api/v1`

### 인증 (Auth)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/auth/login` | 로그인 |
| `POST` | `/auth/refresh` | 토큰 갱신 |
| `GET` | `/auth/me` | 내 정보 조회 |

### 일정 (Schedule)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/centers/{cid}/schedules/` | 일정 목록 (날짜 범위) |
| `GET` | `/centers/{cid}/schedules/{sid}` | 일정 상세 |
| `PATCH` | `/centers/{cid}/schedules/{sid}` | 일정 메모 수정 |

### 내담자 (Client)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/centers/{cid}/clients/` | 내담자 목록 (검색) |
| `GET` | `/centers/{cid}/clients/{clid}` | 내담자 상세 |
| `POST` | `/centers/{cid}/clients/` | 내담자 생성 |
| `POST` | `/centers/{cid}/clients/batch` | 내담자+보호자 일괄 생성 |
| `GET` | `/centers/{cid}/clients/{clid}/relations` | 내담자 관계 조회 |

### 상담 (Counseling)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/centers/{cid}/counseling/` | 상담 케이스 목록 |
| `GET` | `/centers/{cid}/counseling/{caseId}` | 상담 케이스 상세 |
| `GET` | `/centers/{cid}/counseling/cases/{caseId}/sessions` | 케이스별 세션 목록 |
| `GET` | `/centers/{cid}/counseling/sessions/{sid}` | 세션 상세 |
| `PATCH` | `/centers/{cid}/counseling/sessions/{sid}` | 세션 상태 변경 |
| `POST` | `/centers/{cid}/counseling/sessions/{sid}/cancel` | 세션 취소 |
| `GET` | `/centers/{cid}/counseling/sessions/{sid}/participants` | 세션 참여자 목록 |
| `PATCH` | `/centers/{cid}/counseling/session-participants/{pid}` | 출석 상태 변경 |
| `GET` | `/centers/{cid}/counseling/sessions/{sid}/notes` | 세션별 노트 목록 |
| `GET` | `/centers/{cid}/counseling/notes/{nid}` | 노트 단일 조회 |
| `POST` | `/centers/{cid}/counseling/sessions/{sid}/notes` | 노트 생성 |
| `PATCH` | `/centers/{cid}/counseling/notes/{nid}` | 노트 수정 |
| `DELETE` | `/centers/{cid}/counseling/notes/{nid}` | 노트 삭제 |

### 검사 (Assessment)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/centers/{cid}/assessment-cases` | 검사 케이스 목록 |
| `GET` | `/centers/{cid}/assessment-cases/{caseId}` | 검사 케이스 상세 |
| `GET` | `/centers/{cid}/assessment-cases/by-client/{clid}` | 내담자별 검사 케이스 |
| `POST` | `/centers/{cid}/assessment-sessions/{sid}/{action}` | 검사 세션 상태 변경 (attend/noshow/cancel) |

### 필드노트 (Field Note)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/centers/{cid}/field-notes` | 필드노트 생성 |
| `GET` | `/centers/{cid}/field-notes/{fid}` | 필드노트 상세 |
| `GET` | `/centers/{cid}/field-notes/by-schedule/{sid}` | 일정별 필드노트 |
| `GET` | `/centers/{cid}/field-notes/statuses` | 필드노트 상태 일괄 조회 |
| `POST` | `/centers/{cid}/field-notes/{fid}/entries` | 메모/태그 추가 |
| `POST` | `/centers/{cid}/field-notes/{fid}/audio` | 오디오 청크 업로드 |
| `PATCH` | `/centers/{cid}/field-notes/{fid}/finish` | 녹음 종료 |

### 알림 (Notification)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/centers/{cid}/notifications` | 알림 목록 |
| `GET` | `/centers/{cid}/notifications/unread-count` | 미읽음 카운트 |
| `PATCH` | `/centers/{cid}/notifications/{nid}/read` | 개별 읽기 |
| `PATCH` | `/centers/{cid}/notifications/read-all` | 전체 읽기 |
| `POST` | `/centers/{cid}/notifications/push-tokens` | 푸시 토큰 등록 |
| `DELETE` | `/centers/{cid}/notifications/push-tokens/{token}` | 푸시 토큰 해제 |
| `GET` | `/centers/{cid}/notification-settings` | 알림 설정 조회 |
| `PUT` | `/centers/{cid}/notification-settings` | 알림 설정 변경 |

---

## 부록: 데이터 캐싱 전략

### React Query 캐시 설정

| 쿼리 | staleTime | 특이사항 |
|-------|-----------|---------|
| 일정 목록 | 기본값 | - |
| 내담자 목록 | 5분 | - |
| 상담 케이스 목록 | 5분 | - |
| 검사 케이스 목록 | 5분 | - |
| 알림 목록 | 1분 | infinite query |
| 미읽음 카운트 | 1분 | 포그라운드 복귀 시 자동 갱신 |
| 필드노트 상세 (녹음 중) | - | `refetchInterval: 5000` (폴링) |

### 캐시 무효화 패턴

| 뮤테이션 | 무효화 대상 |
|----------|------------|
| 세션 상태 변경 | `schedule`, `schedules`, `counselingSession`, `sessionParticipants` |
| 출석 변경 | `sessionParticipants`, `schedule`, `schedules` |
| 메모 수정 | `schedule`, `schedules` |
| 노트 CRUD | `counselingNotes`, `counselingNote` |
| 내담자 생성 | `clientList` |
| 알림 읽기 | `notificationList`, `notificationUnreadCount` |
| 필드노트 종료 | `fieldNote` (exact: false) |
