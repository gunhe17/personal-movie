# 상담센터 SaaS 설계 문서 v5

> 상담센터 운영을 위한 SaaS 시스템. 상담/검사 관리, 일정, 결제/청구를 통합 관리한다.

---

## 1. 도메인 모델 (DSL)

```
# ═══════════════════════════════════════════════════════════════
# ENTITY DEFINITIONS
# ═══════════════════════════════════════════════════════════════

Entity Client {                          # 내담자
  name         : String
  birth_date   : Date?
  gender       : Male | Female | Other?
  phone        : String?
  email        : String?
  note         : Text?
}

Entity Counseling {                      # 상담 계약
  client       -> Client
  counselor    -> User
  type         : Individual | Group | Couple
  type_desc    : Text?
  total_sessions : Int = 20
  status       : Active | Completed | Cancelled
}

Entity CounselingSession {               # 상담 세션 (회기)
  counseling   -> Counseling
  schedule     -> Schedule?              # nullable: 일정 없이 회기만 먼저 생성 가능
  session_number : Int [auto]            # 상담 내 자동 계산 (1, 2, 3...)
  status       : Scheduled | Completed | NoShow | Cancelled

  # 상담 일지
  goal         : Text?                   # 상담 목표
  content      : Text?                   # 상담 내용
  summary      : Text?                   # 종합 소견
  private_memo : Text?                   # 개인 메모 (본인만)
}

Entity Assessment {                      # 검사
  client       -> Client
  counselor    -> User?
  type         : String                  # 검사 유형
  status       : Active | Completed | Cancelled
}

Entity AssessmentSession {               # 검사 세션
  assessment   -> Assessment
  schedule     -> Schedule?
  session_number : Int [auto]
  status       : Scheduled | Completed | NoShow | Cancelled
  note         : Text?
}

Entity Schedule {                        # 물리적 일정
  scheduled_at : DateTime
  duration     : Int = 60                # 분 단위
  room         -> Room?
  counselor    -> User?
  status       : Scheduled | Completed | Cancelled
  note         : Text?
}

Entity PaymentRecord {                   # 결제/청구 기록
  counseling_session  -> CounselingSession?
  assessment_session  -> AssessmentSession?

  # 조회 편의 (역정규화)
  counseling   -> Counseling?
  assessment   -> Assessment?

  type         : Voucher | SelfPay
  voucher      -> Voucher?
  amount       : Int = 0
  status       : Pending | Paid | Refunded | Cancelled
  paid_at      : DateTime?
  note         : Text?
}

Entity Voucher {                         # 바우처 마스터
  name         : String                  # 발달재활서비스, 마음투자 등
  description  : Text?
  is_active    : Boolean = true
}

Entity Room {                            # 상담실
  name         : String
  description  : Text?
  is_active    : Boolean = true
}

Entity User {                            # 사용자 (상담사/관리자)
  email        : String [unique]
  password_hash: String
  name         : String
  role         : Admin | Counselor | Intern
  is_active    : Boolean = true
}


# ═══════════════════════════════════════════════════════════════
# RELATIONSHIPS
# ═══════════════════════════════════════════════════════════════

Client ──1:N──> Counseling
Client ──1:N──> Assessment

Counseling ──1:N──> CounselingSession
Assessment ──1:N──> AssessmentSession

CounselingSession ──N:1──> Schedule?     # 일정 없이 회기만 가능
AssessmentSession ──N:1──> Schedule?

CounselingSession ──1:N──> PaymentRecord
AssessmentSession ──1:N──> PaymentRecord

PaymentRecord ──N:1──> Voucher?

Schedule ──N:1──> Room?
Schedule ──N:1──> User (counselor)
```

---

## 2. 도메인 계층

