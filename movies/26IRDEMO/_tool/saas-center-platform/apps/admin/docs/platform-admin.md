# 플랫폼 관리자 웹 설계

> SaaS 플랫폼 운영을 위한 관리자 전용 웹 애플리케이션 설계 문서

---

## 1. 개요

### 1.1 목적

플랫폼 운영에 필요한 관리 기능을 제공하는 독립 웹 애플리케이션.
센터 관리, 계정 관리, 검사 마스터 데이터 관리, 운영 모니터링을 수행한다.

### 1.2 역할 구분

| 역할 | 범위 | 접근 대상 |
|------|------|-----------|
| **플랫폼 관리자** | 전체 시스템 운영 | 센터 메타, 계정, 검사 마스터, 집계 통계, 시스템 로그 |
| **센터 관리자** | 자신의 센터 | 센터 내부 모든 데이터 (내담자, 상담, 검사 결과 등) |

### 1.3 데이터 접근 원칙

**"운영에 필요한 것만 접근한다"**

플랫폼 관리자는 서비스 운영 목적(약관 제8조 4항)으로 데이터에 접근한다.
내담자 상세정보, 상담 노트, 검사 결과 등은 운영에 불필요하므로 관리자 API에 포함하지 않는다.

```
접근 가능 (운영 필수):
  - 센터 메타데이터 (이름, 상태, 구독, 사업자번호)
  - 계정 정보 (이메일, 로그인 이력, 잠금 상태)
  - 집계 통계 (센터별 내담자 수, 상담 건수 - 숫자만)
  - 검사 마스터 데이터 (검사 도구 등록/수정)
  - 결제/청구 정보
  - 시스템 로그 (에러, API 호출량, 메시징 발송 현황)

접근 불필요 (API 미구현):
  - 내담자 개인정보 (이름, 연락처, 생년월일)
  - 상담 노트/회기 내용
  - 검사 결과/점수/소견
  - 내담자-보호자 관계 정보
  - 센터 내부 문서 콘텐츠
```

비상 상황(장애 대응, 데이터 정합성 문제)은 DBA가 DB 직접 접근으로 처리한다.

---

## 2. 배포 아키텍처

### 2.1 독립 앱 (apps/admin)

```
saas-center-platform/
├── apps/
│   ├── web/          # 센터용 웹 (기존)
│   ├── api/          # 백엔드 API (기존)
│   └── admin/        # 플랫폼 관리자 웹 (신규)
└── packages/         # 공유 라이브러리
```

### 2.2 분리 이유

- 센터용 앱 번들에 관리자 코드 미포함
- 관리자 웹 독립 배포/롤백 가능
- 네트워크 레벨 접근 통제 적용 가능 (IP 화이트리스트, VPN)
- 도메인 분리: `admin.insighter.co.kr` (관리자) / `app.insighter.co.kr` (센터)

### 2.3 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | SvelteKit 2 | 기존 web과 동일 (코드 공유 용이) |
| 언어 | TypeScript 5.7+ | strict 모드 |
| UI | Svelte 5 (Runes) + TailwindCSS | 기존 패턴 유지 |
| 상태 관리 | TanStack Query v5 | 서버 상태 캐싱 |
| HTTP | Axios | JWT 인터셉터 공유 |

### 2.4 API 구조

```
백엔드 (apps/api):
  /api/v1/centers/{center_id}/*     # 센터용 API (기존)
  /api/v1/admin/*                   # 관리자 전용 API (신규)

관리자 API는 센터용 Facade/Service를 재사용하지 않고 별도 모듈로 구성.
```

---

## 3. 인증/인가 설계

### 3.1 인증 방식: 기존 Account 확장

현재 Account 모델에 `platform_role` 필드를 추가한다.
별도 인증 시스템을 만들지 않고, 동일 JWT 토큰 시스템을 활용한다.

#### Account 모델 변경

```python
class Account(Base):
    # 기존 필드 유지...

    platform_role: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        default=None,
        index=True,
        comment="플랫폼 역할: platform_admin, platform_superadmin, null(일반)"
    )
```

#### 플랫폼 역할 정의

> 백엔드 `AdminRole` 상수 기준 (`apps/api/app/modules/platform_admin/admin_account/models.py`)

| 역할 | 코드 | 권한 범위 |
|------|------|-----------|
| CS 담당자 | `customer_service` | 조회 + 공지사항 작성. 데이터 변경·시스템 조작 불가 |
| 플랫폼 관리자 | `admin` | 운영 기능 전체 (센터/계정/검사/공지/AI 관리) |
| 슈퍼관리자 | `super_admin` | 전체 기능 + 어드민 계정 관리 + 시스템 설정 |

