# 상담센터 SaaS - 상담 관리 시스템 설계 문서 v3

> plan2.md 기반 + 스케줄 도메인 추가 + 세션 구조 재설계 + 바우처 결제 구조 개선

---

## 1. 도메인 모델

### 핵심 도메인

```
Counseling (상담)
├── 상담 유형: Individual(개별) / Group(그룹) / Couple(짝)
├── 유형별 설명 필드
├── total_sessions: 계획된 총 회기 수
├── voucher_id → Voucher (기본 바우처 연결, nullable)
└── CounselingSession (상담세션) - 1:N 관계

Schedule (일정) - 공통 일정 테이블
├── 일정 정보: 날짜/시간, 소요시간, 장소, 담당자
├── 결제 정보: payment_type ('voucher' | 'self_pay'), voucher_id
└── 타입 구분 없음 (세션 테이블에서 연결하여 타입 파악)

CounselingSession (상담세션) - 상담↔일정 연결
├── counseling_id → Counseling
├── schedule_id → Schedule (nullable)
├── session_number (자동 계산)
├── 상담 기록: goal, content, summary, private_memo
└── 상태: scheduled / completed / cancelled

Client (내담자) - 기본 CRUD
├── 이름, 생년월일, 성별, 연락처
└── Counseling과 1:N 관계

Voucher (바우처)
├── 바우처 사업 정보 (발달재활, 마음투자 등)
└── Counseling/Assessment에서 N:1 참조
```

### 보조 도메인

```
Counselor (상담사) - 최소 정보 (User 기반)
Room (상담실) - 간단 모델
User (사용자) - 인증/권한용
```

### 확장 도메인 (기본 스키마만)

```
Assessment (검사)
├── 내담자, 검사유형, 담당자
├── voucher_id → Voucher (기본 바우처 연결, nullable)
└── AssessmentSession (검사세션) - 1:N 관계

AssessmentSession (검사세션) - 검사↔일정 연결
├── assessment_id → Assessment
├── schedule_id → Schedule (nullable)
├── session_number (자동 계산)
└── 상태: scheduled / completed / cancelled
```

---

## 2. 기술 스택

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit + svelte-query + Svelte Store |
| Styling | Tailwind CSS |
| Backend | FastAPI |
| Database | PostgreSQL |
| Auth | JWT (역할 기반 권한) |
| Monorepo | pnpm + Turborepo |

### 사용 패턴
- **조회**: svelte-query (캐싱, 자동 리페치)
- **폼 수정**: Svelte Store (로컬 상태 관리)

---

## 3. 프로젝트 구조

```
imomtae-saas-v2-partial-counseling/
├── apps/
│   ├── web/                        # SvelteKit Frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/     # 재사용 컴포넌트
│   │   │   │   │   ├── common/     # Button, Input, Modal, Calendar 등
│   │   │   │   │   └── domain/     # CounselingCard, SessionList 등
│   │   │   │   ├── stores/         # Svelte 스토어
│   │   │   │   ├── api/            # API 클라이언트
│   │   │   │   └── utils/          # 유틸리티 함수
│   │   │   └── routes/
│   │   │       ├── (app)/          # 인증 필요 라우트 그룹
│   │   │       │   ├── counseling/
│   │   │       │   │   ├── +page.svelte         # 목록
│   │   │       │   │   └── [id]/+page.svelte    # 상세
│   │   │       │   ├── client/
│   │   │       │   ├── schedule/               # 스케줄 (캘린더)
│   │   │       │   ├── playbook/
│   │   │       │   └── [...slug]/              # 기타 메뉴 (타이틀만)
│   │   │       └── (auth)/         # 로그인/회원가입
│   │   ├── static/
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── api/                        # FastAPI Backend
│       ├── app/
│       │   ├── routers/            # 선언형 라우터 조합
│       │   │   ├── __init__.py     # 라우터 등록
│       │   │   ├── auth.py
│       │   │   ├── counseling.py
│       │   │   ├── schedule.py     # 스케줄 라우터
│       │   │   ├── client.py
│       │   │   └── lookup.py
│       │   ├── handlers/           # 각 핸들러 별도 파일
│       │   │   ├── counseling/
│       │   │   ├── schedule/
│       │   │   └── ...
│       │   ├── models/             # SQLAlchemy 모델
│       │   ├── schemas/            # Pydantic 스키마
│       │   ├── services/           # 비즈니스 로직
│       │   ├── repositories/       # DB 어댑터 (인터페이스 구현)
│       │   ├── core/
│       │   │   ├── config.py       # 역할/권한 정의
│       │   │   ├── security.py     # JWT + 권한 데코레이터
│       │   │   └── database.py     # DB 인터페이스
│       │   └── main.py
│       ├── migrations/             # Alembic
│       ├── requirements.txt
│       └── pyproject.toml
│
├── packages/                       # (향후 확장용)
├── docs/
│   ├── plan1.md
│   ├── plan2.md
│   └── plan3.md
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 4. 스크립트 인터페이스

### 루트 package.json
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:migrate": "turbo run db:migrate --filter=api",
    "db:seed": "turbo run db:seed --filter=api",
    "generate": "turbo run generate"
  }
}
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["build/**", ".svelte-kit/**"]
    },
    "lint": {},
    "test": {},
    "db:migrate": {},
    "db:seed": {
      "dependsOn": ["db:migrate"]
    },
    "generate": {}
  }
}
```