```
┌─────────────────────────────────────────────────────────────────────┐
│  CORE DOMAIN (핵심 비즈니스)                                         │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Client             내담자. 서비스를 받는 대상.                       │
│                                                                     │
│  Counseling         상담 계약. "김철수와 20회기 개별상담" 같은 약정.    │
│                     한 내담자가 여러 상담을 가질 수 있음.              │
│                                                                     │
│  CounselingSession  개별 상담 회기. 실제 서비스 제공 단위.             │
│                     1회기, 2회기... 상담일지 기록 포함.               │
│                                                                     │
│  Assessment         검사. 상담과 대칭 구조.                          │
│  AssessmentSession  검사 세션. 상담세션과 대칭.                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  PAYMENT DOMAIN (결제/청구)                                          │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  PaymentRecord      세션별 결제 기록. 서비스와 결제를 분리.            │
│                     - 출석 처리 → PaymentRecord(pending) 자동 생성    │
│                     - 바우처: 월말 일괄 청구                         │
│                     - 자부담: 즉시 결제                              │
│                                                                     │
│  Voucher            바우처 마스터. 발달재활서비스, 마음투자 등.         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  SUPPORT DOMAIN (운영 지원)                                          │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Schedule           물리적 일정. 날짜/시간/장소/담당자.                │
│                     세션과 분리되어 독립적으로 관리 가능.              │
│                                                                     │
│  Room               상담실.                                         │
│  User               사용자. 상담사, 관리자, 실습생.                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**핵심 설계 원칙:**
- **서비스와 결제 분리**: CounselingSession(서비스 제공) ↔ PaymentRecord(결제)
- **상담/검사 대칭**: Counseling:Assessment, CounselingSession:AssessmentSession
- **일정 독립**: Schedule은 세션과 분리. 일정 먼저 잡고 나중에 연결 가능.

---

## 3. 시나리오 검증

### A. 표준 상담 (자부담)
```
상담사: 상담 등록 (김철수, 개별상담 20회기, 자부담)
        → Counseling 생성
        → CounselingSession#1 생성
        → Schedule 생성 (2025-01-15 10:00)

상담사: 1회기 출석 처리 (completed)
        → CounselingSession#1.status = completed
        → PaymentRecord 자동 생성 (type=self_pay, status=pending, amount=50000)

데스크: 결제 처리
        → PaymentRecord.status = paid, paid_at = now()
```

### B. 바우처 상담
```
상담사: 상담 등록 (이영희, 발달재활서비스 8회기)
        → Counseling 생성
        → CounselingSession#1 생성

상담사: 출석 처리
        → PaymentRecord 생성 (type=voucher, voucher_id=..., status=pending)

관리자: 월말 바우처 청구
        → /billing/vouchers 에서 pending 건 확인
        → 청구 완료 후 status = paid
```

### C. 혼합 그룹상담
```
상담사: 그룹상담 등록 (참여자: A-바우처, B-자부담)
        → Counseling A (type=group, 바우처)
        → Counseling B (type=group, 자부담)

상담사: 출석 처리 (동일 Schedule에 두 세션)
        → CounselingSession A → PaymentRecord (voucher, pending)
        → CounselingSession B → PaymentRecord (self_pay, pending)

결과: A는 청구대기, B는 즉시 결제 가능
```

### D. 노쇼 처리
```
상담사: 예약된 상담에 내담자 미출석
        → CounselingSession.status = no_show
        → PaymentRecord 생성하지 않음 (또는 cancelled)

결과: 서비스 제공 안됨 → 결제 청구 없음
```

### E. 취소/환불
```
데스크: 결제 완료된 건 환불 요청
        → PaymentRecord.status = refunded
        → 환불 일시 기록

결과: 환불 이력 보존, 통계에서 제외
```

### F. 일정만 먼저 생성
```
상담사: 캘린더에서 빈 일정 생성
        → Schedule 생성 (session 연결 없음)

상담사: 나중에 상담 생성하면서 일정 연결
        → CounselingSession.schedule_id = 해당 Schedule

또는: 기존 상담에 회기 추가하면서 일정 연결
```

### G. 선결제 (10회기)
```
데스크: 10회기 비용 선결제 (50만원)
        → PaymentRecord 생성 (session_id=null, counseling_id=...,
           type=self_pay, amount=500000, status=paid)

상담사: 각 회기 출석 처리
        → PaymentRecord 생성 (amount=0, status=paid, note="선결제 차감")

        또는 선결제 레코드에서 잔액 관리 (v2)
