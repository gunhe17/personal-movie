# 도메인 모델 설계 (Domain Model Design)

## 📐 아키텍처 개요

### Multi-tenancy 구조
이 시스템은 **Schema-based Multi-tenancy** 패턴을 사용합니다.

```
PostgreSQL Database
├── public schema (Global)          # 모든 센터가 공유하는 마스터 데이터
│   ├── centers                     # 센터 정보
│   ├── assessments                 # 검사 템플릿
│   ├── assessment_items            # 검사 문항
│   ├── assessment_scoring_rules    # 채점 규칙
│   └── assessment_requests         # 검사 추가 요청
│
├── center_gangnam schema (Tenant)  # 강남센터 전용 데이터
│   ├── assessment_cases            # 검사 케이스
│   ├── assessment_sessions         # 검사 세션
│   ├── assessment_tasks            # 개별 검사 수행
│   ├── assessment_schedules        # 일정 관리
│   ├── assessment_packages         # 검사 패키지
│   ├── assessment_send_links       # 바로링크
│   ├── assessment_final_reports    # 종합 보고서
│   └── documents                   # 문서 관리
│
└── center_seocho schema (Tenant)   # 서초센터 전용 데이터
    └── (동일한 테이블 구조)
```

**특징**:
- **데이터 격리**: 센터별 독립된 Schema로 완전한 데이터 격리
- **보안 강화**: 센터 간 데이터 접근 불가
- **확장 용이**: 신규 센터 추가 시 Schema만 생성
- **백업 유연**: 센터별 독립적인 백업/복구

---

## 🌍 Global Schema (공통 마스터 데이터)

### 1. Center (센터)
**테이블**: `public.centers`

**역할**: 플랫폼에 등록된 센터 정보 관리

**주요 필드**:
```python
uid: UUID              # Primary Key
center_id: str         # 센터 식별자 (예: "gangnam_center")
name: str              # 센터 이름 (예: "강남심리상담센터")
is_active: bool        # 활성화 여부
schema_name: str       # 테넌트 스키마명 (예: "center_gangnam")
```

**특징**:
- 센터 생성 시 해당 센터용 tenant schema 자동 생성
- API 요청 시 `center_id`로 접근 → 내부적으로 `center_uid`(UUID) 사용

---

### 2. Assessment (검사 템플릿)
**테이블**: `public.assessments`

**역할**: 심리검사 마스터 정보 (모든 센터가 사용 가능한 검사 목록)

**주요 필드**:
```python
uid: UUID                           # Primary Key
code: str                           # 검사 코드 (예: "MMPI-2", "K-WISC-IV")
eng_name: str                       # 영문명
kor_name: str                       # 한글명
description: str                    # 검사 설명

# 검사 특성
assessment_type: Enum               # 투사적/지능/객관적/발달검사
target_age_group: str              # 대상 연령 (예: "6-16세")
estimated_duration_minutes: int    # 예상 소요시간

# 기능 플래그
is_online_available: bool          # 온라인 실시 가능 여부
is_ai_supported: bool              # AI 채점 지원 여부
has_standard_report: bool          # 표준 보고서 제공
supports_self_scoring: bool        # 자가 채점 지원
supports_report_upload: bool       # 보고서 업로드 가능
external_assessment_url: str       # 외부 검사 URL (있는 경우)

# 공개 여부
status: Enum                        # private/public
```

**검사 유형**:
- **PROJECTIVE** (투사적 검사): 로샤, TAT, HTP, KFD 등
- **INTELLIGENCE** (지능검사): K-WISC, K-WAIS 등
- **OBJECTIVE** (객관적 검사): MMPI, SCT, MBTI 등
- **DEVELOPMENTAL** (발달검사): 영유아 발달 검사 등

---

### 3. AssessmentItem (검사 문항)
**테이블**: `public.assessment_items`

**역할**: 각 검사의 실제 문항 데이터

**주요 필드**:
```python
uid: UUID                    # Primary Key
assessment_uid: UUID         # 소속 검사 (FK)

# 문항 정보
item_number: int             # 문항 번호 (1, 2, 3, ...)
question_text: str           # 문항 내용
question_type: str           # likert_4, likert_5, yes_no, multiple_choice, text
options: JSONB               # 선택지 목록 (예: [{"value": 1, "label": "전혀 아니다"}, ...])

# 설정
is_required: bool            # 필수 응답 여부
is_reverse_scored: bool      # 역채점 문항 여부
subscale: str                # 하위척도/요인 (예: "일상생활장애", "금단")
display_order: int           # 화면 표시 순서
```

