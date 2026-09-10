# 상담센터 SaaS 플랫폼 - 도메인 아키텍처

> 멀티테넌트 상담센터 운영 플랫폼의 전체 도메인 모델 설계

---

## 1. 모듈 아키텍처 개요

### 모듈 계층 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  Foundation Layer (기반 계층)                                    │
│  ─────────────────────────────────────────────────────────────  │
│  • Auth & Tenant: 인증, 인가, 멀티테넌시                         │
│  • Client: 내담자 관리                                          │
│  • Resource: 공통 리소스 (Room 등)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Core Domain Layer (핵심 도메인)                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Assessment: 검사 관리 (복잡도 ★★★★★)                       │
│  • Counseling: 상담 관리 (복잡도 ★★★)                         │
│  • Schedule: 일정 관리 - Polymorphic (복잡도 ★★)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Business Support Layer (비즈니스 지원)                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Billing: 결제/청구 관리                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 모듈 간 의존성

```
Client ←─── Assessment ───→ Schedule
  ↓            ↓               ↓
  └──────→ Counseling ────→ Schedule
             ↓                ↓
          Billing ←──────────┘
             ↓
          Voucher

Auth & Tenant → (모든 모듈에 적용)
Resource (Room) → Schedule
```

---

## 2. Main Module 정의

### 2.1. Auth & Tenant (인증 & 멀티테넌시)

**목적**: 플랫폼 인증, 권한 관리, 멀티테넌트 격리

**서브모듈 구조**:
```
auth/
├── user/           # 사용자 관리
├── center/         # 센터(테넌트) 관리
└── permission/     # 권한 관리
```

**핵심 엔티티**:

#### User (사용자)
```python
class User(BaseModel):
    __tablename__ = "users"

    # Identity
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Role
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # admin, counselor, intern

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relations
    # center_memberships: relationship to CenterMember
```

**역할 체계**:
- `platform_admin`: 플랫폼 관리자 (전역 권한)
- `center_admin`: 센터 관리자 (센터 내 모든 권한)
- `counselor`: 상담사 (담당 업무 관리)
- `intern`: 실습생 (읽기 전용)

#### Center (센터 - 테넌트)
```python
class Center(BaseModel):
    __tablename__ = "centers"

    # Identity
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Info
    business_number: Mapped[str | None] = mapped_column(String(20))
    phone: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    subscription_plan: Mapped[str] = mapped_column(String(50))  # free, basic, pro
```

#### CenterMember (센터 구성원)
```python
class CenterMember(BaseModel):
    __tablename__ = "center_members"

    # Relations
    center_id: Mapped[int] = mapped_column(ForeignKey("centers.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Role in Center
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("center_id", "user_id"),)
```

**테넌트 격리 전략**: Row-level Multi-tenancy
- 모든 테넌트 데이터는 `center_id` 컬럼으로 격리
- 전역 데이터(Assessment 템플릿 등)는 `center_id` 없음

---

### 2.2. Client (내담자 관리)

**목적**: 서비스를 받는 대상 관리

**서브모듈 구조**:
```
client/
└── main/           # Client 단일 엔티티
```

**핵심 엔티티**:

#### Client (내담자)
```python
class Client(BaseModel, TenantModel):
    __tablename__ = "clients"

    # Identity
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Personal Info
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))  # male, female, other
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))

    # Note
    note: Mapped[str | None] = mapped_column(Text)

    # Relations
    # counselings: relationship to Counseling
    # assessments: relationship to Assessment
```

**비즈니스 규칙**:
- 센터 내에서만 접근 가능 (center_id로 격리)
- 개인정보 보호 정책 적용 (GDPR 고려)

---

### 2.3. Assessment (검사 관리) ⭐

**목적**: 심리검사의 전체 라이프사이클 관리

**서브모듈 구조**:
```
assessment/
├── template/       # 검사 템플릿 마스터
├── case/           # 검사 케이스 (개별 검사 건)
├── session/        # 검사 세션 (회기)
├── task/           # 개별 검사 수행
├── package/        # 검사 패키지
├── link/           # 바로링크 (온라인 검사)
└── report/         # 종합 보고서
```