```

### H. 회기 변경 (일정 변경)
```
상담사: 예약된 상담 일정 변경
        → Schedule.scheduled_at 수정
        → CounselingSession은 그대로 (schedule_id 유지)

결과: 회기 번호/상담 기록 유지, 일정만 변경
```

### I. 일지 작성
```
상담사: 상담 종료 후 일지 작성
        → CounselingSession 상세 화면
        → goal, content, summary, private_memo 입력
        → 저장

상담사: 출석 처리 (아직 안했다면)
        → status = completed
        → PaymentRecord 자동 생성
```

---

## 4. 기술 스택

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit + svelte-query + Svelte Store |
| Styling | Tailwind CSS |
| Backend | FastAPI + SQLAlchemy + Alembic |
| Database | PostgreSQL (Docker) |
| Auth | JWT (역할 기반) |
| Monorepo | pnpm + Turborepo |
| Python | uv (패키지 매니저) |
| Infra | Docker + Docker Compose |

---

## 4.1. 인프라 구성

### Docker Compose (docker-compose.yml)
```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: imomtae-db
    environment:
      POSTGRES_USER: imomtae
      POSTGRES_PASSWORD: imomtae_dev
      POSTGRES_DB: imomtae
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U imomtae"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### uv 설정 (apps/api/pyproject.toml)
```toml
[project]
name = "imomtae-api"
version = "0.1.0"
description = "상담센터 SaaS API"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "sqlalchemy>=2.0.0",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.6",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.26.0",
    "ruff>=0.1.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.26.0",
    "ruff>=0.1.0",
]
```

### 환경 변수 (.env.example)
```env
# Database
DATABASE_URL=postgresql+asyncpg://imomtae:imomtae_dev@localhost:5432/imomtae

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# App
APP_ENV=development
DEBUG=true
```

---

## 5. 프로젝트 구조

```
imomtae-saas-v2/
├── apps/
│   ├── web/                          # SvelteKit Frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── common/       # Button, Input, Modal, Calendar...
│   │   │   │   │   └── domain/       # CounselingCard, SessionList...
│   │   │   │   ├── stores/           # Svelte 스토어
│   │   │   │   ├── api/              # API 클라이언트
│   │   │   │   └── utils/
│   │   │   └── routes/
│   │   │       ├── (app)/            # 인증 필요
│   │   │       │   ├── counseling/
│   │   │       │   ├── assessment/
│   │   │       │   ├── schedule/
│   │   │       │   ├── billing/
│   │   │       │   ├── client/
│   │   │       │   └── playbook/
│   │   │       └── (auth)/           # 로그인/회원가입
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── api/                          # FastAPI Backend
│       ├── app/
│       │   ├── routers/
│       │   ├── handlers/
│       │   ├── models/               # SQLAlchemy
│       │   ├── schemas/              # Pydantic
│       │   ├── services/
│       │   ├── repositories/
│       │   └── core/                 # config, security, database
│       ├── migrations/               # Alembic
│       ├── pyproject.toml            # uv 패키지 정의
│       └── uv.lock                   # uv 락파일
│
├── docker-compose.yml                # PostgreSQL 등 인프라
├── .env.example                      # 환경 변수 템플릿
├── docs/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 스크립트 인터페이스

#### 루트 package.json
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=web",
    "dev:api": "turbo run dev --filter=api",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "turbo run db:migrate --filter=api",
    "db:seed": "turbo run db:seed --filter=api"
  }
}
```

#### apps/api 스크립트 (uv 사용)
```json
{
  "scripts": {
    "dev": "uv run uvicorn app.main:app --reload --port 8000",
    "db:migrate": "uv run alembic upgrade head",
    "db:seed": "uv run python -m app.scripts.seed",
    "db:makemigrations": "uv run alembic revision --autogenerate -m",
    "lint": "uv run ruff check .",
    "test": "uv run pytest"
  }
}
```