---

## 5. 화면 및 라우팅

### Frontend Routes

| Route | 설명 | 비고 |
|-------|------|------|
| `/login` | 로그인 | |
| `/register` | 회원가입 | 역할 선택 포함 |
| `/counseling` | 상담 목록 | 카드 그리드, 검색/정렬/페이지네이션 |
| `/counseling/[id]` | 상담 상세 | 회기 목록 + 회기 상세 |
| `/counseling/new` | 상담 등록 | 모달 형태 (첫 회기 일정 포함) |
| `/client` | 내담자 목록 | |
| `/client/[id]` | 내담자 상세 | |
| `/schedule` | 스케줄 | 월간/주간 캘린더 뷰 |
| `/playbook` | 스타일가이드 | 디자인 토큰 + 컴포넌트 |
| `/dashboard` | 대시보드 | 타이틀만 |
| `/assessment` | 검사 | 타이틀만 |
| `/member` | 구성원 | 타이틀만 |
| `/settings` | 설정 | 타이틀만 |

---

## 6. API 엔드포인트

### Auth
```
POST /api/auth/login          # 로그인
POST /api/auth/register       # 회원가입
POST /api/auth/refresh        # 토큰 갱신
```

### Counseling
```
GET    /api/counselings                    # 목록 (페이지네이션, 검색, 정렬)
GET    /api/counselings/:id                # 상세
POST   /api/counselings                    # 등록 (첫 회기 + 일정 포함, 트랜잭션)
PUT    /api/counselings/:id                # 수정
DELETE /api/counselings/:id                # 삭제
```

### CounselingSession (상담세션)
```
GET    /api/counselings/:id/sessions       # 상담의 세션 목록
POST   /api/counselings/:id/sessions       # 세션 추가 (schedule_id 선택적)
PUT    /api/counseling-sessions/:id        # 세션 수정
DELETE /api/counseling-sessions/:id        # 세션 삭제
PATCH  /api/counseling-sessions/:id/schedule  # 세션에 일정 연결
```

### Schedule (일정)
```
GET    /api/schedules                      # 목록 (기간 필터, 캘린더용)
GET    /api/schedules/:id                  # 상세
POST   /api/schedules                      # 일정 등록 (상담 연결 선택적)
PUT    /api/schedules/:id                  # 수정
DELETE /api/schedules/:id                  # 삭제
```

### Client
```
GET    /api/clients                        # 목록
GET    /api/clients/:id                    # 상세
POST   /api/clients                        # 등록
PUT    /api/clients/:id                    # 수정
DELETE /api/clients/:id                    # 삭제
```

### Voucher
```
GET    /api/vouchers                       # 목록
POST   /api/vouchers                       # 등록
PUT    /api/vouchers/:id                   # 수정
DELETE /api/vouchers/:id                   # 삭제
```

### Lookup (조회용)
```
GET /api/counselors                        # 담당자 목록
GET /api/rooms                             # 상담실 목록
GET /api/counseling-types                  # 상담 유형 목록
```

---

## 7. 핵심 컴포넌트

### 공통 컴포넌트 (lib/components/common/)

| 컴포넌트 | 설명 |
|----------|------|
| `Button` | variants: primary, secondary, outline / sizes: sm, md, lg |
| `Input` | text, email, password, number |
| `Select` | 단일/다중 선택 |
| `Toggle` | On/Off 스위치 |
| `Card` | 기본 카드 레이아웃 |
| `Modal` | 오버레이 모달 |
| `DatePicker` | 날짜 선택 (캘린더) |
| `TimePicker` | 시간 선택 (슬롯) |
| `Calendar` | 월간/주간 캘린더 뷰 |
| `Pagination` | 페이지 네비게이션 |
| `SearchInput` | 검색 입력 |
| `SortDropdown` | 정렬 선택 |
| `ProgressBar` | 진행률 바 |
| `Badge` | 상태 뱃지 |
| `Chip` | 선택 가능한 태그 |
| `Sidebar` | 사이드바 네비게이션 |
| `Header` | 상단 헤더 |
| `Layout` | 페이지 레이아웃 래퍼 |

