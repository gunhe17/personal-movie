# 센터 방문 검사 플로우 (Onsite Assessment Flow)

> 내담자가 센터를 방문하여 태블릿으로 온라인 검사를 수행하는 시나리오

---

## 📋 전제 조건

- 관리자가 이미 로그인한 상태 (center_id, 권한 보유)
- 내담자에게 검사 케이스가 사전에 생성되어 있음
- 검사 케이스에 온라인 검사(execution_method="online")가 포함되어 있음

---

## 🎯 사용자 플로우

### Step 1: 내담자 신원 확인
**화면**: 내담자 정보 입력 폼

**사용자 액션**:
- 내담자가 이름과 생년월일 입력
- 예: "홍길동", "2010-03-15"

**API 호출**:
```http
GET /api/v1/centers/{center_id}/clients/search?name=홍길동&birthdate=2010-03-15
```

**Response**:
```json
[
  {
    "id": "client-uuid-1",
    "name": "홍길동",
    "birth_date": "2010-03-15",
    "role": "client",
    "phone": "010-1234-5678",
    ...
  }
]
```

**화면 처리**:
- ✅ **1명 검색**: 자동으로 Step 2로 진행 (client_id 저장)
  - 권장: 토스트 메시지 표시 "홍길동님, 환영합니다"
- ⚠️ **여러 명 검색**: 목록 표시 후 선택 (동명이인)
- ❌ **0명 검색**: "등록되지 않은 내담자입니다" 안내 → 직원 호출 안내

---

### Step 2: 검사 케이스 목록 조회
**화면**: 내담자의 검사 케이스 목록

**API 호출**:
```http
GET /api/v1/centers/{center_id}/assessment-cases/by-client/{client_id}?status=pending,processing
```

**Response**:
```json
[
  {
    "id": "case-uuid-1",
    "case_code": "AS-2026-0001",
    "status": "processing",
    "request_date": "2026-02-10",
    "title": "심리검사 의뢰",
    "created_at": "2026-02-10T10:30:00Z",
    ...
  },
  {
    "id": "case-uuid-2",
    "case_code": "AS-2026-0015",
    "status": "pending",
    "request_date": "2026-02-12",
    "title": "추가 검사",
    "created_at": "2026-02-12T14:00:00Z",
    ...
  }
]
```

**화면 표시**:
```
┌──────────────────────────────────────┐
│  홍길동님의 검사 목록                   │
├──────────────────────────────────────┤
│ ○ AS-2026-0001 | 심리검사 의뢰         │
│   요청일: 2026-02-10 | 진행 중         │
│                                      │
│ ○ AS-2026-0015 | 추가 검사            │
│   요청일: 2026-02-12 | 대기 중         │
└──────────────────────────────────────┘
  [케이스 선택하여 계속]
```

**사용자 액션**:
- 검사 케이스 선택 (예: AS-2026-0001)

**화면 처리**:
- ✅ **1개 케이스**: 자동으로 Step 3으로 진행 (case_id 저장)
  - 권장: 헤더/배너에 케이스 정보 표시 "AS-2026-0001 | 심리검사 의뢰"
- ✅ **2개 이상 케이스**: 목록 표시 후 선택
- ❌ **0개 케이스**: "진행 가능한 검사가 없습니다" → 직원 호출 안내

---

### Step 3: 온라인 검사 목록 조회
**화면**: 선택한 케이스의 온라인 검사 목록

**API 호출**:
```http
GET /api/v1/centers/{center_id}/assessment-cases/{case_id}/tasks?execution_method=online
```

**Response**:
```json
[
  {
    "id": "task-uuid-1",
    "assessment_id": "assessment-uuid-1",
    "status": "pending",
    "execution_method": "online",
    "started_at": null,
    "completed_at": null,
    "assessment": {
      "code": "SMARTPHONE_ADDICTION",
      "kor_name": "스마트폰중독검사",
      "workflow_type": "self_report",
      "definition": {
        "description": "청소년용 스마트폰 중독 자가진단 검사",
        "estimated_time": 5,
        "total_items": 15
      },
      "external_url": null
    }
  },
  {
    "id": "task-uuid-2",
    "assessment_id": "assessment-uuid-2",
    "status": "completed",
    "execution_method": "online",
    "started_at": "2026-02-11T10:00:00Z",
    "completed_at": "2026-02-11T10:15:00Z",
    "assessment": {
      "code": "DEPRESSION_SCALE",
      "kor_name": "우울척도검사",
      "workflow_type": "self_report",
      "definition": {
        "description": "우울 수준 평가",
        "estimated_time": 10,
        "total_items": 20
      },
      "external_url": null
    }
  }
]
```