#### 개발 환경 시작 순서
```bash
# 1. Docker로 DB 실행
pnpm db:up

# 2. API 의존성 설치 (uv)
cd apps/api && uv sync

# 3. DB 마이그레이션
pnpm db:migrate

# 4. 개발 서버 실행
pnpm dev
```

---

## 6. 화면 및 라우팅

| Route | 설명 | 기능 |
|-------|------|------|
| `/login` | 로그인 | |
| `/register` | 회원가입 | 역할 선택 |
| `/counseling` | 상담 목록 | 카드 그리드, 검색/정렬 |
| `/counseling/[id]` | 상담 상세 | **탭: 세션목록(일지) / 결제내역** |
| `/assessment` | 검사 목록 | |
| `/assessment/[id]` | 검사 상세 | 탭: 세션목록 / 결제내역 |
| `/schedule` | 스케줄 | 월간/주간 캘린더 |
| `/billing` | 청구 관리 | 미수금/청구대기 모아보기 |
| `/billing/vouchers` | 바우처 청구 | 바우처별 청구 현황 |
| `/billing/unpaid` | 미납 관리 | 자부담 미납 건 |
| `/client` | 내담자 목록 | |
| `/client/[id]` | 내담자 상세 | 상담/검사 이력 |
| `/playbook` | 스타일가이드 | 디자인 토큰 + 컴포넌트 |

---

## 7. API 엔드포인트

### Auth
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh
```

### Counseling
```
GET    /api/counselings                   # 목록 (페이지네이션, 검색)
GET    /api/counselings/:id               # 상세
POST   /api/counselings                   # 등록 (첫 회기+일정 트랜잭션)
PUT    /api/counselings/:id               # 수정
DELETE /api/counselings/:id               # 삭제
```

### CounselingSession
```
GET    /api/counselings/:id/sessions      # 세션 목록
POST   /api/counselings/:id/sessions      # 세션 추가
PUT    /api/counseling-sessions/:id       # 세션 수정 (일지 작성)
PATCH  /api/counseling-sessions/:id/status  # 출석 처리 → PaymentRecord 생성 
DELETE /api/counseling-sessions/:id
```

### Assessment (대칭 구조)
```
GET    /api/assessments
GET    /api/assessments/:id
POST   /api/assessments
PUT    /api/assessments/:id
DELETE /api/assessments/:id

GET    /api/assessments/:id/sessions
POST   /api/assessments/:id/sessions
PUT    /api/assessment-sessions/:id
PATCH  /api/assessment-sessions/:id/status
DELETE /api/assessment-sessions/:id
```

### Schedule
```
GET    /api/schedules                     # 기간 필터 (캘린더용)
GET    /api/schedules/:id
POST   /api/schedules                     # 일정만 생성 or 세션 연결
PUT    /api/schedules/:id
DELETE /api/schedules/:id
```

### Payment
```
GET    /api/payments                      # 필터: counseling_id, status
GET    /api/payments/pending              # 청구대기 목록 (Billing용)
POST   /api/payments                      # 수동 생성 (선결제 등)
PATCH  /api/payments/:id                  # 상태 변경 (paid, refunded)
```

### Client
```
GET    /api/clients
GET    /api/clients/:id
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id
```

### Lookup
```
GET    /api/counselors                    # 담당자 목록
GET    /api/rooms                         # 상담실 목록
GET    /api/vouchers                      # 바우처 목록
```

---

## 8. DB 스키마

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'counselor',  -- admin, counselor, intern
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### clients
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(10),  -- male, female, other
    phone VARCHAR(20),
    email VARCHAR(255),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### rooms
```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### vouchers
```sql
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### schedules
```sql
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 60,
    room_id UUID REFERENCES rooms(id),
    counselor_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, completed, cancelled
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_scheduled_at ON schedules(scheduled_at);
CREATE INDEX idx_schedules_counselor_id ON schedules(counselor_id);
```

### counselings
```sql
CREATE TABLE counselings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    counselor_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL,  -- individual, group, couple
    type_description TEXT,
    total_sessions INT DEFAULT 20,
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_counselings_client_id ON counselings(client_id);
```

### counseling_sessions
```sql
CREATE TABLE counseling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counseling_id UUID NOT NULL REFERENCES counselings(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    session_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, completed, no_show, cancelled

    -- 상담 일지
    goal TEXT,
    content TEXT,
    summary TEXT,
    private_memo TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (counseling_id, session_number)
);