### 도메인 컴포넌트 (lib/components/domain/)

| 컴포넌트 | 설명 |
|----------|------|
| `CounselingCard` | 상담 목록 카드 (내담자, 유형, 진행회기 등) |
| `SessionList` | 회기 목록 (완료/예정 상태 표시) |
| `SessionDetail` | 회기 상세 폼 (목표, 내용, 소견, 메모) |
| `CounselingForm` | 상담 등록/수정 폼 (첫 회기 일정 포함) |
| `ScheduleForm` | 일정 등록/수정 폼 (상담 연결 선택적) |
| `ScheduleCalendar` | 일정 캘린더 뷰 (월간/주간) |
| `ClientSelector` | 내담자 선택 컴포넌트 |
| `CounselingSelector` | 상담 선택 (진행 회기 표시) |
| `CounselorChips` | 담당자 선택 (칩 형태) |
| `RoomSelector` | 상담실 선택 |
| `DurationSelector` | 소요시간 선택 (30/60/90/120/180/240분) |

---

## 8. 인증/권한 설계

### 역할 및 권한 정의 (core/config.py)

```python
ROLES = {
    "admin": {
        "name": "관리자",
        "permissions": ["*"]  # 모든 권한
    },
    "counselor": {
        "name": "상담사",
        "permissions": [
            "counseling:read",
            "counseling:write",
            "counseling:delete",
            "client:read",
            "client:write",
            "session:read",
            "session:write",
            "schedule:read",
            "schedule:write",
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

PERMISSIONS = {
    "counseling:read": "상담 조회",
    "counseling:write": "상담 등록/수정",
    "counseling:delete": "상담 삭제",
    "client:read": "내담자 조회",
    "client:write": "내담자 등록/수정",
    "client:delete": "내담자 삭제",
    "session:read": "회기 조회",
    "session:write": "회기 등록/수정",
    "schedule:read": "일정 조회",
    "schedule:write": "일정 등록/수정",
    "voucher:read": "바우처 조회",
    "voucher:write": "바우처 등록/수정",
    "user:manage": "사용자 관리"
}
```

### 권한 데코레이터 (core/security.py)

```python
from functools import wraps
from fastapi import HTTPException, Depends
from .config import ROLES

def require_permission(*permissions: str):
    """권한 검증 데코레이터"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user=Depends(get_current_user), **kwargs):
            user_role = current_user.role
            user_permissions = ROLES.get(user_role, {}).get("permissions", [])

            # admin은 모든 권한
            if "*" in user_permissions:
                return await func(*args, current_user=current_user, **kwargs)

            # 필요한 권한 검증
            for perm in permissions:
                if perm not in user_permissions:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Permission denied: {perm} required"
                    )

            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

# 사용 예시
@router.post("/counselings")
@require_permission("counseling:write")
async def create_counseling(data: CounselingCreate, current_user: User):
    pass
```

---

## 9. DB 스키마

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'counselor',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### clients (내담자)
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

### rooms (상담실)
```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### schedules (일정) - 공통 테이블
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

### counselings (상담)
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
CREATE INDEX idx_counselings_counselor_id ON counselings(counselor_id);
```

### counseling_sessions (상담세션) - 상담↔일정 연결
```sql
CREATE TABLE counseling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counseling_id UUID NOT NULL REFERENCES counselings(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,  -- nullable
    session_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',  -- scheduled, completed, cancelled
    goal TEXT,           -- 상담 목표
    content TEXT,        -- 상담 내용
    summary TEXT,        -- 종합 소견
    private_memo TEXT,   -- 개인 메모 (본인만 확인)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (counseling_id, session_number)
);

CREATE INDEX idx_counseling_sessions_counseling_id ON counseling_sessions(counseling_id);
CREATE INDEX idx_counseling_sessions_schedule_id ON counseling_sessions(schedule_id);
```