#### 페이지별 접근 권한 매트릭스

| 페이지 | `super_admin` | `admin` | `customer_service` | 비고 |
|--------|:---:|:---:|:---:|------|
| 대시보드 | ✅ | ✅ | ✅ | |
| 센터 신청 (목록/상세 조회) | ✅ | ✅ | ✅ | |
| 센터 신청 (승인/거절) | ✅ | ✅ | ❌ | |
| 센터 관리 (목록/상세 조회) | ✅ | ✅ | ✅ | |
| 센터 관리 (정지/활성화) | ✅ | ✅ | ❌ | |
| 계정 관리 (목록/상세 조회) | ✅ | ✅ | ✅ | |
| 계정 관리 (잠금/강제로그아웃) | ✅ | ✅ | ❌ | |
| 검사 관리 (목록/상세 조회) | ✅ | ✅ | ✅ | |
| 검사 관리 (등록/수정/삭제) | ✅ | ✅ | ❌ | |
| 공지사항 관리 | ✅ | ✅ | ✅ | CS도 작성 가능 |
| AI 사용량 관리 | ✅ | ✅ | ❌ | |
| 어드민 계정 관리 | ✅ | ❌ | ❌ | 슈퍼관리자 전용 |
| 시스템 설정 | ✅ | ❌ | ❌ | 슈퍼관리자 전용 |

**설계 결정 - Account vs Person**:
- `platform_role`을 **Account**에 둔다 (Person이 아닌)
- 이유: 플랫폼 역할은 "인증 주체"의 속성이지, "사람 정보"의 속성이 아님
- Account는 인증/권한의 주체, Person은 인적 정보
- 플랫폼 관리자가 반드시 센터 멤버일 필요 없음 (Person 없이도 동작)

#### JWT 토큰 확장

```python
# 기존 JWT payload
{
    "account_id": str,
    "person_id": str | None,     # 플랫폼 전용 관리자는 null 가능
    "email": str,
    "token_version": int,
    "account_token_version": int,
    "platform_role": str | None, # 신규 추가
    "exp": datetime,
}
```

### 3.2 인가 미들웨어

#### 핵심 Dependency 함수

```python
# apps/api/app/core/dependencies.py

async def get_verified_platform_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """플랫폼 관리자 이상 권한 검증"""
    platform_role = current_user.get("platform_role")
    if platform_role not in ("platform_admin", "platform_superadmin"):
        raise PermissionDeniedException("플랫폼 관리자 권한이 필요합니다")
    return current_user


async def get_verified_platform_superadmin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """플랫폼 슈퍼관리자 권한 검증"""
    if current_user.get("platform_role") != "platform_superadmin":
        raise PermissionDeniedException("플랫폼 슈퍼관리자 권한이 필요합니다")
    return current_user
```

#### Router 적용 패턴

```python
# 관리자 라우터 예시
@router.get("/admin/centers")
async def list_centers(
    admin: dict = Depends(get_verified_platform_admin),
    uow: UnitOfWork = Depends(get_uow),
):
    ...

# 슈퍼관리자 전용 라우터 예시
@router.patch("/admin/settings")
async def update_settings(
    admin: dict = Depends(get_verified_platform_superadmin),
    uow: UnitOfWork = Depends(get_uow),
):
    ...
```

### 3.3 추가 보안 레이어

#### 관리자 세션 정책

| 항목 | 센터 사용자 | 플랫폼 관리자 |
|------|------------|--------------|
| Access Token 만료 | 30분 | 15분 |
| Refresh Token 만료 | 7일 | 1일 |
| 비활성 타임아웃 | 없음 | 30분 (프론트엔드) |

```python
# 토큰 생성 시 platform_role에 따라 만료 시간 분기
def create_access_token(payload: dict) -> str:
    if payload.get("platform_role"):
        expire = timedelta(minutes=15)  # 관리자: 15분
    else:
        expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)  # 일반: 30분
    ...
```

#### 관리자 감사 로그 (전건 기록)

관리자의 모든 API 호출을 기록한다. 기존 `activity_log`와 별도 테이블 사용.