**계층 구조**:
```
Global Layer (플랫폼 공통)
  └── Assessment (검사 템플릿)
       ├── AssessmentItem (문항)
       └── AssessmentScoringRule (채점 규칙)

Center Layer (센터별 독립)
  ├── AssessmentStatus (센터별 활성화)
  ├── AssessmentPackage (검사 패키지)
  │    └── AssessmentPackageRelation (N:M)
  └── AssessmentCase (검사 케이스) ⭐
       ├── AssessmentSession (검사 세션)
       ├── AssessmentTask (개별 검사 수행)
       ├── AssessmentSendLink (바로링크)
       └── AssessmentFinalReport (종합 보고서)
```

**핵심 엔티티**:

#### Assessment (검사 템플릿 - Global)
```python
class Assessment(BaseModel):
    __tablename__ = "assessments"

    # Identity
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    eng_name: Mapped[str] = mapped_column(String(200), nullable=False)
    kor_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Type & Target
    assessment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 투사적/지능/객관적/지능발달
    target_age_group: Mapped[str | None] = mapped_column(String(100))
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer)

    # Capabilities
    is_online_available: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ai_supported: Mapped[bool] = mapped_column(Boolean, default=False)

    # Report & Scoring
    has_standard_report: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_self_scoring: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_report_upload: Mapped[bool] = mapped_column(Boolean, default=False)
    external_assessment_url: Mapped[str | None] = mapped_column(String(500))

    # Status
    status: Mapped[str] = mapped_column(String(20), default="private")  # private, public
    owner_center_id: Mapped[int | None] = mapped_column(Integer)  # PRIVATE인 경우 소유 센터

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
```

#### AssessmentCase (검사 케이스 - Tenant)
```python
class AssessmentCase(BaseModel, TenantModel):
    __tablename__ = "assessment_cases"

    # Identity
    case_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Actor
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    assigned_specialist_id: Mapped[int | None] = mapped_column(Integer)

    # Assessment (Snapshot 패턴)
    assessment_ids: Mapped[list] = mapped_column(ARRAY(Integer), nullable=False)
    assessment_snapshots: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # Package (Snapshot)
    package_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_packages.id"))
    package_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    # Client/Specialist Snapshot
    client_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    specialist_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    # Type
    case_type: Mapped[str] = mapped_column(String(20), nullable=False)  # individual, group, organization
    organization_name: Mapped[str | None] = mapped_column(String(200))

    # Report
    require_final_report: Mapped[bool] = mapped_column(Boolean, default=False)

    # Note: 문서는 Document 도메인에서 역방향 조회
    # Document.entity_type = "assessment_case", Document.entity_id = case.id

    # Status
    status: Mapped[str] = mapped_column(String(20), default="active")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
```

**주요 비즈니스 규칙**:
- **Snapshot 패턴**: 검사 정보를 스냅샷으로 저장하여 히스토리 보존
- **다양한 검사 유형 지원**: 개별, 그룹, 기관 검사
- **온라인/오프라인 혼합**: 바로링크(온라인) + 오프라인 검사
- **AI 자동 분석**: AI 지원 검사에 대한 자동 채점/분석

*상세 스키마는 `docs/assessment/schema.md` 참조*

---

### 2.4. Counseling (상담 관리)

**목적**: 상담 서비스 제공 및 일지 관리

**서브모듈 구조**:
```
counseling/
├── contract/       # 상담 계약
└── session/        # 상담 세션 (회기)
```

**핵심 엔티티**:

#### Counseling (상담 계약)
```python
class Counseling(BaseModel, TenantModel):
    __tablename__ = "counselings"

    # Relations
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    counselor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Type
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # individual, group, couple
    type_description: Mapped[str | None] = mapped_column(Text)

    # Contract
    total_sessions: Mapped[int] = mapped_column(Integer, default=20)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, cancelled
```

#### CounselingSession (상담 세션)
```python
class CounselingSession(BaseModel, TenantModel):
    __tablename__ = "counseling_sessions"

    # Relations
    counseling_id: Mapped[int] = mapped_column(ForeignKey("counselings.id"), nullable=False)
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id"))

    # Session Number (자동 계산)
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    # scheduled, completed, no_show, cancelled

    # 상담 일지
    goal: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    private_memo: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (UniqueConstraint("counseling_id", "session_number"),)
```