### vouchers (바우처)
```sql
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### counseling_vouchers (N:N 관계)
```sql
CREATE TABLE counseling_vouchers (
    counseling_id UUID REFERENCES counselings(id) ON DELETE CASCADE,
    voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
    PRIMARY KEY (counseling_id, voucher_id)
);
```

### assessments (검사) - 기본 스키마
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

### assessment_sessions (검사세션) - 기본 스키마
```sql
CREATE TABLE assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    session_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assessment_id, session_number)
);
```

---

## 10. Playbook 페이지

### 구성

```
/playbook
├── Design Tokens
│   ├── Colors
│   │   ├── Primary: #3B82F6 (Blue 500)
│   │   ├── Secondary: #6B7280 (Gray 500)
│   │   ├── Success: #10B981
│   │   ├── Warning: #F59E0B
│   │   ├── Error: #EF4444
│   │   └── Gray Scale: 50~900
│   │
│   ├── Typography
│   │   ├── Font Family: Pretendard, system-ui
│   │   ├── Sizes: xs(12), sm(14), base(16), lg(18), xl(20), 2xl(24)
│   │   └── Weights: normal(400), medium(500), semibold(600), bold(700)
│   │
│   └── Spacing
│       └── 4px 기준: 1(4), 2(8), 3(12), 4(16), 5(20), 6(24), 8(32), 10(40)
│
├── Components
│   ├── Buttons
│   │   ├── Primary / Secondary / Outline / Ghost
│   │   ├── Sizes: sm / md / lg
│   │   └── States: default / hover / active / disabled
│   │
│   ├── Form Inputs
│   │   ├── Text Input (with validation states)
│   │   ├── Select / Multi-select
│   │   ├── Toggle Switch
│   │   ├── DatePicker
│   │   └── TimePicker (slot selection)
│   │
│   ├── Calendar
│   │   ├── Monthly View
│   │   ├── Weekly View
│   │   └── Event Display
│   │
│   ├── Cards
│   │   └── CounselingCard 예제
│   │
│   ├── Modals
│   │   ├── 상담 등록 모달 예제
│   │   └── 일정 등록 모달 예제
│   │
│   └── Navigation
│       ├── Sidebar
│       └── Breadcrumb
│
└── Patterns
    ├── Form Layouts
    │   └── 라벨 + 입력 + 에러메시지 배치
    │
    ├── List/Grid Views
    │   └── 카드 그리드 (4열) + 페이지네이션
    │
    ├── Calendar Views
    │   └── 월간/주간 전환 + 일정 표시
    │
    └── Detail Page
        └── 좌우 분할 (목록 + 상세)
```

---

## 11. 회기 관리 플로우

### 상담 등록 시 (트랜잭션)

```
[상담 등록 모달]
├── 내담자 선택
├── 상담 유형 / 담당자 / 바우처
├── 총 회기 설정 (기본 20)
└── 첫 회기 일정 설정 (필수)
    ├── 날짜/시간
    ├── 소요시간
    └── 상담실

→ 트랜잭션:
   1. Counseling 생성
   2. Schedule 생성 (첫 회기 일정)
   3. CounselingSession 생성 (session_number=1, schedule_id 연결)
```

### 회기 추가 - 시나리오 A (상담 상세에서)

```
상담 상세 페이지
└── "회기 추가" 버튼
    └── 회기 생성 (schedule_id = null)
        └── 나중에 "일정 연결" 버튼으로 일정 연결
```

### 회기 추가 - 시나리오 B (캘린더에서)

```
스케줄 페이지 (캘린더)
└── "일정 추가" 버튼
    └── 일정 등록 모달
        ├── 날짜/시간 / 소요시간 / 상담실 / 담당자
        └── "상담 연결" (선택)
            └── 상담 선택 시: "김은서 상담 - 3/20 회기" 표시
                → Schedule 생성 + CounselingSession 생성 (4회기, schedule_id 연결)
```

### session_number 자동 계산

```python
# 새 회기 추가 시
def get_next_session_number(counseling_id: UUID) -> int:
    max_number = db.query(func.max(CounselingSession.session_number))\
        .filter(CounselingSession.counseling_id == counseling_id)\
        .scalar()
    return (max_number or 0) + 1
```

---

## 구현 순서 (권장)

1. **모노리포 세팅**
   - pnpm + Turborepo 초기화
   - apps/web, apps/api 구조 생성
   - 스크립트 인터페이스 설정

2. **Backend 기본 구조**
   - FastAPI 프로젝트 구조
   - PostgreSQL 연결 + Alembic 설정
   - JWT 인증 + 권한 데코레이터

3. **DB 스키마 마이그레이션**
   - schedules 테이블 (공통 일정)
   - counseling_sessions 테이블 (상담세션)
   - assessments, assessment_sessions (기본 스키마만)

4. **Frontend 기본 구조**
   - SvelteKit 프로젝트 생성
   - Tailwind CSS 설정
   - 레이아웃 (Sidebar, Header)

5. **Playbook 페이지**
   - 디자인 토큰 정의
   - 공통 컴포넌트 구현 (Calendar 포함)

6. **내담자 CRUD**
   - 간단한 도메인으로 전체 플로우 검증

7. **스케줄 기능**
   - Schedule API 구현
   - 캘린더 컴포넌트 구현
   - 스케줄 페이지 (월간/주간 뷰)

8. **상담 기능**
   - 목록 (카드 그리드)
   - 등록 (첫 회기 + 일정 트랜잭션)
   - 상세 (회기 목록 + 회기 상세)

9. **회기 관리**
   - 회기 추가 (상담 상세 경로)
   - 일정 연결 (캘린더 경로)
   - 회기 기록 수정