```python
class PlatformAuditLog(Base):
    """플랫폼 관리자 행위 감사 로그 (append-only)"""
    __tablename__ = "platform_audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    admin_account_id: Mapped[str]           # 관리자 Account ID
    admin_email: Mapped[str]                # 비정규화 (JOIN 방지)
    action: Mapped[str]                     # "POST /admin/centers/{id}/suspend"
    method: Mapped[str]                     # HTTP method
    path: Mapped[str]                       # 요청 경로
    request_body: Mapped[dict | None]       # 요청 본문 (민감정보 마스킹)
    response_status: Mapped[int]            # 응답 상태 코드
    ip_address: Mapped[str]
    user_agent: Mapped[str | None]
    created_at: Mapped[datetime]
```

미들웨어로 자동 기록:

```python
@app.middleware("http")
async def platform_audit_middleware(request: Request, call_next):
    response = await call_next(request)

    # /admin/* 경로만 기록
    if request.url.path.startswith("/api/v1/admin"):
        await log_platform_audit(request, response)

    return response
```

#### IP 화이트리스트 (운영 환경)

```python
# 환경 변수로 관리
ADMIN_ALLOWED_IPS=["10.0.0.0/8", "192.168.1.0/24"]

@app.middleware("http")
async def admin_ip_whitelist(request: Request, call_next):
    if request.url.path.startswith("/api/v1/admin"):
        client_ip = request.client.host
        if not is_allowed_ip(client_ip, settings.ADMIN_ALLOWED_IPS):
            return JSONResponse(status_code=403, content={"detail": "Access denied"})
    return await call_next(request)
```

> Phase 2에서 적용. 개발 중에는 비활성화.

### 3.4 관리자 계정 생성 방식

플랫폼 관리자는 UI에서 회원가입하지 않는다.

```
방법 1 (MVP): CLI/스크립트로 직접 생성
  → uv run python scripts/create_platform_admin.py --email admin@insighter.co.kr

방법 2 (Phase 2): 슈퍼관리자가 관리자 웹에서 초대
  → POST /api/v1/admin/admins/invite {email, platform_role}
```

---

## 4. 기능 목록

### 4.1 Phase 1 - MVP

센터 신청 처리와 기본 운영에 필요한 최소 기능.

#### 4.1.1 센터 신청 관리

기존 `/admin` 라우트의 센터 신청 승인 기능을 이관 + 확장.

```
GET    /api/v1/admin/center-applications
GET    /api/v1/admin/center-applications/{id}
POST   /api/v1/admin/center-applications/{id}/approve
POST   /api/v1/admin/center-applications/{id}/reject
```

**GET /api/v1/admin/center-applications**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `status` | query | `pending` \| `approved` \| `rejected` |
| `page` | query | 페이지 번호 (default: 1) |
| `size` | query | 페이지 크기 (default: 20) |
| `search` | query | 신청자 이름/센터명 검색 |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "center_name": "마음샘 상담센터",
      "applicant_name": "김대표",
      "applicant_email": "kim@example.com",
      "business_registration_number": "123-45-67890",
      "status": "pending",
      "created_at": "2026-02-01T09:00:00",
      "reviewed_at": null,
      "reviewed_reason": null
    }
  ],
  "total": 5,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

**POST /api/v1/admin/center-applications/{id}/approve**

Request:
```json
{
  "admin_memo": "서류 확인 완료"
}
```

동작:
1. CenterApplication.status → `approved`
2. CenterApplication.reviewed_by → 관리자 account_id
3. Center 엔티티 생성
4. 신청자를 Center Admin (Role: ADMIN)으로 등록
5. 글로벌 Role 템플릿 → 센터로 복사
6. 승인 알림 발송 (이메일/알림톡)
7. 감사 로그 기록

**POST /api/v1/admin/center-applications/{id}/reject**

Request:
```json
{
  "reason": "사업자등록증 미첨부",
  "admin_memo": "재신청 안내 완료"
}
```

#### 4.1.2 센터 관리

```
GET    /api/v1/admin/centers
GET    /api/v1/admin/centers/{center_id}
PATCH  /api/v1/admin/centers/{center_id}
POST   /api/v1/admin/centers/{center_id}/suspend
POST   /api/v1/admin/centers/{center_id}/activate
```