**비즈니스 규칙**:
- **회기 자동 넘버링**: counseling 내에서 1, 2, 3... 자동 계산
- **출석 처리 → 결제 자동 생성**: `completed` 상태로 변경 시 `PaymentRecord` 자동 생성
- **일지 작성**: 상담 종료 후 goal/content/summary 작성

---

### 2.5. Schedule (일정 관리) - Polymorphic

**목적**: 상담/검사 등 다양한 도메인의 일정 통합 관리

**서브모듈 구조**:
```
schedule/
└── main/           # Schedule 단일 엔티티
```

**핵심 엔티티**:

#### Schedule (일정)
```python
class Schedule(BaseModel, TenantModel):
    __tablename__ = "schedules"

    # Polymorphic Relations
    related_type: Mapped[str] = mapped_column(String(20), nullable=False)  # ASSESSMENT, COUNSELING
    related_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Time
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Resource
    assigned_specialist_id: Mapped[int | None] = mapped_column(Integer)
    room_name: Mapped[str | None] = mapped_column(String(100))

    # Status
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("idx_schedule_related", "related_type", "related_id"),)
```

**Polymorphic 패턴**:
```
Schedule
  ↓ (related_type='ASSESSMENT', related_id=123)
  └─→ AssessmentSession

Schedule
  ↓ (related_type='COUNSELING', related_id=456)
  └─→ CounselingSession
```

**비즈니스 규칙**:
- 일정과 세션은 독립적 (일정 먼저 생성 후 나중에 연결 가능)
- 일정 변경 시 세션은 영향 없음 (schedule_id 유지)

---

### 2.6. Billing (결제/청구 관리)

**목적**: 서비스 제공에 대한 결제/청구 처리

**서브모듈 구조**:
```
billing/
├── payment/        # 결제 기록
└── voucher/        # 바우처 마스터
```

**핵심 엔티티**:

#### PaymentRecord (결제 기록)
```python
class PaymentRecord(BaseModel, TenantModel):
    __tablename__ = "payment_records"

    # Session Relations (Polymorphic)
    counseling_session_id: Mapped[int | None] = mapped_column(ForeignKey("counseling_sessions.id"))
    assessment_session_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_sessions.id"))

    # 역정규화 (조회 편의)
    counseling_id: Mapped[int | None] = mapped_column(ForeignKey("counselings.id"))
    assessment_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_cases.id"))

    # Payment Type
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # voucher, self_pay
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    # Amount
    amount: Mapped[int] = mapped_column(Integer, default=0)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending, paid, refunded, cancelled

    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "(counseling_session_id IS NOT NULL AND assessment_session_id IS NULL) OR "
            "(counseling_session_id IS NULL AND assessment_session_id IS NOT NULL) OR "
            "(counseling_session_id IS NULL AND assessment_session_id IS NULL)"
        ),
    )
```

#### Voucher (바우처 마스터)
```python
class Voucher(BaseModel, TenantModel):
    __tablename__ = "vouchers"

    # Info
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # 발달재활서비스, 마음투자 등
    description: Mapped[str | None] = mapped_column(Text)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

**비즈니스 규칙**:
- **서비스와 결제 분리**: 출석 처리와 결제 처리는 독립적
- **자동 결제 생성**: 세션 `completed` → `PaymentRecord(pending)` 자동 생성
- **바우처 청구**: 월말 일괄 청구 워크플로우
- **자부담**: 즉시 결제 가능

---

### 2.7. Resource (리소스 관리)

**목적**: 센터 운영에 필요한 물리적 리소스 관리

**서브모듈 구조**:
```
resource/
└── room/           # 상담실/검사실
```

**핵심 엔티티**:

#### Room (상담실)
```python
class Room(BaseModel, TenantModel):
    __tablename__ = "rooms"

    # Info
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

---

## 3. 데이터베이스 스키마 요약

### 테넌트 격리 전략

#### Global Tables (center_id 없음)
- `users`
- `centers`
- `center_members`
- `assessments` (검사 템플릿)
- `assessment_items`
- `assessment_scoring_rules`