**예시 - Likert 4점 척도**:
```json
{
  "question_text": "나는 스마트폰 없이는 생활이 불편하다",
  "question_type": "likert_4",
  "options": [
    {"value": 1, "label": "전혀 그렇지 않다"},
    {"value": 2, "label": "그렇지 않다"},
    {"value": 3, "label": "그렇다"},
    {"value": 4, "label": "매우 그렇다"}
  ]
}
```

---

### 4. AssessmentScoringRule (채점 규칙)
**테이블**: `public.assessment_scoring_rules`

**역할**: 검사별 채점 방식 및 해석 기준 정의

**주요 필드**:
```python
uid: UUID                           # Primary Key
assessment_uid: UUID                # 소속 검사 (FK)

# 채점 규칙
scoring_method: str                 # sum, average, weighted
subscale: str                       # 하위척도명 (NULL이면 총점)
rule_config: JSONB                  # 채점 상세 설정
interpretation_criteria: JSONB      # 점수 해석 기준
interpretation_text: str            # 해석 설명 텍스트
```

**rule_config 예시**:
```json
{
  "items": [1, 5, 9, 12, 13],      // 해당 subscale 문항 번호
  "reverse_items": [13],            // 역채점 문항
  "weight": 1.0                     // 가중치 (선택)
}
```

**interpretation_criteria 예시**:
```json
[
  {"min": 0, "max": 13, "level": "일반", "description": "정상 범위"},
  {"min": 14, "max": 15, "level": "잠재적위험", "description": "주의 필요"},
  {"min": 16, "max": 20, "level": "고위험", "description": "전문가 상담 권장"}
]
```

---

### 5. AssessmentRequest (검사 추가 요청)
**테이블**: `public.assessment_requests`

**역할**: 센터에서 새로운 검사 추가를 요청하는 기능

**주요 필드**:
```python
uid: UUID                      # Primary Key
description: str               # 요청 내용
requested_by_center: UUID      # 요청 센터
requested_by_account: UUID     # 요청자
confirmed: bool                # 승인 여부
confirmed_at: datetime         # 승인 일시
confirmed_by_account: UUID     # 승인자
```

---

## 🏢 Tenant Schema (센터별 독립 데이터)

### 1. AssessmentCase (검사 케이스)
**테이블**: `center_xxx.assessment_cases`

**역할**: 센터의 검사 케이스 관리 (내담자 1명의 검사 세트)

**주요 필드**:
```python
uid: UUID                          # Primary Key
case_code: str                     # 케이스 코드 (예: "250107-001")
center_uid: UUID                   # 소속 센터

# 내담자 정보 (스냅샷)
client_uid: UUID                   # 내담자 UID (향후 FK 연결용)
client_snapshot: JSONB             # 내담자 정보 스냅샷

# 담당자 정보
assigned_specialist_uid: UUID      # 담당 전문가
specialist_snapshot: JSONB         # 전문가 정보 스냅샷

# 검사 정보
assessment_uids: Array[UUID]       # 실시할 검사 목록
assessment_snapshots: JSONB        # 검사 정보 스냅샷 (이름 등)
package: JSONB                     # 검사 패키지 정보 (있는 경우)

# 케이스 설정
case_type: Enum                    # INDIVIDUAL(개별) / GROUP(집단)
require_final_report: bool         # 종합보고서 필요 여부
organization_name: str             # 소속 기관 (집단검사 시)

# 문서 연결
document_ids: Array[str]           # 연결된 문서 ID 목록

# 상태 관리
status: Enum                       # PENDING/PROCESSING/COMPLETED/CANCELLED
completed_at: datetime             # 완료 일시
```

**상태 흐름**:
```
PENDING (대기)
    ↓ 검사 시작
PROCESSING (진행중)
    ↓ 모든 검사 완료
COMPLETED (완료)

또는 CANCELLED (취소)
```

**스냅샷 패턴**:
- **client_snapshot**: 내담자 정보를 케이스 생성 시점에 저장
  - 장점: JOIN 없이 빠른 조회, 과거 데이터 보존 (이름 변경 등)
- **specialist_snapshot**: 담당자 정보 저장
- **assessment_snapshots**: 검사명 등 표시용 데이터

---

### 2. AssessmentSession (검사 세션)
**테이블**: `center_xxx.assessment_sessions`