**화면 표시**:
```
┌──────────────────────────────────────┐
│  AS-2026-0001 온라인 검사 목록         │
├──────────────────────────────────────┤
│ 1. [시작하기] 스마트폰중독검사          │
│    └ 예상 소요시간: 5분 (15문항)       │
│                                      │
│ 2. [완료됨] 우울척도검사 ✅            │
│    └ 완료일: 2026-02-11               │
└──────────────────────────────────────┘
  [검사 선택하여 시작]
```

**검사 상태별 표시**:
- **pending**: `[시작하기]` 버튼 - 클릭 가능
- **in_progress**: `[이어하기]` 버튼 - 진행 중
- **completed**: `[완료됨]` 라벨 - 비활성화, 체크 표시

**사용자 액션**:
- 검사 선택 (예: 스마트폰중독검사)
- `[시작하기]` 버튼 클릭

**화면 처리**:
- ✅ **1개 이상 검사**: 목록 표시
- ⚠️ **모두 완료**: "모든 검사가 완료되었습니다" → 케이스 목록으로 돌아가기
- ❌ **0개 검사**: "온라인 검사가 없습니다" → 직원 호출 안내

---

### Step 4: 검사 조회 (자동 시작)
**화면**: 검사 문항 화면

**API 호출**:
```http
GET /api/v1/centers/{center_id}/tasks/{task_id}
```

**Response**:
```json
{
  "id": "task-uuid-1",
  "status": "in_progress",
  "started_at": "2026-02-12T15:30:00Z",
  "assessment": {
    "code": "SMARTPHONE_ADDICTION",
    "kor_name": "스마트폰중독검사",
    "workflow_type": "self_report",
    "definition": {
      "description": "청소년용 스마트폰 중독 자가진단 검사",
      "estimated_time": 5,
      "total_items": 15,
      "questions": [
        {
          "question_number": 1,
          "question_text": "스마트폰 사용 시간을 줄이려고 해보지만...",
          "options": [...]
        },
        ...
      ]
    }
  }
}
```

**자동 처리**:
- ✅ `pending` 상태면 자동으로 `in_progress`로 전환
- ✅ 검사 문항(`definition.questions`) 반환
- ✅ 시작 시간(`started_at`) 자동 기록

**화면 표시**:
- assessment.definition.questions를 활용하여 문항 표시
- 진행률 표시 (0/15)

---

### Step 5: 검사 제출 (자동 완료)
**화면**: 문항 응답 화면

**사용자 액션**:
- 각 문항에 응답
- 마지막 문항까지 완료

**API 호출**:
```http
POST /api/v1/centers/{center_id}/tasks/{task_id}/submit
Content-Type: application/json

{
  "workflow_type": "self_report",
  "responses": [
    {"question_number": 1, "answer_value": 4},
    {"question_number": 2, "answer_value": 3},
    ...
    {"question_number": 15, "answer_value": 2}
  ],
  "current_item": 15
}
```

**Response**:
```json
{
  "id": "task-uuid-1",
  "status": "completed",
  "completed_at": "2026-02-12T15:45:00Z",
  "report_payload": {
    "scoring": {
      "total_score": 45.0,
      "max_total_score": 60,
      "subscales": {
        "일상생활장애": {
          "name": "일상생활장애",
          "raw_score": 25.0,
          "max_score": 28
        },
        ...
      }
    },
    "interpretation": {
      "risk_level": "high",
      "risk_label": "고위험사용자군",
      "summary": "스마트폰 중독 고위험군",
      "description": "스마트폰 사용으로 인해 일상생활에서 심각한 장애를 보이며...",
      "recommendations": [
        "전문 기관의 상담과 치료가 필요합니다",
        "즉시 전문가와 상담을 진행하세요"
      ]
    },
    "scored_at": "2026-02-12T15:45:00Z"
  },
  "assessment": {
    "code": "SMARTPHONE_ADDICTION",
    "kor_name": "스마트폰중독검사"
  }
}
```