CREATE INDEX idx_counseling_sessions_counseling_id ON counseling_sessions(counseling_id);
```

### assessments
```sql
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    counselor_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### assessment_sessions
```sql
CREATE TABLE assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    session_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, completed, no_show, cancelled
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assessment_id, session_number)
);
```

### payment_records
```sql
CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 세션 연결 (상담 or 검사)
    counseling_session_id UUID REFERENCES counseling_sessions(id) ON DELETE SET NULL,
    assessment_session_id UUID REFERENCES assessment_sessions(id) ON DELETE SET NULL,

    -- 조회 편의 (역정규화)
    counseling_id UUID REFERENCES counselings(id),
    assessment_id UUID REFERENCES assessments(id),

    type VARCHAR(20) NOT NULL,  -- voucher, self_pay
    voucher_id UUID REFERENCES vouchers(id),

    amount INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, paid, refunded, cancelled

    paid_at TIMESTAMP,
    note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 하나의 세션 타입만 연결
    CHECK (
        (counseling_session_id IS NOT NULL AND assessment_session_id IS NULL) OR
        (counseling_session_id IS NULL AND assessment_session_id IS NOT NULL) OR
        (counseling_session_id IS NULL AND assessment_session_id IS NULL)
    )
);

CREATE INDEX idx_payments_counseling_id ON payment_records(counseling_id);
CREATE INDEX idx_payments_assessment_id ON payment_records(assessment_id);
CREATE INDEX idx_payments_status ON payment_records(status);
```

---

## 9. 인증/권한

### 역할 및 권한 (core/config.py)
```python
ROLES = {
    "admin": {
        "name": "관리자",
        "permissions": ["*"]
    },
    "counselor": {
        "name": "상담사",
        "permissions": [
            "counseling:read", "counseling:write", "counseling:delete",
            "assessment:read", "assessment:write",
            "client:read", "client:write",
            "session:read", "session:write",
            "schedule:read", "schedule:write",
            "payment:read", "payment:write",
            "voucher:read"
        ]
    },
    "intern": {
        "name": "실습생",
        "permissions": [
            "counseling:read",
            "client:read",
            "session:read",
            "schedule:read"
        ]
    }
}
```

### 권한 데코레이터 (core/security.py)
```python
def require_permission(*permissions: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user=Depends(get_current_user), **kwargs):
            user_permissions = ROLES.get(current_user.role, {}).get("permissions", [])

            if "*" in user_permissions:
                return await func(*args, current_user=current_user, **kwargs)

            for perm in permissions:
                if perm not in user_permissions:
                    raise HTTPException(403, f"Permission denied: {perm}")

            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator
```

---

## 10. 핵심 컴포넌트

### 공통 (lib/components/common/)

| 컴포넌트 | 설명 |
|----------|------|
| `Button` | primary, secondary, outline / sm, md, lg |
| `Input` | text, email, password, number |
| `Select` | 단일/다중 선택 |
| `Toggle` | On/Off 스위치 |
| `Modal` | 오버레이 모달 |
| `DatePicker` | 날짜 선택 |
| `TimePicker` | 시간 선택 (슬롯) |
| `Calendar` | 월간/주간 뷰 |
| `Card` | 기본 카드 |
| `Badge` | 상태 뱃지 |
| `Tabs` | 탭 네비게이션 |
| `Pagination` | 페이지 네비게이션 |
| `Sidebar` | 사이드바 |
| `Header` | 상단 헤더 |

### 도메인 (lib/components/domain/)