**역할**: 케이스 내 검사 실시 회기 관리 (1회기, 2회기 등)

**주요 필드**:
```python
uid: UUID                    # Primary Key
center_uid: UUID             # 소속 센터
case_uid: UUID               # 소속 케이스 (FK)

# 일정 정보
scheduled_at: datetime       # 예약 일시
started_at: datetime         # 시작 일시
completed_at: datetime       # 완료 일시

# 상태
status: Enum                 # SCHEDULED/ATTENDED/NOSHOW/CANCELLED
```

**상태 설명**:
- **SCHEDULED**: 예약됨
- **ATTENDED**: 참석함
- **NOSHOW**: 불참
- **CANCELLED**: 취소됨

**사용 시나리오**:
```
Case 생성 → Session 자동 생성 → Schedule 생성 (일정 잡기)
→ 검사 실시 (Task 수행) → Session 완료
```

---

### 3. AssessmentTask (개별 검사 수행)
**테이블**: `center_xxx.assessment_tasks`

**역할**: 케이스 내 각 검사의 실제 수행 및 결과 관리

**주요 필드**:
```python
assessment_uid: UUID         # 검사 UID (복합 PK)
case_uid: UUID               # 케이스 UID (복합 PK)
center_uid: UUID             # 소속 센터

# 진행 정보
process: JSONB               # 진행 상태 상세 (응답 데이터, 진행률 등)
status: Enum                 # PENDING/PROCESSING/COMPLETED/NOT_COMPLETED/CANCELLED

# 보고서 정보
report_payload: JSONB        # 검사 보고서 데이터
report_visible_to_guardian: bool  # 보호자 열람 가능 여부

# 완료 정보
completed_at: datetime       # 완료 일시
```

**상태 흐름**:
```
PENDING (대기)
    ↓ 검사 시작
PROCESSING (진행중)
    ↓ 검사 완료
COMPLETED (완료)

또는 NOT_COMPLETED (미완료 - 중단)
또는 CANCELLED (취소)
```

**process 필드 예시**:
```json
{
  "responses": [
    {"item_number": 1, "value": 3},
    {"item_number": 2, "value": 2}
  ],
  "progress_percentage": 75,
  "current_item": 15,
  "total_items": 20
}
```

---

### 4. AssessmentSchedule (일정 관리)
**테이블**: `center_xxx.assessment_schedules`

**역할**: 검사 세션의 구체적인 일정 정보

**주요 필드**:
```python
uid: UUID                          # Primary Key
center_uid: UUID                   # 소속 센터
session_uid: UUID                  # 소속 세션 (FK)

# 일정 정보
start_time: datetime               # 시작 시간
end_time: datetime                 # 종료 시간
assigned_specialist_uid: UUID      # 담당 전문가
room_name: str                     # 검사실 이름

# 메모
notes: str                         # 일정 메모
```

**Session vs Schedule 차이**:
- **Session**: 논리적 회기 (1회기, 2회기)
- **Schedule**: 실제 예약 일정 (2025-01-10 14:00-16:00)

---

### 5. AssessmentPackage (검사 패키지)
**테이블**: `center_xxx.assessment_packages`

**역할**: 자주 사용하는 검사 조합을 패키지로 관리

**주요 필드**:
```python
uid: UUID                    # Primary Key
center_uid: UUID             # 소속 센터
name: str                    # 패키지명 (예: "종합심리평가")
description: str             # 패키지 설명
deleted_at: datetime         # Soft delete
```

**AssessmentPackageRelation**:
```python
package_uid: UUID            # 패키지 UID (복합 PK)
assessment_uid: UUID         # 검사 UID (복합 PK)
```

**사용 예시**:
```
"아동 종합심리평가" 패키지
  ├── K-WISC-IV (지능검사)
  ├── HTP (투사적 검사)
  └── MMPI-A (객관적 검사)
```

---

### 6. AssessmentSendLink (바로링크)
**테이블**: `center_xxx.assessment_send_links`

**역할**: 온라인 검사 바로링크 생성 및 관리

**주요 필드**:
```python
uid: UUID                    # Primary Key
unique_token: str            # 고유 토큰 (URL용)
center_uid: UUID             # 소속 센터
case_uid: UUID               # 연결된 케이스

# 수신자 정보
recipients: JSONB            # 수신자 목록 (이메일, 전화번호 등)

# 유효기간
expired_at: datetime         # 만료 일시
```