**GET /api/v1/admin/centers**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `status` | query | `active` \| `suspended` \| `all` |
| `search` | query | 센터명/사업자번호 검색 |
| `sort_by` | query | `created_at` \| `name` \| `member_count` |
| `page`, `size` | query | 페이징 |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "마음샘 상담센터",
      "code": "ABC123",
      "representative_name": "김대표",
      "phone": "02-1234-5678",
      "is_active": true,
      "member_count": 12,
      "created_at": "2026-01-01T00:00:00"
    }
  ],
  "total": 100,
  "page": 1,
  "size": 20,
  "pages": 5
}
```

> `member_count`는 집계 서브쿼리. 내담자 수, 상담 건수 등은 Phase 2 통계에서.

**GET /api/v1/admin/centers/{center_id}**

센터 상세 정보 (메타데이터만):
```json
{
  "id": "uuid",
  "name": "마음샘 상담센터",
  "code": "ABC123",
  "phone": "02-1234-5678",
  "address": {
    "zip_code": "06100",
    "address": "서울시 강남구",
    "detail": "101호"
  },
  "business_registration_number": "123-45-67890",
  "representative_name": "김대표",
  "logo_url": "https://...",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00",
  "members": [
    {
      "id": "uuid",
      "name": "김상담",
      "email": "kim@example.com",
      "role_name": "센터 관리자",
      "status": "active"
    }
  ]
}
```

> 멤버 목록은 이름/이메일/역할 정도만 노출. 내담자 정보는 미포함.

**POST /api/v1/admin/centers/{center_id}/suspend**

Request:
```json
{
  "reason": "결제 미납 (3개월)",
  "suspended_until": "2026-06-30T23:59:59"
}
```

동작:
1. Center.is_active → `false`
2. 센터 관리자에게 정지 알림 발송
3. 해당 센터 API 접근 차단 (기존 `get_verified_center_id`에서 is_active 체크)
4. 감사 로그 기록

**POST /api/v1/admin/centers/{center_id}/activate**

동작:
1. Center.is_active → `true`
2. 재활성화 알림 발송
3. 감사 로그 기록

#### 4.1.3 계정 관리

```
GET    /api/v1/admin/accounts
GET    /api/v1/admin/accounts/{account_id}
POST   /api/v1/admin/accounts/{account_id}/lock
POST   /api/v1/admin/accounts/{account_id}/unlock
POST   /api/v1/admin/accounts/{account_id}/force-logout
```

**GET /api/v1/admin/accounts**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `search` | query | 이메일 검색 |
| `is_active` | query | 활성 상태 필터 |
| `provider` | query | `email` \| `kakao` \| `naver` \| `google` |
| `page`, `size` | query | 페이징 |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "provider": "email",
      "is_active": true,
      "is_verified": true,
      "last_login_at": "2026-02-27T09:00:00",
      "created_at": "2026-01-01T00:00:00",
      "centers": [
        {
          "center_id": "uuid",
          "center_name": "마음샘 상담센터",
          "role_name": "상담사"
        }
      ]
    }
  ]
}
```

> 계정이 소속된 센터 목록은 표시하되, 센터 내부 활동 내역은 미포함.

**POST /api/v1/admin/accounts/{account_id}/lock**

Request:
```json
{
  "reason": "보안 위반 의심"
}
```

동작:
1. Account.is_active → `false`
2. Account.token_version 증가 (즉시 로그아웃)
3. 감사 로그 기록

**POST /api/v1/admin/accounts/{account_id}/force-logout**

동작:
1. Account.token_version 증가 (기존 모든 세션 무효화)
2. 감사 로그 기록

> 계정 잠금과 달리 로그인 자체는 가능. 현재 세션만 끊는 용도.

#### 4.1.4 검사 마스터 데이터 관리

검사 도구(Assessment)의 등록/수정/삭제. 센터가 사용하는 검사 목록을 관리.

```
GET    /api/v1/admin/assessments
POST   /api/v1/admin/assessments
PATCH  /api/v1/admin/assessments/{assessment_id}
DELETE /api/v1/admin/assessments/{assessment_id}
POST   /api/v1/admin/assessments/{assessment_id}/restore
```

**POST /api/v1/admin/assessments**

Request:
```json
{
  "code": "KPRC-U",
  "kor_name": "한국판 인물화 검사",
  "eng_name": "Korean Person Drawing Test",
  "type": "projective",
  "description": "투사적 검사 도구",
  "duration": 30,
  "age": "5세~성인",
  "status": "public"
}
```

**DELETE /api/v1/admin/assessments/{assessment_id}**

Soft Delete (deleted_at 설정). 이미 사용 중인 센터에는 영향 없음.

**POST /api/v1/admin/assessments/{assessment_id}/restore**

삭제된 검사 복구 (deleted_at → null).

---

### 4.2 Phase 2 - 운영