**자동 처리**:
- ✅ 검사 완료 처리 (`status: completed`)
- ✅ 자동 채점 (self_report인 경우)
- ✅ PDF 보고서 생성 (Document 레코드 자동 등록)
- ✅ 완료 시간(`completed_at`) 자동 기록

**화면 처리**:
- ✅ 완료 메시지 표시: "검사가 완료되었습니다"
- ✅ 채점 결과 요약 표시 (선택사항)
- Step 3으로 돌아가기 (다음 검사 진행 가능)

---

## 🔄 전체 플로우 다이어그램

```
┌─────────────────────────────────────────────┐
│ [Step 1] 내담자 신원 확인                      │
│  - 이름 + 생년월일 입력                        │
│  - API: GET /clients/search                 │
└─────────────────┬───────────────────────────┘
                  │ client_id
                  │ (1명이면 자동 진행)
                  ↓
┌─────────────────────────────────────────────┐
│ [Step 2] 검사 케이스 목록 (선택적)              │
│  - 진행 가능한 케이스 조회                      │
│  - API: GET /by-client/{client_id}          │
│  - 1개면 자동 진행, 2개 이상이면 선택           │
└─────────────────┬───────────────────────────┘
                  │ case_id
                  ↓
┌─────────────────────────────────────────────┐
│ [Step 3] 온라인 검사 목록                      │
│  - 케이스 내 온라인 검사 표시                   │
│  - API: GET /tasks?execution_method=online  │
└─────────────────┬───────────────────────────┘
                  │ task_id
                  ↓
┌─────────────────────────────────────────────┐
│ [Step 4] 검사 조회 (자동 시작)                 │
│  - pending → in_progress 자동 전환           │
│  - 문항 정보 반환                             │
│  - API: GET /tasks/{task_id}                │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│ [Step 5] 검사 제출 (자동 완료)                 │
│  - 응답 제출 + 자동 채점 + PDF 생성            │
│  - API: POST /tasks/{task_id}/submit        │
└─────────────────┬───────────────────────────┘
                  │
                  ↓ (다음 검사 있으면)
              [Step 3] 으로 돌아가기
```

### 📱 최적화된 사용자 경험

**최소 클릭 시나리오** (이상적인 경우):
```
이름+생년월일 입력 → 검사 선택 → 문항 응답 → 완료
     (1명)        (1개 케이스)    (자동시작)   (자동완료)

총 3번의 사용자 액션으로 검사 완료 가능!
```

**일반 시나리오** (케이스 여러 개):
```
이름+생년월일 입력 → 케이스 선택 → 검사 선택 → 문항 응답 → 완료
     (1명)          (2개+)       (자동시작)   (자동완료)

총 4번의 사용자 액션
```

---

## ⚠️ 예외 상황 처리

### 1. 내담자를 찾을 수 없는 경우 (Step 1)
```
┌──────────────────────────────────────┐
│  ⚠️ 등록되지 않은 내담자입니다          │
│                                      │
│  입력하신 정보로 등록된 내담자를        │
│  찾을 수 없습니다.                    │
│                                      │
│  [다시 입력] [직원 호출]               │
└──────────────────────────────────────┘
```

### 2. 진행 가능한 케이스가 없는 경우 (Step 2)
```
┌──────────────────────────────────────┐
│  ⚠️ 진행 가능한 검사가 없습니다         │
│                                      │
│  현재 진행 가능한 검사 케이스가        │
│  없습니다. 직원에게 문의하세요.        │
│                                      │
│  [처음으로] [직원 호출]                │
└──────────────────────────────────────┘
```

### 3. 온라인 검사가 없는 경우 (Step 3)
```
┌──────────────────────────────────────┐
│  ℹ️ 온라인 검사가 없습니다              │
│                                      │
│  이 케이스는 센터 방문 검사만          │
│  포함되어 있습니다.                   │
│  직원에게 문의하세요.                 │
│                                      │
│  [케이스 목록으로] [직원 호출]          │
└──────────────────────────────────────┘
```

### 4. 모든 검사가 완료된 경우 (Step 3)
```
┌──────────────────────────────────────┐
│  ✅ 모든 검사가 완료되었습니다          │
│                                      │
│  이 케이스의 온라인 검사를 모두        │
│  완료하셨습니다.                      │
│                                      │
│  [케이스 목록으로] [종료]              │
└──────────────────────────────────────┘
```