**recipients 예시**:
```json
[
  {
    "type": "email",
    "value": "parent@example.com",
    "sent_at": "2025-01-10T10:00:00Z"
  },
  {
    "type": "sms",
    "value": "010-1234-5678",
    "sent_at": "2025-01-10T10:00:00Z"
  }
]
```

**URL 형식**:
```
https://example.com/assessment/take/{unique_token}
```

---

### 7. AssessmentFinalReport (종합 보고서)
**테이블**: `center_xxx.assessment_final_reports`

**역할**: 케이스의 모든 검사를 종합한 최종 보고서

**주요 필드**:
```python
uid: UUID                    # Primary Key
center_uid: UUID             # 소속 센터
case_uid: UUID               # 연결된 케이스 (UK)
payload: JSONB               # 보고서 내용 (JSON 형식)
```

**payload 예시**:
```json
{
  "summary": "종합 요약...",
  "recommendations": "권고 사항...",
  "sections": [
    {
      "title": "지능검사 결과",
      "content": "...",
      "assessment_uid": "..."
    }
  ]
}
```

---

### 8. Document (문서 관리)
**테이블**: `center_xxx.documents`

**역할**: 센터별 파일(보고서, 첨부파일 등) 관리

**주요 필드**:
```python
uid: UUID                       # Primary Key
center_uid: UUID                # 소속 센터

# 파일 정보
filename: str                   # 저장 파일명 (UUID 기반)
original_filename: str          # 원본 파일명
file_size: int                  # 파일 크기 (bytes)
content_type: str               # MIME type (예: "application/pdf")

# 저장 위치
storage_path: str               # S3 key or 파일 경로
storage_type: str               # s3, local

# 분류
document_type: str              # report, attachment, image
related_entity_type: str        # case, task, session
related_entity_uid: UUID        # 연결된 엔티티 UID

# 메타
uploaded_at: datetime           # 업로드 일시
deleted_at: datetime            # Soft delete
```

**사용 시나리오**:
- 검사 보고서 PDF 업로드
- 케이스 관련 첨부파일
- 프로필 사진 등

---

## 🔗 도메인 관계도

```
[Global Schema - public]
┌─────────┐
│ Center  │
└────┬────┘
     │ has many
     ↓
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ Assessment   │────→│ AssessmentItem   │     │ AssessmentScoringRule   │
│              │     │                  │     │                         │
│ (검사 템플릿) │     │ (문항)            │     │ (채점 규칙)              │
└──────────────┘     └──────────────────┘     └─────────────────────────┘
       ↑
       │ refers to
       │
[Tenant Schema - center_xxx]
┌──────────────────┐
│ AssessmentCase   │
│                  │
│ (검사 케이스)     │
└────┬────┬────────┘
     │    │
     │    └──────────────────┐
     │                       │
     ↓ has many             ↓ has many
┌──────────────────┐   ┌──────────────────┐
│ AssessmentSession│   │ AssessmentTask   │
│                  │   │                  │
│ (세션/회기)       │   │ (개별 검사 수행)  │
└────┬─────────────┘   └──────────────────┘
     │
     ↓ has one
┌──────────────────┐
│AssessmentSchedule│
│                  │
│ (일정 정보)       │
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│AssessmentPackage │────→│ PackageRelation  │
│                  │     │                  │
│ (검사 패키지)     │     │ (패키지-검사 관계) │
└──────────────────┘     └──────────────────┘

┌──────────────────┐
│AssessmentSendLink│
│                  │
│ (바로링크)        │
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│AssessmentCase    │────→│AssessmentFinal   │
│                  │     │      Report      │
└──────────────────┘     └──────────────────┘

┌──────────────────┐
│    Document      │
│                  │
│ (문서 관리)       │
└──────────────────┘
```

---

## 🔄 주요 워크플로우

### 1. 검사 케이스 생성 및 진행

```
1. 케이스 생성 (AssessmentCase)
   └─ client_snapshot, specialist_snapshot 저장
   └─ assessment_uids 설정 (개별 또는 패키지)

2. Session 자동 생성 (AssessmentSession)
   └─ status: SCHEDULED

3. Task 자동 생성 (AssessmentTask)
   └─ assessment_uids 각각에 대해 Task 생성
   └─ status: PENDING

4. Schedule 생성 (AssessmentSchedule) - 옵션
   └─ 구체적인 일정 잡기

5. 검사 실시
   └─ Task.status: PROCESSING
   └─ Task.process에 응답 저장

6. 검사 완료
   └─ Task.status: COMPLETED
   └─ Task.report_payload에 결과 저장

7. 모든 Task 완료 시
   └─ Session.status: ATTENDED
   └─ Case.status: COMPLETED

8. 종합 보고서 작성 (옵션)
   └─ AssessmentFinalReport 생성
```