#### 4.2.1 대시보드 통계

```
GET /api/v1/admin/stats/overview
GET /api/v1/admin/stats/centers
GET /api/v1/admin/stats/assessments
GET /api/v1/admin/stats/trend
```

**GET /api/v1/admin/stats/overview**

```json
{
  "centers": {
    "total": 150,
    "active": 142,
    "suspended": 8
  },
  "accounts": {
    "total": 3500,
    "active": 3200,
    "new_this_month": 85
  },
  "assessments": {
    "total_conducted": 12000,
    "this_month": 450
  },
  "messaging": {
    "sms_sent_this_month": 2300,
    "alarmtalk_sent_this_month": 5600
  }
}
```

> 모든 수치는 COUNT 집계. 개별 레코드 노출 없음.

**GET /api/v1/admin/stats/trend**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `metric` | query | `new_centers` \| `new_accounts` \| `assessments` \| `messages` |
| `period` | query | `daily` \| `weekly` \| `monthly` |
| `date_from`, `date_to` | query | 기간 |

Response:
```json
{
  "metric": "new_centers",
  "period": "monthly",
  "data": [
    {"date": "2026-01", "value": 12},
    {"date": "2026-02", "value": 18}
  ]
}
```

**GET /api/v1/admin/stats/centers**

센터별 사용량 집계:
```json
{
  "items": [
    {
      "center_id": "uuid",
      "center_name": "마음샘 상담센터",
      "member_count": 12,
      "client_count": 230,
      "assessment_case_count": 450,
      "counseling_session_count": 1200,
      "created_at": "2026-01-01T00:00:00"
    }
  ]
}
```

> `client_count` 등은 숫자만. 내담자 목록/상세는 미제공.

#### 4.2.2 감사 로그 뷰어

```
GET /api/v1/admin/audit-logs
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `admin_email` | query | 관리자 이메일 필터 |
| `method` | query | `GET` \| `POST` \| `PATCH` \| `DELETE` |
| `path_contains` | query | 경로 검색 (예: "centers") |
| `date_from`, `date_to` | query | 기간 |
| `page`, `size` | query | 페이징 |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "admin_email": "admin@insighter.co.kr",
      "method": "POST",
      "path": "/api/v1/admin/center-applications/uuid/approve",
      "request_body": {"admin_memo": "승인 완료"},
      "response_status": 200,
      "ip_address": "10.0.1.50",
      "created_at": "2026-02-27T10:30:00"
    }
  ]
}
```

#### 4.2.3 메시징 모니터링

기존 messaging 모듈의 발송 현황을 조회.

```
GET /api/v1/admin/messaging/stats
GET /api/v1/admin/messaging/logs
```

**GET /api/v1/admin/messaging/stats**

```json
{
  "today": {
    "sms_sent": 45,
    "sms_failed": 2,
    "alarmtalk_sent": 120,
    "alarmtalk_failed": 5
  },
  "this_month": {
    "sms_sent": 2300,
    "sms_failed": 23,
    "alarmtalk_sent": 5600,
    "alarmtalk_failed": 48
  }
}
```

**GET /api/v1/admin/messaging/logs**

발송 로그 조회 (수신번호 마스킹):
```json
{
  "items": [
    {
      "id": "uuid",
      "center_name": "마음샘 상담센터",
      "message_type": "ALARMTALK",
      "recipient": "010-****-5678",
      "template_code": "RESERVATION_CONFIRM",
      "status": "SENT",
      "sent_at": "2026-02-27T10:00:00",
      "error_message": null
    }
  ]
}
```

> 수신번호는 중간 4자리 마스킹. 메시지 본문은 미포함.

#### 4.2.4 Role 템플릿 관리

글로벌 Role 템플릿 (center_id = NULL) CRUD.

```
GET    /api/v1/admin/role-templates
POST   /api/v1/admin/role-templates
PATCH  /api/v1/admin/role-templates/{role_id}
DELETE /api/v1/admin/role-templates/{role_id}
```