#### Tenant Tables (center_id 있음)
- `clients`
- `counselings`
- `counseling_sessions`
- `assessment_cases`
- `assessment_sessions`
- `assessment_tasks`
- `assessment_packages`
- `assessment_send_links`
- `assessment_final_reports`
- `schedules`
- `payment_records`
- `vouchers`
- `rooms`

### 인덱스 전략

**성능 최적화를 위한 주요 인덱스**:
```sql
-- 테넌트 격리
CREATE INDEX idx_clients_center_id ON clients(center_id);
CREATE INDEX idx_counselings_center_id ON counselings(center_id);

-- 관계 조회
CREATE INDEX idx_counseling_sessions_counseling_id ON counseling_sessions(counseling_id);
CREATE INDEX idx_payment_records_counseling_id ON payment_records(counseling_id);

-- 날짜 범위 조회 (스케줄)
CREATE INDEX idx_schedules_start_time ON schedules(center_id, start_time);

-- Polymorphic 관계
CREATE INDEX idx_schedule_related ON schedules(related_type, related_id);

-- 상태별 필터링
CREATE INDEX idx_payment_records_status ON payment_records(center_id, status);
```

---

## 4. 모듈 간 통신 패턴

### 4.1. 이벤트 기반 통신

**출석 처리 → 결제 생성**:
```python
# counseling/session/service.py
async def complete_session(session_id: int, uow: UnitOfWork):
    session = await uow.repo(CounselingSessionRepository).get(session_id)
    session.status = "completed"

    # 이벤트 발행
    await event_bus.publish(SessionCompletedEvent(
        session_id=session.id,
        counseling_id=session.counseling_id,
        center_id=session.center_id
    ))

# billing/payment/event_handler.py
@event_bus.subscribe(SessionCompletedEvent)
async def on_session_completed(event: SessionCompletedEvent, uow: UnitOfWork):
    # 자동으로 PaymentRecord 생성
    await uow.repo(PaymentRecordRepository).create({
        "counseling_session_id": event.session_id,
        "counseling_id": event.counseling_id,
        "center_id": event.center_id,
        "type": "self_pay",
        "status": "pending"
    })
```

### 4.2. Repository 패턴

**Unit of Work로 트랜잭션 경계 관리**:
```python
async with uow:
    clients = uow.repo(ClientRepository)
    counselings = uow.repo(CounselingRepository)
    sessions = uow.repo(CounselingSessionRepository)

    client = await clients.get(client_id)
    counseling = await counselings.create(counseling_data)
    session = await sessions.create(session_data)

    await uow.commit()  # 트랜잭션 커밋
```

---

## 5. 확장성 고려사항

### 5.1. 향후 추가 모듈

**Phase 2 (향후 확장)**:
- **Document**: 문서 관리 (동의서, 계약서, 보고서)
- **Communication**: 메시지, 알림, SMS
- **Analytics**: 통계, 리포트, 대시보드
- **AI**: 자동 분석, 추천 시스템

### 5.2. 성능 최적화 전략

**Snapshot 패턴**:
- `AssessmentCase`에 검사/패키지 정보 스냅샷 저장
- 과거 데이터 참조 시 조인 불필요

**역정규화**:
- `PaymentRecord`에 `counseling_id`, `assessment_id` 역정규화
- 청구 관리 화면에서 빠른 조회 가능

**캐싱 전략**:
- Assessment 템플릿 (Global) → Redis 캐싱
- Center 정보 → Application 레벨 캐싱

---

## 6. 개발 우선순위

### Phase 1: 기반 구축 (2주)
1. Auth & Tenant 모듈
2. Client 모듈
3. Resource 모듈

### Phase 2: 핵심 도메인 (4주)
4. Counseling 모듈
5. Schedule 모듈
6. Billing 모듈

### Phase 3: 복잡 도메인 (6주)
7. Assessment 모듈 (가장 복잡)

---

## 7. 참고 문서

- **전체 시스템 설계**: `docs/plan5.md`
- **Assessment 상세 설계**: `docs/draft.md`
- **Assessment 스키마**: `docs/assessment/schema.md`
- **스키마 뷰어**: `http://localhost:3502/schema`