### 2. 온라인 검사 바로링크 발송

```
1. 케이스 생성 (AssessmentCase)

2. 바로링크 생성 (AssessmentSendLink)
   └─ unique_token 생성
   └─ recipients에 수신자 정보 저장
   └─ expired_at 설정

3. 링크 발송 (이메일/SMS)
   └─ recipients 정보 업데이트 (sent_at)

4. 내담자 접속
   └─ token 검증
   └─ 만료 여부 확인

5. 온라인 검사 실시
   └─ Task.process에 응답 저장
   └─ Task.status 업데이트

6. 검사 완료
   └─ Task.status: COMPLETED
```

### 3. 검사 패키지 사용

```
1. 패키지 생성 (AssessmentPackage)
   └─ name, description 설정

2. 검사 추가 (AssessmentPackageRelation)
   └─ package_uid ↔ assessment_uid 매핑

3. 케이스 생성 시 패키지 선택
   └─ 패키지에 포함된 모든 검사 자동 설정
   └─ Case.package에 패키지 정보 스냅샷
   └─ Case.assessment_uids 자동 채워짐
```

---

## 📊 데이터 관리 전략

### 1. 스냅샷 패턴 (Denormalization)
**목적**: 과거 데이터 보존, 조회 성능 향상

**적용 대상**:
- `AssessmentCase.client_snapshot`: 내담자 정보
- `AssessmentCase.specialist_snapshot`: 담당자 정보
- `AssessmentCase.assessment_snapshots`: 검사 이름 등

**장점**:
- JOIN 없이 빠른 조회
- 과거 시점 데이터 보존 (이름 변경 등)
- 향후 Client/Member 도메인 추가 시 FK로 전환 가능

### 2. Multi-tenancy 데이터 격리
**방법**: Schema 단위 분리

**장점**:
- 완전한 데이터 격리 (보안)
- 센터별 독립적인 백업/복구
- 센터별 스키마 커스터마이징 가능

**주의사항**:
- 마이그레이션 시 모든 센터 schema 업데이트 필요
- Cross-tenant 쿼리 불가 (통계는 별도 집계)

### 3. Soft Delete
**적용 대상**:
- `AssessmentPackage`: deleted_at
- `Document`: deleted_at

**이유**: 완전 삭제보다 논리 삭제로 데이터 보존

### 4. Audit Trail
**BaseModel**: uid, created_at, updated_at
**AuditMixin**: modified_by_account, modified_by_person

**목적**: 모든 데이터 변경 이력 추적

---

## 🚀 향후 확장 계획

### Phase 1: 현재 구현 상태
- ✅ Multi-tenancy 구조
- ✅ 검사 관리 (Assessment, Item, ScoringRule)
- ✅ 케이스/세션/태스크 워크플로우
- ✅ 문서 관리
- ✅ 바로링크

### Phase 2: 계획 중인 도메인
- ⏳ **Client** (내담자 마스터)
- ⏳ **Member** (직원/전문가 마스터)
- ⏳ **AssessmentResponse** (응답 데이터 독립 테이블)
- ⏳ **AssessmentResult** (채점 결과 독립 테이블)
- ⏳ **Notification** (알림)
- ⏳ **Appointment** (예약 관리)

### Phase 3: 고도화
- 🔮 통계/분석 도메인
- 🔮 권한 관리 (RBAC)
- 🔮 결제/구독 관리
- 🔮 센터별 커스터마이징

---

## 📝 개발 시 주의사항

1. **센터 권한 검증 필수**: 모든 tenant 데이터 접근 시 center_uid 검증
2. **스냅샷 일관성**: 생성/수정 시 스냅샷 데이터 동기화
3. **상태 전이 검증**: Enum 상태 변경 시 유효한 전이인지 확인
4. **트랜잭션 관리**: 여러 테이블 동시 수정 시 트랜잭션 보장
5. **마이그레이션**: tenant schema 모두 업데이트 필요
6. **N+1 쿼리 방지**: 서브쿼리 또는 join으로 최적화

---

**작성일**: 2025-01-13
**버전**: 1.0
**작성자**: Development Team
