# Subscription 도메인 설계

> 센터의 구독 관리 및 플랜 기반 기능 제어

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [스키마 정의](#스키마-정의)
3. [비즈니스 규칙](#비즈니스-규칙)
4. [API 설계](#api-설계)
5. [구현 우선순위](#구현-우선순위)

---

## 도메인 개요

### 핵심 개념

**Subscription**은 센터가 플랫폼 서비스를 사용하기 위한 구독 상태 및 요금제 관리를 의미합니다:
- 센터 → 플랫폼 간의 구독 관계 (B2B)
- 플랜 기반 기능 제어 (Free, Starter, Pro, Enterprise)
- 리소스 Quota 관리 (내담자 수, 전문가 수 제한)
- 구독 결제 내역 추적

### 책임 (Responsibility)

- 센터별 구독 상태 관리 (active, trial, expired, cancelled)
- 플랜별 기능 제한 제어 (AI 보고서, 통합 청구 등)
- 플랜 업그레이드/다운그레이드 처리
- 구독 결제 내역 기록 (센터 → 플랫폼)
- JWT에 plan 정보 포함하여 API 레벨 권한 검증 지원

### 의존성

- **Depends on**: Center (멀티테넌시)
- **Depended by**: 모든 모듈 (plan 기반 기능 제어)
- **Integration**: Core (JWT, 권한 검증 데코레이터)

### 범위

**포함**:
- 플랜 관리 (Free, Starter, Pro, Enterprise)
- 센터별 구독 상태 관리
- 플랜 업그레이드/다운그레이드
- 구독 결제 내역 (센터 → 플랫폼)
- 플랜 기반 기능 제어

**제외** (Billing 도메인):
- 내담자 청구서 관리
- 센터 내부 수납 처리
- 보험/바우처 연동

---

## 스키마 정의

### 1. Subscription (구독)

```python
# app/modules/subscription/subscription/models.py
from sqlalchemy import String, DateTime, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Subscription(Base):
    """
    센터 구독 정보
    - 센터당 1개의 구독 (1:1 관계)
    - 플랜 기반 기능 제어
    - JWT에 plan 포함
    """
    __tablename__ = "subscriptions"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Foreign Key (Center)
    center_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # 센터당 하나의 구독
        index=True
    )

    # 플랜 정보
    plan: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="free"
    )  # "free" | "starter" | "pro" | "enterprise"

    # 구독 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active"
    )  # "active" | "trial" | "pending_payment" | "payment_failed" | "expired" | "cancelled"

    # Quota 초과 관리
    is_quota_exceeded: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
    quota_exceeded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    grace_period_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=30
    )

    # 구독 기간
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True  # None = 무제한 (Free 플랜)
    )

    # 체험판
    is_trial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trial_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_subscriptions_center", "center_id"),
        Index("ix_subscriptions_status", "status"),
        Index("ix_subscriptions_plan", "plan"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Integer | PK | 구독 고유 ID |
| `center_id` | Integer | FK, UNIQUE, NOT NULL | 센터 ID (1:1) |
| `plan` | String(20) | NOT NULL | 플랜 코드 |
| `status` | String(20) | NOT NULL | 구독 상태 |
| `is_quota_exceeded` | Boolean | NOT NULL | Quota 초과 여부 |
| `quota_exceeded_at` | DateTime(tz) | NULL | Quota 초과 시작 시점 |
| `grace_period_days` | Integer | NOT NULL | 유예 기간 (기본 30일) |
| `started_at` | DateTime(tz) | NOT NULL | 구독 시작일 |
| `expires_at` | DateTime(tz) | NULL | 만료일 (Free는 NULL) |
| `is_trial` | Boolean | NOT NULL | 체험판 여부 |
| `trial_expires_at` | DateTime(tz) | NULL | 체험판 만료일 |
| `created_at` | DateTime(tz) | NOT NULL | 생성 일시 |
| `updated_at` | DateTime(tz) | NOT NULL | 수정 일시 |

**plan 값**:
- `free`: 무료 (내담자 10명, 기본 기능)
- `starter`: 스타터 (월 29,000원, 내담자 50명)
- `pro`: 프로 (월 99,000원, 무제한, AI 기능)
- `enterprise`: 엔터프라이즈 (문의, 맞춤 설정)

**status 값**:
- `active`: 활성 (정상 사용 중, 모든 기능 사용 가능)
- `trial`: 체험판 (14일 무료, Pro 기능 체험)
- `pending_payment`: 결제 대기 (업그레이드 처리 중, 기능 사용 불가)
- `payment_failed`: 결제 실패 (유예 기간 7일, 읽기/수정만 가능)
- `expired`: 만료 (갱신 필요, 읽기 전용)
- `cancelled`: 취소 (환불 완료, Free 플랜 전환)

---

### 2. SubscriptionPayment (구독 결제)

```python
# app/modules/subscription/payment/models.py
from sqlalchemy import String, DateTime, Integer, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class SubscriptionPayment(Base):
    """
    구독 결제 내역
    - 센터가 플랫폼에 지불하는 월 요금
    - PG사 연동 정보 포함
    """
    __tablename__ = "subscription_payments"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Foreign Key (Subscription)
    subscription_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 결제 정보
    amount: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )  # 결제 금액
    plan: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # 결제 시점 플랜

    # 결제 수단
    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # "card" | "bank_transfer"

    # 결제 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"
    )  # "pending" | "completed" | "failed" | "refunded"

    # PG사 정보 (향후 확장)
    pg_provider: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )  # "toss" | "nice" | "inicis"
    pg_transaction_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # 결제 일시
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_payments_subscription", "subscription_id"),
        Index("ix_payments_status", "status"),
        Index("ix_payments_paid_at", "paid_at"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Integer | PK | 결제 고유 ID |
| `subscription_id` | Integer | FK, NOT NULL | 구독 ID |
| `amount` | Numeric(10,2) | NOT NULL | 결제 금액 |
| `plan` | String(20) | NOT NULL | 결제 시점 플랜 |
| `payment_method` | String(20) | NOT NULL | 결제 수단 |
| `status` | String(20) | NOT NULL | 결제 상태 |
| `pg_provider` | String(50) | NULL | PG사 (Phase 2) |
| `pg_transaction_id` | String(100) | NULL | PG 거래 ID |
| `paid_at` | DateTime(tz) | NULL | 결제 완료 일시 |
| `created_at` | DateTime(tz) | NOT NULL | 생성 일시 |
| `updated_at` | DateTime(tz) | NOT NULL | 수정 일시 |

---

### 3. SubscriptionHistory (구독 변경 이력)

```python
# app/modules/subscription/history/models.py
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class SubscriptionHistory(Base):
    """
    구독 변경 이력 추적
    - 모든 플랜 변경 기록
    - 변경 주체 및 사유 추적 (감사 로그)
    - 다운그레이드/업그레이드 분석 용도
    """
    __tablename__ = "subscription_histories"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Foreign Key (Subscription)
    subscription_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 변경 정보
    from_plan: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # 변경 전 플랜
    to_plan: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # 변경 후 플랜

    # 변경 주체
    changed_by: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )  # "user" | "admin" | "system"

    # 변경 사유
    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )  # 예: "payment_failed_after_3_retries", "user_requested_downgrade"

    # 변경 일시
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_history_subscription", "subscription_id"),
        Index("ix_history_changed_at", "changed_at"),
        Index("ix_history_changed_by", "changed_by"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Integer | PK | 이력 고유 ID |
| `subscription_id` | Integer | FK, NOT NULL | 구독 ID |
| `from_plan` | String(20) | NOT NULL | 변경 전 플랜 |
| `to_plan` | String(20) | NOT NULL | 변경 후 플랜 |
| `changed_by` | String(50) | NOT NULL | 변경 주체 |
| `reason` | Text | NULL | 변경 사유 |
| `changed_at` | DateTime(tz) | NOT NULL | 변경 일시 |

**changed_by 값**:
- `user`: 사용자가 직접 요청한 변경
- `admin`: 관리자가 수동 변경 (고객 지원 등)
- `system`: 시스템 자동 변경 (결제 실패, 만료 등)

**reason 예시**:
- `user_requested_upgrade`: 사용자가 업그레이드 요청
- `user_requested_downgrade`: 사용자가 다운그레이드 요청
- `payment_failed_after_3_retries`: 결제 3회 실패 후 자동 다운그레이드
- `trial_expired`: 체험판 만료로 Free 플랜 전환
- `admin_manual_change`: 관리자 수동 변경
- `subscription_expired`: 구독 만료로 Free 플랜 전환

---

### 4. Plan Config (코드 정의)

**플랜 설정은 코드로 관리** (Phase 1):

```python
# app/modules/subscription/plan/config.py
from typing import TypedDict

class PlanLimits(TypedDict):
    """플랜별 리소스 제한"""
    clients: int | None      # None = 무제한
    therapists: int | None
    storage_gb: int | None

class PlanConfig(TypedDict):
    """플랜 설정"""
    code: str
    name: str
    price: int
    description: str
    limits: PlanLimits

PLAN_CONFIGS: dict[str, PlanConfig] = {
    "free": {
        "code": "free",
        "name": "무료",
        "price": 0,
        "description": "기본 기능 체험",
        "limits": {
            "clients": 10,
            "therapists": 1,
            "storage_gb": 1,
        },
    },
    "starter": {
        "code": "starter",
        "name": "스타터",
        "price": 29000,
        "description": "개인 전문가용",
        "limits": {
            "clients": 50,
            "therapists": 1,
            "storage_gb": 5,
        },
    },
    "pro": {
        "code": "pro",
        "name": "프로",
        "price": 99000,
        "description": "센터 운영자용 (AI 기능 포함)",
        "limits": {
            "clients": None,  # 무제한
            "therapists": None,
            "storage_gb": 50,
        },
    },
    "enterprise": {
        "code": "enterprise",
        "name": "엔터프라이즈",
        "price": 0,  # 문의
        "description": "대형 센터용 (맞춤 설정)",
        "limits": {
            "clients": None,
            "therapists": None,
            "storage_gb": None,
        },
    },
}

def get_plan_config(plan: str) -> PlanConfig:
    """플랜 설정 조회"""
    return PLAN_CONFIGS.get(plan, PLAN_CONFIGS["free"])

def get_plan_limit(plan: str, resource: str) -> int | None:
    """플랜별 리소스 제한 조회"""
    config = get_plan_config(plan)
    return config["limits"].get(resource)

def is_feature_allowed(plan: str, feature: str) -> bool:
    """플랜별 기능 허용 여부"""
    # AI 기능은 Pro 이상
    if feature in ["ai_report", "projective_test"]:
        return plan in ["pro", "enterprise"]

    # 통합 청구는 Starter 이상
    if feature == "integrated_billing":
        return plan in ["starter", "pro", "enterprise"]

    # API 접근은 Enterprise만
    if feature == "api_access":
        return plan == "enterprise"

    return False
```

---

## 비즈니스 규칙

### 1. Subscription 생성 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **센터당 1개** | 하나의 센터는 하나의 구독만 가능 | DB UNIQUE constraint |
| **Free 기본값** | 센터 생성 시 Free 플랜 자동 할당 | Application Handler |
| **status 기본값** | 생성 시 status='active' | Subscription model default |
| **started_at 필수** | 구독 시작일은 항상 기록 | Subscription model |
| **expires_at 선택** | Free 플랜은 expires_at=NULL | Service |

### 2. 플랜 업그레이드/다운그레이드 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **업그레이드만 허용** | Free → Starter → Pro → Enterprise 순서 | Service |
| **다운그레이드 금지** | Phase 1에서는 다운그레이드 불가 | Service |
| **즉시 적용** | 업그레이드 시 즉시 새 플랜 적용 | Service |
| **JWT 재발급** | 플랜 변경 시 새 JWT 발급 필요 | Handler |
| **expires_at 갱신** | 업그레이드 시 +30일 연장 | Service |

### 3. 플랜별 기능 제한

| 기능 | Free | Starter | Pro | Enterprise |
|------|------|---------|-----|------------|
| 내담자 수 | 10명 | 50명 | 무제한 | 무제한 |
| 전문가 수 | 1명 | 1명 | 무제한 | 무제한 |
| AI 보고서 | ❌ | ❌ | ✅ | ✅ |
| 투사검사 AI | ❌ | ❌ | ✅ | ✅ |
| 통합 청구 | ❌ | ✅ | ✅ | ✅ |
| API 접근 | ❌ | ❌ | ❌ | ✅ |

### 4. 리소스 Quota 검증

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **API 레벨 차단** | Free 플랜은 AI 기능 API 호출 불가 | Core 데코레이터 |
| **Application 차단** | 내담자 수 초과 시 생성 차단 | Application Handler |
| **실시간 확인** | 매 요청마다 JWT의 plan 확인 | Core Middleware |
| **DB 조회 없음** | JWT만으로 검증 (성능) | Core |

### 5. 결제 처리 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **결제 선행** | 업그레이드 시 결제 먼저 | Handler |
| **결제 실패 시** | 플랜 변경 롤백 | UnitOfWork |
| **결제 내역 기록** | 모든 결제 시도 기록 | SubscriptionPayment |
| **환불 처리** | status='refunded'로 기록 | Service |

### 6. 결제 실패 및 유예 기간 정책

| 상황 | 정책 | 유예 기간 | 기능 제한 |
|------|------|----------|----------|
| **정기 결제 실패** | Free 플랜 전환 | 7일 | Day 0-7: 읽기/수정 + Free Quota 내 추가 가능<br>Day 8+: 읽기만 가능 |
| **사용자 다운그레이드** | 즉시 적용 (Phase 2) | 30일 | 초과 데이터 읽기/수정만, 신규 추가 불가 |
| **플랜 업그레이드 중** | status='pending_payment' | 없음 | 모든 기능 사용 불가 (결제 완료 시까지) |
| **구독 만료** | 읽기 전용 전환 | 24시간 | 읽기만 가능 → Free 플랜 전환 |

**결제 실패 시 세부 정책**:

1. **Day 0-3**:
   - 모든 기능 사용 가능 (강한 경고만)
   - 대시보드에 결제 독촉 배너 표시
   - 이메일/알림 전송

2. **Day 4-7**:
   - 기존 데이터: 읽기/수정 가능
   - 신규 추가: Free Quota 내에서만 (예: 내담자 10명 미만이면 추가 가능)
   - 경고 배너 지속 표시

3. **Day 8+**:
   - 기존 데이터: 읽기만 가능
   - 신규 추가/수정: 모두 차단
   - 결제 수단 업데이트 시 즉시 복구

---

## API 설계

### 엔드포인트 목록

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/subscription/plans` | 플랜 목록 조회 | Public |
| GET | `/subscription` | 현재 구독 조회 | Authenticated |
| POST | `/subscription/upgrade` | 플랜 업그레이드 | Authenticated |
| GET | `/subscription/payments` | 결제 내역 조회 | Authenticated |

---

### Request/Response 스키마

#### PlanResponse (플랜 정보)

```python
class PlanLimitsSchema(BaseModel):
    clients: int | None
    therapists: int | None
    storage_gb: int | None

class PlanResponse(BaseModel):
    code: str
    name: str
    price: int
    description: str
    limits: PlanLimitsSchema
```

#### SubscriptionResponse (구독 조회)

```python
class SubscriptionResponse(BaseModel):
    id: int
    center_id: int
    plan: str
    status: str
    started_at: datetime
    expires_at: datetime | None
    is_trial: bool
    trial_expires_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

#### UpgradePlanRequest (업그레이드)

```python
class UpgradePlanRequest(BaseModel):
    plan: Literal["starter", "pro", "enterprise"]
    payment_method: Literal["card", "bank_transfer"]
```

#### UpgradePlanResponse (업그레이드 응답)

```python
class UpgradePlanResponse(BaseModel):
    subscription: SubscriptionResponse
    payment: PaymentResponse
    access_token: str
    message: str
```

#### PaymentResponse (결제 내역)

```python
class PaymentResponse(BaseModel):
    id: int
    subscription_id: int
    amount: float
    plan: str
    payment_method: str
    status: str
    paid_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

---

## 구현 우선순위

### Phase 1: 핵심 기능 (MVP)

1. **Subscription 엔티티 정의**
   - Subscription 모델
   - SubscriptionPayment 모델
   - Alembic 마이그레이션

2. **Plan Config 작성**
   - `plan/config.py`: PLAN_CONFIGS 정의
   - Helper 함수 (get_plan_config, get_plan_limit)

3. **Core 권한 검증**
   - `app/core/permissions.py`에 require_plan 데코레이터 추가
   - JWT Payload에 plan 필드 추가

4. **기본 API**
   - GET /subscription/plans
   - GET /subscription (현재 구독 조회)
   - POST /subscription/upgrade

5. **Application Handler (센터 생성)**
   - create_center_with_subscription_handler
   - 트랜잭션으로 Center + Subscription 동시 생성

### Phase 2: 고급 기능

1. **체험판 (Trial)**
   - Trial 플랜 추가 (Pro 14일 무료)
   - Trial 만료 자동 처리 (배치)

2. **PG사 연동**
   - Toss Payments 연동
   - 실제 결제 처리
   - Webhook 처리

3. **구독 갱신 자동화**
   - 만료일 임박 알림
   - 자동 결제

4. **다운그레이드 지원**
   - 다운그레이드 정책 결정
   - 데이터 보존 처리

### Phase 3: 최적화

1. **Quota 사용량 추적**
   - Real-time usage 업데이트
   - Usage 대시보드

2. **결제 재시도 로직**
   - 결제 실패 시 재시도
   - 알림 전송

3. **통계 및 분석**
   - 구독 통계
   - 수익 분석

---

## 참고 문서

- **Subscription 시나리오**: `/docs/subscription/scenarios.md`
- **Subscription 엣지 케이스**: `/docs/subscription/edge-cases.md`
- **Auth 도메인**: `/docs/auth/domain.md`
- **Auth 의사결정**: `/docs/auth/decision-log.md`
- **전체 아키텍처**: `/docs/domain-architecture.md`
- **CLAUDE.md**: 프로젝트 설정 및 개발 규칙