**GET /api/v1/admin/role-templates**

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "ADMIN",
      "name": "센터 관리자",
      "description": "센터 내 모든 권한",
      "permission_count": 40,
      "permissions": [
        {"id": 1, "code": "manage:center", "name": "센터 관리", "category": "center"}
      ],
      "version": 3
    }
  ]
}
```

> 센터 생성 시 이 템플릿이 복사됨. 복사된 Role은 센터 관리자가 자유롭게 수정 가능.

#### 4.2.5 공지사항 관리

```
GET    /api/v1/admin/notices
POST   /api/v1/admin/notices
PATCH  /api/v1/admin/notices/{notice_id}
DELETE /api/v1/admin/notices/{notice_id}
```

센터 사용자에게 표시할 시스템 공지. 점검 안내, 업데이트 내역 등.

---

### 4.3 Phase 3 - 고도화

#### 4.3.1 구독/결제 관리

> billing 모듈 구현 후 진행

```
GET    /api/v1/admin/subscriptions
GET    /api/v1/admin/subscriptions/{center_id}
PATCH  /api/v1/admin/subscriptions/{center_id}
GET    /api/v1/admin/billing/invoices
```

#### 4.3.2 어드민 계정 관리 (슈퍼관리자 전용)

```
GET    /api/v1/admin/admin-accounts
POST   /api/v1/admin/admin-accounts/invite
PATCH  /api/v1/admin/admin-accounts/{account_id}
DELETE /api/v1/admin/admin-accounts/{account_id}/revoke
POST   /api/v1/admin/admin-accounts/{account_id}/lock
POST   /api/v1/admin/admin-accounts/{account_id}/unlock
```

- `super_admin`만 접근 가능 (`require_admin_role("super_admin")`)
- 초대: 이메일 + 역할(`admin` | `customer_service`) 지정
- 역할 변경, 잠금/해제, 계정 해제 포함
- 자기 자신 계정은 수정/삭제 불가

#### 4.3.3 전역 설정

```
GET   /api/v1/admin/settings
PATCH /api/v1/admin/settings
```

```json
{
  "file_upload": {
    "max_size_mb": 10,
    "allowed_extensions": [".pdf", ".jpg", ".png", ".docx"]
  },
  "assessment": {
    "default_duration": 60,
    "max_participants": 20
  },
  "notification": {
    "email_enabled": true,
    "sms_enabled": true,
    "alarmtalk_enabled": true
  },
  "center_application": {
    "auto_approve": false,
    "require_business_registration": true
  }
}
```

---

## 5. 백엔드 모듈 구조

### 5.1 디렉토리 구조

```
apps/api/app/modules/platform_admin/
├── __init__.py
├── router.py                        # 라우터 등록 (prefix="/api/v1/admin")
├── center_application/
│   ├── handlers.py
│   ├── schemas.py
│   └── services/
│       ├── approve_application_service.py
│       └── reject_application_service.py
├── center_management/
│   ├── handlers.py
│   ├── schemas.py
│   ├── repository.py                # 관리자 전용 쿼리 (집계, 메타만)
│   └── services/
│       ├── list_centers_service.py
│       ├── get_center_detail_service.py
│       ├── suspend_center_service.py
│       └── activate_center_service.py
├── account_management/
│   ├── handlers.py
│   ├── schemas.py
│   ├── repository.py
│   └── services/
│       ├── list_accounts_service.py
│       ├── lock_account_service.py
│       ├── unlock_account_service.py
│       └── force_logout_service.py
├── assessment_management/
│   ├── handlers.py
│   ├── schemas.py
│   └── services/
│       ├── create_assessment_service.py
│       ├── update_assessment_service.py
│       ├── delete_assessment_service.py
│       └── restore_assessment_service.py
├── stats/
│   ├── handlers.py
│   ├── schemas.py
│   └── repository.py               # 집계 전용 쿼리
├── audit_log/
│   ├── handlers.py
│   ├── schemas.py
│   ├── models.py                    # PlatformAuditLog
│   ├── repository.py
│   └── middleware.py                # 자동 기록 미들웨어
└── messaging_monitor/
    ├── handlers.py
    ├── schemas.py
    └── repository.py               # 발송 현황 집계 (마스킹 적용)
```

### 5.2 아키텍처 패턴

기존 프로젝트 패턴을 따르되, 관리자 모듈 특성을 반영:

```
Request → Router → Handler → Service → Repository → DB
                      ↓
                 Unit of Work
