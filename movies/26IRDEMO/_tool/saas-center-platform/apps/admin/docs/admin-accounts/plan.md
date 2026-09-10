# 어드민 계정 관리 페이지 기획

> `super_admin` 전용. 플랫폼 관리자 계정(AdminAccount)을 조회·초대·수정·잠금 관리하는 화면.
>
> 센터 사용자 계정 관리(`docs/accounts/plan.md`)와 완전히 별개의 도메인.

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [데이터 모델](#데이터-모델)
3. [페이지 구조](#페이지-구조)
4. [어드민 계정 목록](#어드민-계정-목록)
5. [어드민 계정 상세 모달](#어드민-계정-상세-모달)
6. [계정 초대 모달](#계정-초대-모달)
7. [액션 정의](#액션-정의)
8. [API 엔드포인트](#api-엔드포인트)
9. [프론트엔드 구현 계획](#프론트엔드-구현-계획)
10. [백엔드 구현 계획](#백엔드-구현-계획)

---

## 도메인 개요

### 목적

플랫폼 운영을 위한 어드민 계정(`admin_accounts` 테이블)을 슈퍼관리자가 직접 관리한다.
**이메일 초대** 방식으로만 계정을 생성하며, 역할 변경·잠금·해제·해임 기능을 제공한다.

### 초대 흐름 (이메일 기반)

```
[super_admin] → 초대 모달 (이메일 + 이름 + 역할 입력)
    → POST /admin/admin-accounts/invite
    → AdminAccountInvitation 레코드 생성 (JWT 토큰, 7일 만료)
    → 초대 이메일 발송 (BackgroundTasks)
        → 이메일 내 [비밀번호 설정] 링크 클릭
        → POST /admin/accept-invitation (토큰 + 비밀번호)
        → AdminAccount 활성화 (비밀번호 해시 저장)
```

web 앱의 `MemberInvitation` 패턴과 동일한 구조. 초대받은 사람이 직접 비밀번호를 설정하므로 초기 비밀번호를 별도로 전달할 필요가 없다.

### 접근 권한

| 기능 | 접근 가능 역할 |
|------|--------------|
| 페이지 진입 | `super_admin` 전용 |
| 목록/상세 조회 | `super_admin` 전용 |
| 초대/수정/잠금/해임 | `super_admin` 전용 |
| 자기 자신 수정/해임 | 불가 (UI + API 양쪽 차단) |

### 어드민 역할 정의

| 역할 코드 | 라벨 | 권한 범위 |
|----------|------|----------|
| `super_admin` | 슈퍼관리자 | 전체 기능 + 어드민 계정 관리 |
| `admin` | 관리자 | 운영 기능 전체 (어드민 계정 관리 제외) |
| `customer_service` | CS 담당자 | 조회 + 공지사항 작성 |

> `super_admin`은 초대로 생성 불가. CLI 스크립트로만 생성.
> 초대 가능 역할: `admin`, `customer_service`

---

## 데이터 모델

### AdminAccount (admin_accounts 테이블)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `email` | String(255) | 로그인 ID (UNIQUE) |
| `name` | String(100) | 이름 |
| `role` | String(30) | `super_admin` / `admin` / `customer_service` |
| `is_active` | Boolean | 활성 상태 |
| `token_version` | Integer | JWT 무효화용 |
| `failed_login_count` | Integer | 연속 로그인 실패 횟수 |
| `locked_until` | DateTime | 잠금 해제 시각 (`null` = 잠금 아님) |
| `last_login_at` | DateTime | 최근 로그인 시각 |
| `created_at` | DateTime | 계정 생성일 |

---

## 페이지 구조

```
/admin-accounts             # 어드민 계정 목록 (+page.svelte)
  → 행 클릭 → 상세 모달     # 어드민 계정 상세 (AdminAccountDetailModal)
  → [초대] 버튼 → 초대 모달  # 어드민 계정 초대 (AdminAccountInviteModal)
```

> 상세는 모달로 처리 (필드 수가 적고 수정 기능도 단순)

---

## 어드민 계정 목록

### 화면 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│  어드민 계정 관리                        총 N명  [+ 초대]    │
├────────────────────────────────────────────────────────────┤
│  [🔍 이름 / 이메일 검색___]  [전체 역할▼]  [전체 상태▼]  [↻] │
├────────────────────────────────────────────────────────────┤
│  이름         │ 이메일               │ 역할    │ 상태 │ 로그인 │
│────────────────────────────────────────────────────────────│
│  김운영       │ admin@insighter.com  │ 관리자  │ 활성 │ 03.01 │
│  박CS         │ cs@insighter.com     │ CS담당  │ 활성 │ 02.28 │
│  나슈퍼 (나)  │ super@insighter.com  │ 슈퍼    │ 활성 │ 03.04 │
└────────────────────────────────────────────────────────────┘
```

> 자기 자신 행: 이름 옆에 `(나)` 뱃지 표시 → 상세 모달에서 수정/해임 버튼 비활성화

### 필터 바

| 항목 | 설명 |
|------|------|
| 검색 | 이름 또는 이메일 (디바운스 300ms) |
| 역할 필터 | 전체 / 슈퍼관리자 / 관리자 / CS담당자 |
| 상태 필터 | 전체 / 활성 / 잠금 |
| 초기화 버튼 | 모든 필터 초기화 |

### 테이블 컬럼

| 컬럼 | 필드 | 너비 | 비고 |
|------|------|------|------|
| 이름 | `name` | 1fr | 자기 자신이면 `(나)` 뱃지 |
| 이메일 | `email` | 1.5fr | |
| 역할 | `role` | 120px | 뱃지: 슈퍼(보라), 관리자(파랑), CS(회색) |
| 상태 | `is_active` | 100px | 뱃지: 활성(초록), 잠금(빨강) |
| 최근 로그인 | `last_login_at` | 120px | YYYY.MM.DD, null이면 `-` |

### 역할 뱃지

| 역할 | 라벨 | 색상 |
|------|------|------|
| `super_admin` | 슈퍼관리자 | `bg-purple-50 text-purple-700` |
| `admin` | 관리자 | `bg-blue-50 text-blue-700` |
| `customer_service` | CS담당자 | `bg-gray-100 text-gray-600` |

---

## 어드민 계정 상세 모달

### 화면 구성

```
┌──────────────────────────────────────────────────┐
│  어드민 계정 상세                             [X] │
├──────────────────────────────────────────────────┤
│  이름           │  역할                           │
│  김운영         │  [관리자 뱃지]                  │
│                 │                                │
│  이메일         │  상태                           │
│  admin@...      │  ● 활성                        │
│                 │                                │
│  최근 로그인    │  가입일                         │
│  2026.03.01     │  2026.01.15                    │
│                 │                                │
│  로그인 실패    │  잠금 해제 일시                  │
│  0회            │  -                             │
├──────────────────────────────────────────────────┤
│  역할 변경:  [관리자▼]  [변경]                    │
├──────────────────────────────────────────────────┤
│     [해임]                  [잠금] or [잠금해제]  │
└──────────────────────────────────────────────────┘
```

> 자기 자신 계정이면: 하단 액션 버튼 전체 숨김, 역할 변경 섹션 숨김

### 기본 정보 그리드 (2열)

| 라벨 | 필드 | 비고 |
|------|------|------|
| 이름 | `name` | |
| 역할 | `role` | 뱃지 표시 |
| 이메일 | `email` | |
| 상태 | `is_active` | 활성/잠금 뱃지 |
| 최근 로그인 | `last_login_at` | null이면 `-` |
| 가입일 | `created_at` | |
| 로그인 실패 | `failed_login_count` | N회 |
| 잠금 해제 일시 | `locked_until` | null이면 `-` |

### 역할 변경 섹션

- Select로 새 역할 선택 (`admin` / `customer_service`만 선택 가능, `super_admin` 제외)
- [변경] 버튼 클릭 → 확인 모달 → PATCH API 호출

### 푸터 버튼

| 상황 | 버튼 |
|------|------|
| 자기 자신 | (버튼 없음) |
| 활성 계정 | [해임] (delete) + [잠금] (stroke-delete) |
| 잠금 계정 | [해임] (delete) + [잠금 해제] (primary) |

---

## 계정 초대 모달

### 화면 구성

```
┌──────────────────────────────────────┐
│  어드민 계정 초대                  [X]│
├──────────────────────────────────────┤
│                                      │
│  이메일  *                           │
│  [_______________________________]   │
│                                      │
│  이름  *                             │
│  [_______________________________]   │
│                                      │
│  역할  *                             │
│  [관리자▼]                           │
│  (슈퍼관리자는 초대로 생성 불가)       │
│                                      │
│  ℹ 초대 이메일이 발송됩니다.           │
│    수신자가 링크를 클릭해 비밀번호를   │
│    직접 설정하면 계정이 활성화됩니다.  │
│    초대 링크는 7일간 유효합니다.       │
│                                      │
├──────────────────────────────────────┤
│              [취소]  [초대 발송]      │
└──────────────────────────────────────┘
```

### 입력 필드

| 필드 | 타입 | 필수 | 비고 |
|------|------|------|------|
| 이메일 | email input | ✅ | 중복 또는 미수락 초대 존재 시 API 에러 처리 |
| 이름 | text input | ✅ | |
| 역할 | select | ✅ | `admin` / `customer_service` |

> 비밀번호는 초대받은 사람이 이메일 링크를 통해 직접 설정.
> 동일 이메일로 재초대 시 기존 pending 초대를 갱신(upsert) 처리.

---

## 액션 정의

### 계정 초대

| 항목 | 설명 |
|------|------|
| **트리거** | PageHeader [+ 초대] 버튼 클릭 |
| **API** | `POST /admin/admin-accounts/invite` |
| **결과** | 토스트 "초대 이메일이 발송되었습니다" + 목록 재조회 + 모달 닫기 |
| **비고** | 초대 링크는 7일 유효. 동일 이메일 재초대 시 기존 pending 갱신 |

### 역할 변경

| 항목 | 설명 |
|------|------|
| **트리거** | 상세 모달 내 역할 변경 [변경] 버튼 |
| **API** | `PATCH /admin/admin-accounts/{id}` |
| **확인 모달** | "역할을 [관리자]로 변경하시겠습니까?" |
| **결과** | 토스트 "역할이 변경되었습니다" + 상세 쿼리 invalidate |

### 계정 잠금

| 항목 | 설명 |
|------|------|
| **트리거** | 상세 모달 [잠금] 버튼 |
| **API** | `POST /admin/admin-accounts/{id}/lock` |
| **동작** | `is_active → false` + `token_version` 증가 (즉시 강제 로그아웃) |
| **확인 모달** | "계정을 잠금하시겠습니까?" |
| **결과** | 토스트 "계정이 잠금되었습니다" + 목록 재조회 + 모달 닫기 |

### 잠금 해제

| 항목 | 설명 |
|------|------|
| **트리거** | 상세 모달 [잠금 해제] 버튼 |
| **API** | `POST /admin/admin-accounts/{id}/unlock` |
| **동작** | `is_active → true` |
| **결과** | 토스트 "잠금이 해제되었습니다" + 목록 재조회 + 모달 닫기 |

### 계정 해임

| 항목 | 설명 |
|------|------|
| **트리거** | 상세 모달 [해임] 버튼 |
| **API** | `DELETE /admin/admin-accounts/{id}` |
| **동작** | Soft delete (`is_active → false`, 목록에서 제외) |
| **확인 모달** | "해당 계정을 해임하시겠습니까? 이 작업은 되돌릴 수 없습니다." (type: danger) |
| **결과** | 토스트 "계정이 해임되었습니다" + 목록 재조회 + 모달 닫기 |

---

## API 엔드포인트

모든 엔드포인트는 `require_admin_role("super_admin")` 적용.

### 목록 조회

```
GET /api/v1/admin/admin-accounts
```

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `search` | query | 이름 또는 이메일 검색 |
| `role` | query | `super_admin` / `admin` / `customer_service` |
| `is_active` | query | `true` / `false` |
| `page` | query | 페이지 번호 (default: 1) |
| `size` | query | 페이지 크기 (default: 20) |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "email": "admin@insighter.co.kr",
      "name": "김운영",
      "role": "admin",
      "is_active": true,
      "last_login_at": "2026-03-01T09:00:00"
    }
  ],
  "total": 5,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

### 상세 조회

```
GET /api/v1/admin/admin-accounts/{account_id}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "admin@insighter.co.kr",
  "name": "김운영",
  "role": "admin",
  "is_active": true,
  "failed_login_count": 0,
  "locked_until": null,
  "last_login_at": "2026-03-01T09:00:00",
  "created_at": "2026-01-15T00:00:00",
  "updated_at": "2026-03-01T09:00:00"
}
```

### 계정 초대

```
POST /api/v1/admin/admin-accounts/invite
```

**Request:**
```json
{
  "email": "newadmin@insighter.co.kr",
  "name": "신규관리자",
  "role": "admin"
}
```

**동작:**
1. 이메일 중복 확인 (이미 활성화된 계정이면 409)
2. `AdminAccountInvitation` 생성 또는 갱신 (upsert, 7일 만료, JWT 토큰)
3. BackgroundTasks로 초대 이메일 발송 (비밀번호 설정 링크 포함)

**Response:** `{ "message": "초대 이메일이 발송되었습니다" }`

---

### 초대 수락 (비밀번호 설정)

```
POST /api/v1/admin/admin-accounts/accept-invitation
```

**Request:**
```json
{
  "token": "jwt-invitation-token",
  "password": "Secure@Pass123"
}
```

**동작:**
1. 토큰 검증 (만료 여부, 유효성)
2. 비밀번호 정책 검증 (`validate_admin_password`)
3. `AdminAccount` 생성 (bcrypt 해시, `is_active=true`)
4. `AdminAccountInvitation` 레코드 소비 처리

> 이 엔드포인트는 인증 불필요 (public). 어드민 로그인 페이지 외부에서 접근.

### 역할 변경

```
PATCH /api/v1/admin/admin-accounts/{account_id}
```

**Request:**
```json
{
  "role": "customer_service"
}
```

**제약:**
- 자기 자신 수정 불가 (API에서 `admin_account_id` 비교)
- `super_admin`으로 역할 변경 불가

### 계정 잠금

```
POST /api/v1/admin/admin-accounts/{account_id}/lock
```

**동작:** `is_active → false` + `token_version` 증가

### 잠금 해제

```
POST /api/v1/admin/admin-accounts/{account_id}/unlock
```

**동작:** `is_active → true`

### 계정 해임

```
DELETE /api/v1/admin/admin-accounts/{account_id}
```

**동작:** `is_active → false` (soft delete 처리, 목록 조회 시 제외)
**제약:** 자기 자신 해임 불가

---

## 프론트엔드 구현 계획

### 파일 구조

```
src/
├── routes/(protected)/admin-accounts/
│   ├── +page.server.ts          # super_admin 권한 체크
│   └── +page.svelte             # 목록 페이지
├── lib/
│   ├── hooks/actions/
│   │   └── admin-account.action.ts   # API action 함수
│   └── components/modal/
│       ├── AdminAccountDetailModal.svelte  # 상세 + 역할변경 + 액션
│       └── AdminAccountInviteModal.svelte  # 초대 폼
```

### 레이어 판단

목록 페이지는 쿼리 1개 + mutationBuilder 없음 → **페이지에서 직접** queryBuilder 사용.
모달 내 액션이 여러 개(잠금/해제/역할변경/해임) → 모달 컴포넌트 내부에서 각각 mutationBuilder 사용.
서비스 파일 분리 불필요 (복잡도 낮음).

### action.ts 타입 설계

```typescript
// admin-account.action.ts

export type AdminRole = 'super_admin' | 'admin' | 'customer_service'

export interface AdminAccountSummary {
  id: string
  email: string
  name: string
  role: AdminRole
  is_active: boolean
  last_login_at: string | null
}

export interface AdminAccountDetail extends AdminAccountSummary {
  failed_login_count: number
  locked_until: string | null
  created_at: string
  updated_at: string
}

export interface AdminAccountListResponse {
  items: AdminAccountSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface AdminAccountInviteBody {
  email: string
  name: string
  role: 'admin' | 'customer_service'
  // 비밀번호 없음 — 초대받은 사람이 이메일 링크에서 직접 설정
}
```

### 자기 자신 판별

`$auth.user?.id`와 각 계정의 `id`를 비교해서 본인 여부 판단.
- 목록: 이름 옆에 `(나)` 뱃지
- 상세 모달: 역할 변경 섹션 + 푸터 액션 버튼 전체 숨김

---

## 백엔드 구현 계획

### 필요한 새 파일

```
apps/api/app/modules/platform_admin/
└── admin_account_management/         # 신규 서브모듈
    ├── __init__.py
    ├── router.py
    ├── schemas.py                    # 요청/응답 DTO
    ├── models.py                     # AdminAccountInvitation 모델
    ├── repository.py                 # AdminAccount + Invitation 쿼리
    └── handlers/
        ├── __init__.py
        ├── list_admin_accounts.py
        ├── get_admin_account.py
        ├── invite_admin_account.py   # POST /invite (인증 필요)
        ├── accept_invitation.py      # POST /accept-invitation (공개)
        ├── update_admin_account.py
        ├── lock_admin_account.py
        ├── unlock_admin_account.py
        └── delete_admin_account.py
```

> 기존 `admin_account/` 모듈은 로그인/토큰 전용. 관리 기능은 별도 서브모듈로 분리.

### AdminAccountInvitation 모델

```python
class AdminAccountInvitation(Base):
    __tablename__ = "admin_account_invitations"

    id: str             # UUID PK
    email: str          # 초대받은 이메일
    name: str           # 초대받은 이름
    role: str           # admin / customer_service
    token: str          # JWT 토큰 (검증용)
    invited_by: str     # AdminAccount.id (FK)
    expires_at: datetime
    accepted_at: datetime | None  # 수락 시각 (null = 미수락)
    created_at: datetime
```

### router.py 등록

```python
# platform_admin/router.py 에 추가
from app.modules.platform_admin.admin_account_management.router import router as admin_account_mgmt_router
router.include_router(admin_account_mgmt_router, prefix="/admin-accounts")
```

### 공통 제약

- 관리 API (초대 제외): `require_admin_role("super_admin")` 의존성 필수
- `POST /accept-invitation`: 인증 불필요 (public 엔드포인트)
- 자기 자신 대상 수정/삭제/잠금 시 `InvalidOperationException` 발생
- `super_admin`으로 역할 변경 시도 시 `InvalidOperationException` 발생

---

## 구현 체크리스트

### 백엔드

- [ ] `admin_account_management/` 서브모듈 생성
- [ ] `models.py` — `AdminAccountInvitation` 모델 + Alembic 마이그레이션
- [ ] `schemas.py` — `AdminAccountListResponse`, `AdminAccountDetailResponse`, `InviteAdminAccountRequest`, `AcceptInvitationRequest`, `UpdateAdminAccountRequest`
- [ ] `repository.py` — 목록/상세 조회 + invitation upsert 쿼리
- [ ] `invite_admin_account.py` — invitation 생성 + 이메일 BackgroundTasks 발송
- [ ] `accept_invitation.py` — 토큰 검증 + AdminAccount 생성 (public)
- [ ] 나머지 핸들러 6개 구현 (list, get, update, lock, unlock, delete)
- [ ] `router.py` — prefix `/admin-accounts`, 초대 수락만 public, 나머지 `require_admin_role("super_admin")`
- [ ] 메인 `router.py`에 등록
- [ ] 이메일 템플릿 추가 (`admin_invitation_email()`)

### 프론트엔드

- [ ] `+page.server.ts` — `super_admin` 권한 체크 (403)
- [ ] `admin-account.action.ts` — action 함수 (list, detail, invite, update_role, lock, unlock, delete)
- [ ] `+page.svelte` — 목록, 필터, 초대 버튼
- [ ] `AdminAccountDetailModal.svelte` — 상세 조회, 역할 변경, 잠금/해제, 해임
- [ ] `AdminAccountInviteModal.svelte` — 이메일/이름/역할 입력, 이메일 발송 안내 메시지
- [ ] 자기 자신 판별 (`(나)` 뱃지, 액션 버튼 숨김)

### 어드민 초대 수락 페이지 (공개 라우트)

- [ ] `src/routes/accept-admin-invitation/+page.svelte` — 토큰 파라미터 수신 + 비밀번호 설정 폼
- [ ] 비밀번호 정책 UI 안내 (12자+, 대/소문자, 특수문자)
- [ ] 수락 완료 후 `/login`으로 리다이렉트