| 컴포넌트 | 설명 |
|----------|------|
| `CounselingCard` | 상담 목록 카드 |
| `SessionList` | 회기 목록 (상태 표시) |
| `SessionDetail` | 회기 상세 + 일지 폼 |
| `CounselingForm` | 상담 등록/수정 |
| `ScheduleCalendar` | 캘린더 (일정 표시) |
| `ScheduleForm` | 일정 등록/수정 |
| `BillingTable` | 청구 목록 테이블 |
| `PaymentHistory` | 결제 이력 |
| `PaymentModal` | 결제 처리 팝업 |
| `StatusBadge` | 세션/결제 상태 뱃지 |
| `ClientSelector` | 내담자 선택 |
| `CounselingSelector` | 상담 선택 (회기 표시) |

---

## 11. 비즈니스 로직

### 출석 처리 → 결제 레코드 자동 생성
```python
# services/counseling_session.py

async def update_session_status(session_id: UUID, status: str):
    session = await repo.get(session_id)
    session.status = status

    if status == "completed":
        # 결제 레코드 자동 생성
        counseling = await counseling_repo.get(session.counseling_id)

        await payment_repo.create(PaymentRecord(
            counseling_session_id=session.id,
            counseling_id=counseling.id,
            type=counseling.default_payment_type or "self_pay",
            amount=counseling.default_amount or 0,
            status="pending"
        ))

    return session
```

### 세션 번호 자동 계산
```python
async def get_next_session_number(counseling_id: UUID) -> int:
    max_number = await db.scalar(
        select(func.max(CounselingSession.session_number))
        .where(CounselingSession.counseling_id == counseling_id)
    )
    return (max_number or 0) + 1
```

---

## 12. 구현 순서

### Phase 1: 프로젝트 기반
```
1. 모노리포 세팅
   ├── pnpm + Turborepo 초기화
   ├── apps/web (SvelteKit)
   └── apps/api (FastAPI)

2. 인프라 구성
   ├── docker-compose.yml (PostgreSQL)
   ├── .env.example
   └── uv 프로젝트 초기화 (apps/api)

3. Backend 기본
   ├── FastAPI 프로젝트 구조
   ├── SQLAlchemy + asyncpg 설정
   ├── Alembic 마이그레이션 설정
   └── JWT 인증 + 권한 데코레이터
```

### Phase 2: Frontend 기반
```
4. Frontend 기본
   ├── SvelteKit 프로젝트
   ├── Tailwind CSS 설정
   └── 레이아웃 (Sidebar, Header)

5. Playbook
   ├── 디자인 토큰
   └── 공통 컴포넌트 (Button, Input, Modal, Calendar...)
```

### Phase 3: 핵심 기능
```
6. 내담자 CRUD
   └── 전체 플로우 검증

7. 상담 기능
   ├── 목록 (카드 그리드)
   ├── 등록 (첫 회기+일정 트랜잭션)
   └── 상세 (세션 목록, 일지)

8. 스케줄 기능
   ├── 캘린더 (월간/주간)
   └── 일정 관리
```

### Phase 4: 결제/검사
```
9. 결제 기능
   ├── 출석 → PaymentRecord 자동 생성
   └── 청구 관리 화면

10. 검사 기능 (상담과 대칭)
    ├── 목록 / 등록 / 상세
    └── 세션 + 결제
```

### 개발 명령어 Quick Reference
```bash
# 초기 설정
pnpm install                    # 프론트엔드 의존성
cd apps/api && uv sync          # 백엔드 의존성

# 개발
pnpm db:up                      # Docker DB 시작
pnpm db:migrate                 # 마이그레이션 실행
pnpm dev                        # 개발 서버 (web + api)

# 마이그레이션 생성
cd apps/api
uv run alembic revision --autogenerate -m "add_xxx_table"
```

---

## Appendix: DSL 표기법

```
Entity Name {        # 엔티티 정의
  field: Type        # 기본 필드
  field: Type?       # nullable
  field: Type = val  # 기본값
  field: A | B | C   # enum
  field [auto]       # 자동 생성
  field [unique]     # 유니크
  ref -> Entity      # 참조 (FK)
  ref -> Entity?     # nullable 참조
}

A ──1:N──> B         # 1:N 관계
A ──N:1──> B         # N:1 관계
A ──N:N──> B         # N:N 관계
A ──1:N──> B?        # nullable 관계
```