```

**Facade 불필요**: 관리자 기능은 도메인 간 복합 조합이 적음.
센터 승인처럼 복잡한 경우만 Handler에서 여러 Service를 직접 조합.

```python
# 센터 승인 Handler 예시 (복합 로직)
async def approve_application_handler(
    application_id: str,
    data: ApproveRequest,
    admin: dict,  # get_verified_platform_admin
    uow: UnitOfWork,
) -> CenterApplicationResponse:
    async with uow:
        # 1. 신청 승인 처리
        approve_service = ApproveApplicationService(uow.repo(CenterApplicationRepository))
        application = await approve_service.execute(application_id, admin["account_id"])

        # 2. 센터 생성
        create_center_service = CreateCenterService(uow.repo(CenterRepository))
        center = await create_center_service.execute(application)

        # 3. 글로벌 Role 복사
        copy_roles_service = CopyRoleTemplatesService(uow.repo(RoleRepository))
        await copy_roles_service.execute(center.id)

        # 4. 신청자를 센터 관리자로 등록
        create_member_service = CreateMemberService(uow.repo(MemberRepository))
        await create_member_service.execute(center.id, application.created_by, admin_role_id)

        await uow.commit()

    # 5. 트랜잭션 외: 알림 발송 (BackgroundTask)
    return CenterApplicationResponse.model_validate(application)
```

### 5.3 센터용 모듈과의 관계

```
관리자 모듈은 기존 센터용 모듈의 Model은 참조하되,
Service/Facade/Repository는 재사용하지 않는다.

✅ 허용:
  - from app.modules.center.center.models import Center
  - from app.modules.auth.account.models import Account
  - from app.modules.messaging.models import MessageLog

❌ 금지:
  - from app.modules.center.facade import CenterFacade
  - from app.modules.client.repository import ClientRepository
  - from app.modules.counseling.services import ...

이유:
  - 관리자 쿼리는 센터 쿼리와 접근 범위가 다름 (전체 vs 센터 내)
  - 관리자 Repository는 집계/메타 위주, 센터 Repository는 상세 위주
  - 결합도를 낮춰서 관리자 기능 변경이 센터 기능에 영향을 주지 않도록
```

---

## 6. 프론트엔드 구조 (apps/admin)

### 6.1 디렉토리 구조

```
apps/admin/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte           # 관리자 레이아웃 (사이드바, 헤더)
│   │   ├── +page.svelte             # 대시보드 (리다이렉트 또는 overview)
│   │   ├── login/
│   │   │   └── +page.svelte         # 관리자 로그인
│   │   ├── centers/
│   │   │   ├── +page.svelte         # 센터 목록
│   │   │   └── [centerId]/
│   │   │       └── +page.svelte     # 센터 상세
│   │   ├── applications/
│   │   │   └── +page.svelte         # 센터 신청 목록 + 승인/거절
│   │   ├── accounts/
│   │   │   └── +page.svelte         # 계정 목록 + 잠금/해제
│   │   ├── assessments/
│   │   │   ├── +page.svelte         # 검사 목록
│   │   │   └── [assessmentId]/
│   │   │       └── +page.svelte     # 검사 상세/수정
│   │   ├── stats/                   # Phase 2
│   │   │   └── +page.svelte         # 통계 대시보드
│   │   ├── audit-logs/              # Phase 2
│   │   │   └── +page.svelte         # 감사 로그
│   │   ├── messaging/               # Phase 2
│   │   │   └── +page.svelte         # 메시징 모니터링
│   │   └── settings/                # Phase 3
│   │       └── +page.svelte         # 전역 설정
│   ├── lib/
│   │   ├── api/                     # Admin API 엔드포인트
│   │   ├── components/              # 관리자 전용 컴포넌트
│   │   ├── stores/                  # auth store (관리자용)
│   │   └── types/                   # TypeScript 타입
│   └── app.html
├── svelte.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 6.2 공유 코드 (packages/)

센터 웹과 관리자 웹에서 공통으로 사용하는 코드:

```
packages/shared/          # 신규 또는 기존 패턴 활용
├── components/           # 공통 UI 컴포넌트 (Table, Modal, Badge 등)
├── utils/                # 날짜, 포맷, 검증 유틸
├── types/                # 공통 타입 (Pagination, ApiResponse 등)
└── services/             # Axios 인스턴스, 에러 핸들링
```

> 초기에는 코드 복사로 시작하고, 중복이 늘어나면 packages/로 추출해도 됨.

### 6.3 페이지별 기능 요약