### 5. 동명이인이 있는 경우 (Step 1)
```
┌──────────────────────────────────────┐
│  👥 여러 명이 검색되었습니다            │
├──────────────────────────────────────┤
│ ○ 홍길동 (2010-03-15)                │
│   연락처: 010-1234-5678               │
│                                      │
│ ○ 홍길동 (2010-03-15)                │
│   연락처: 010-9876-5432               │
└──────────────────────────────────────┘
  [본인 선택] [직원 호출]
```

---

## 🎯 프론트엔드 구현 포인트

### 1. 세션 관리
- Step 1에서 획득한 `client_id` 저장 (메모리/로컬스토리지)
- Step 2에서 선택한 `case_id` 저장
- Step 3에서 선택한 `task_id` 저장
- 뒤로가기 시 이전 Step으로 이동

**UX 최적화**:
- 검색 결과 1개 → 자동 진행 + 토스트 알림
- 케이스 1개 → 자동 진행 + 헤더에 케이스 정보 표시
- 불필요한 선택 화면 생략으로 클릭 단계 감소

### 2. 상태 표시
- **pending**: 시작 가능 (파란색 버튼)
- **in_progress**: 이어하기 가능 (주황색 버튼)
- **completed**: 완료 표시 (회색, 비활성화)

### 3. 사용성 개선
- 검사 예상 소요시간 표시 (`definition.estimated_time`)
- 진행률 표시 (current_item/total_items)
- 타임아웃 처리 (일정 시간 무응답 시 세션 종료)
- 로딩 상태 표시 (제출 중 중복 클릭 방지)

### 4. 자동 진행 로직 (권장)

**Step 1 → Step 2 자동 전환**:
```javascript
const clients = await searchClients(name, birthdate);

if (clients.length === 0) {
  showError("등록되지 않은 내담자입니다");
} else if (clients.length === 1) {
  // 자동 진행
  showToast(`${clients[0].name}님, 환영합니다`);
  navigateToStep2(clients[0].id);
} else {
  // 선택 화면 표시
  showClientSelector(clients);
}
```

**Step 2 → Step 3 자동 전환**:
```javascript
const cases = await getCasesByClient(clientId);

if (cases.length === 0) {
  showError("진행 가능한 검사가 없습니다");
} else if (cases.length === 1) {
  // 자동 진행
  setHeaderInfo(cases[0]); // 케이스 정보 헤더에 표시
  navigateToStep3(cases[0].id);
} else {
  // 선택 화면 표시
  showCaseSelector(cases);
}
```

### 5. 접근성
- 큰 폰트 사용 (태블릿 환경)
- 터치 친화적 UI (버튼 크기)
- 간단한 안내 문구
- 음성 안내 옵션 (선택사항)

---

## 📊 API 호출 순서 요약

```
1. GET  /clients/search?name=X&birthdate=Y
   → client_id 획득

2. GET  /assessment-cases/by-client/{client_id}?status=pending,processing
   → case_id 선택

3. GET  /assessment-cases/{case_id}/tasks?execution_method=online
   → task_id 선택

4. GET  /tasks/{task_id}
   → 검사 조회 (자동 시작, 문항 정보 반환)

5. POST /tasks/{task_id}/submit
   → 검사 제출 (자동 완료 + 채점 + PDF 생성)

6. (반복) 3번으로 돌아가서 다음 검사 진행
```

---

## 🔒 보안 고려사항

1. **인증**: 관리자 로그인 상태 유지 (토큰 검증)
2. **권한**: read:client, read:assessment 권한 필요
3. **center_id 격리**: 다른 센터 데이터 접근 불가
4. **민감 정보**: 생년월일 마스킹 옵션 고려
5. **세션 타임아웃**: 일정 시간 무응답 시 자동 로그아웃

---

## 📝 참고사항

- **원격 검사 vs 센터 방문 검사**:
  - 원격: `send_link` 모듈 사용 (SMS/카카오톡)
  - 센터 방문: 본 플로우 사용 (execution_method="online")

- **execution_method 구분**:
  - `online`: 센터 방문하여 온라인으로 진행
  - `onsite`: 센터 방문하여 오프라인(종이/대면) 진행
  - Step 3에서 `execution_method=online` 필터링 필수

- **검사 타입**:
  - `self_report`: 자가보고식 (자동 채점)
  - `external_service`: 외부 서비스 연동

---

**작성일**: 2026-02-12
**최종 업데이트**: 2026-02-12