| 페이지 | 주요 기능 | 접근 가능 역할 | Phase |
|--------|----------|--------------|-------|
| `/login` | 관리자 로그인 (이메일+비밀번호) | 전체 | 1 |
| `/dashboard` | 운영 현황 요약 | 전체 | 1 |
| `/applications` | 센터 신청 목록, 상세 보기, 승인/거절 | 전체 (조회) / admin+ (승인·거절) | 1 |
| `/centers` | 센터 목록, 검색, 상태 필터 | 전체 | 1 |
| `/centers/[id]` | 센터 상세 (메타+멤버), 정지/활성화 | 전체 (조회) / admin+ (정지·활성화) | 1 |
| `/accounts` | 계정 목록, 검색, 잠금/해제/강제 로그아웃 | 전체 (조회) / admin+ (잠금·로그아웃) | 1 |
| `/assessments` | 검사 도구 목록/상세/등록/수정/삭제 | 전체 (조회) / admin+ (CUD) | 1 |
| `/notices` | 공지사항 작성/수정/삭제 | 전체 | 1 |
| `/ai-usage` | AI 사용량 조회 | admin+ | 1 |
| `/admin-accounts` | 어드민 계정 목록/초대/해제 | super_admin 전용 | 2 |
| `/stats` | 대시보드 통계 (차트, 추이) | admin+ | 2 |
| `/audit-logs` | 감사 로그 조회/검색 | admin+ | 2 |
| `/messaging` | 메시징 발송 현황/에러 모니터링 | admin+ | 2 |
| `/settings` | 전역 설정 관리 | super_admin 전용 | 3 |

---

## 7. DB 스키마 변경 사항

### 7.1 Account 테이블 (수정)

```sql
ALTER TABLE accounts ADD COLUMN platform_role VARCHAR(30) DEFAULT NULL;
CREATE INDEX idx_accounts_platform_role ON accounts(platform_role) WHERE platform_role IS NOT NULL;
```

### 7.2 PlatformAuditLog 테이블 (신규)

```sql
CREATE TABLE platform_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    admin_account_id VARCHAR(36) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    request_body JSONB,
    response_status INTEGER NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_logs_admin ON platform_audit_logs(admin_account_id, created_at DESC);
CREATE INDEX idx_platform_audit_logs_created ON platform_audit_logs(created_at DESC);
CREATE INDEX idx_platform_audit_logs_path ON platform_audit_logs(path, created_at DESC);
```

### 7.3 Notice 테이블 (신규, Phase 2)

```sql
CREATE TABLE notices (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,        -- maintenance, update, announcement
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,      -- admin account_id
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);
```

---

## 8. 구현 우선순위

### Phase 1 - MVP

| # | 항목 | 의존성 |
|---|------|--------|
| 1 | Account.platform_role 마이그레이션 | 없음 |
| 2 | JWT payload에 platform_role 추가 | #1 |
| 3 | `get_verified_platform_admin` 의존성 함수 | #2 |
| 4 | PlatformAuditLog 모델 + 미들웨어 | #3 |
| 5 | 센터 신청 관리 API | #3, #4 |
| 6 | 센터 관리 API | #3, #4 |
| 7 | 계정 관리 API | #3, #4 |
| 8 | 검사 마스터 관리 API | #3, #4 |
| 9 | apps/admin SvelteKit 프로젝트 초기화 | 없음 |
| 10 | 관리자 로그인 페이지 | #9 |
| 11 | 센터 신청/관리 페이지 | #5, #6, #10 |
| 12 | 계정 관리 페이지 | #7, #10 |
| 13 | 검사 관리 페이지 | #8, #10 |
| 14 | 관리자 계정 생성 스크립트 | #1 |

### Phase 2 - 운영

| # | 항목 | 접근 역할 |
|---|------|----------|
| 15 | 대시보드 통계 API + 페이지 | admin+ |
| 16 | 어드민 계정 관리 API + 페이지 (`/admin-accounts`) | super_admin |
| 17 | 감사 로그 뷰어 | admin+ |
| 18 | 메시징 모니터링 | admin+ |
| 19 | Role 템플릿 관리 | admin+ |
| 20 | IP 화이트리스트 미들웨어 | — |

### Phase 3 - 고도화

| # | 항목 | 접근 역할 |
|---|------|----------|
| 21 | 구독/결제 관리 | admin+ |
| 22 | 전역 설정 관리 (`/settings`) | super_admin |
| 23 | 센터 데이터 내보내기 지원 | super_admin |

---

## 9. 참고

- **기존 문서**: `docs/billing/`, `docs/auth/`
- **아키텍처 패턴**: `CLAUDE.md` 참조
- **기존 admin 코드**: `apps/web/src/routes/admin/` (Phase 1 완료 후 제거 또는 리다이렉트)
- **센터 신청 TODO**: `apps/api/app/modules/center/center_application/router.py:59` - 관리자 인증 미구현 상태
