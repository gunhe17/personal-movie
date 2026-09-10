# RBAC (역할 기반 접근 제어) 아키텍처

> 어드민 계정의 4가지 역할 정의, 권한 매트릭스, 프론트/백엔드 가드 패턴

---

## 1. 역할 정의

| 역할 | 코드 | 설명 | 생성 방식 |
|------|------|------|----------|
| 시스템 관리자 | `system_admin` | 모든 권한 + 인프라/시스템 관리 | DB seed |
| 슈퍼관리자 | `super_admin` | 비즈니스 전체 + 어드민 계정 관리 | DB seed |
| 관리자 | `admin` | 운영 기능 (센터/계정/검사/공지/AI) | 초대 |
| CS 담당자 | `customer_service` | 조회 + 고객센터 기능 (공지/메모/문의/FAQ) | 초대 |

### 역할 계층

```
system_admin  ⊃  super_admin  ⊃  admin  ⊃  customer_service
     │                │              │              │
     │                │              │              └─ 조회 + 고객센터 CRUD
     │                │              └─ + 센터/계정/검사 변경 + AI 관리
     │                └─ + 어드민 계정 관리
     └─ + 감사 로그 + 시스템 설정 + 인프라 모니터링 + 해지 데이터 삭제
```

### 역할 성격 분리

| 구분 | `system_admin` | `super_admin` |
|------|:-:|:-:|
| 비즈니스 운영 (센터/계정/검사/AI) | ✅ | ✅ |
| 어드민 계정 관리 | ✅ | ✅ |
| **감사 로그** | ✅ | ❌ |
| **시스템 설정** | ✅ | ❌ |
| **인프라 모니터링** (서버 부하, 요청량, 데이터 용량) | ✅ | ❌ |
| **해지 데이터 삭제** (30일 경과 개인정보 완전삭제) | ✅ | ❌ |

> `super_admin`은 비즈니스 최고 권한자 (어드민 계정 관리까지). `system_admin`은 시스템/인프라까지 포함하는 개발/운영팀 역할.

---

## 2. 권한 매트릭스

### 2.1 페이지 접근

| 페이지 | `system_admin` | `super_admin` | `admin` | `customer_service` |
|--------|:---:|:---:|:---:|:---:|
| 대시보드 | ✅ (전체) | ✅ (운영) | ✅ (운영) | ✅ (CS 전용) |
| 센터 신청 — 목록/상세 | ✅ | ✅ | ✅ | ✅ |
| 센터 신청 — 승인/거절 | ✅ | ✅ | ✅ | ❌ |
| 센터 관리 — 목록/상세 | ✅ | ✅ | ✅ | ✅ |
| 센터 관리 — 정지/활성화 | ✅ | ✅ | ✅ | ❌ |
| 계정 관리 — 목록/상세 | ✅ | ✅ | ✅ | ✅ |
| 계정 관리 — 잠금/강제로그아웃 | ✅ | ✅ | ✅ | ❌ |
| 검사 관리 — 목록/상세 | ✅ | ✅ | ✅ | ✅ |
| 검사 관리 — 등록/수정/삭제 | ✅ | ✅ | ✅ | ❌ |
| 공지사항 관리 | ✅ | ✅ | ✅ | ✅ |
| CS 전화 메모 | ✅ | ✅ | ✅ | ✅ |
| 문의 관리 | ✅ | ✅ | ✅ | ✅ |
| FAQ 관리 | ✅ | ✅ | ✅ | ✅ |
| AI 사용량 관리 | ✅ | ✅ | ✅ | ❌ |
| 어드민 계정 관리 | ✅ | ✅ | ❌ | ❌ |
| 감사 로그 | ✅ | ❌ | ❌ | ❌ |
| 시스템 설정 | ✅ | ❌ | ❌ | ❌ |
| **인프라 모니터링** | ✅ | ❌ | ❌ | ❌ |
| **해지 데이터 관리** | ✅ | ❌ | ❌ | ❌ |

### 2.2 행위 권한 그룹

```typescript
SYSTEM_ONLY   = ['system_admin']
SUPER_PLUS    = ['system_admin', 'super_admin']
ADMIN_PLUS    = ['system_admin', 'super_admin', 'admin']
ALL_ROLES     = ['system_admin', 'super_admin', 'admin', 'customer_service']
```

| 행위 그룹 | 허용 역할 | 대상 행위 |
|-----------|----------|----------|
| `SYSTEM_ONLY` | system_admin | 감사 로그, 시스템 설정, 인프라 모니터링, 해지 데이터 삭제 |
| `SUPER_PLUS` | system_admin, super_admin | 어드민 계정 CRUD |
| `ADMIN_PLUS` | system_admin, super_admin, admin | 센터 승인/거절/정지, 계정 잠금/해제, 검사 CRUD, AI 관리 |
| `ALL_ROLES` | 전체 | 조회, 공지/메모/문의/FAQ CRUD |

### 2.3 대시보드 위젯 × 역할

| 위젯 | `system_admin` | `super_admin` | `admin` | `customer_service` |
|------|:---:|:---:|:---:|:---:|
| 전체 센터 | ✅ | ✅ | ✅ | ❌ |
| 활성 센터 | ✅ | ✅ | ✅ | ❌ |
| 대기 중인 신청 | ✅ | ✅ | ✅ | ❌ |
| 미답변 문의 | ✅ | ✅ | ✅ | ✅ |
| 오늘 CS 메모 | ✅ | ✅ | ✅ | ✅ |
| 어드민 계정 | ✅ | ✅ | ❌ | ❌ |
| 대기 센터 신청 (위젯) | ✅ | ✅ | ✅ | ❌ |
| 미답변 문의 (위젯) | ✅ | ✅ | ✅ | ✅ |
| 오늘 CS 메모 (위젯) | ✅ | ✅ | ✅ | ✅ |
| 최근 감사 로그 (위젯) | ✅ | ❌ | ❌ | ❌ |
| **인프라 상태** (위젯) | ✅ | ❌ | ❌ | ❌ |
| **해지 대기 건** (위젯) | ✅ | ❌ | ❌ | ❌ |

---

## 3. 프론트엔드 권한 유틸리티

### 3.1 현재 문제점

```typescript
// BAD — 하드코딩된 역할 비교가 4곳 이상 산재
const canManage = $derived($auth.user?.role !== 'customer_service')

// BAD — 역할 추가/변경 시 모든 파일 수정 필요
if (authState.user?.role === 'super_admin') return true
```

### 3.2 제안: Permission 유틸리티 (`src/lib/utils/permissions.ts`)

```typescript
// ── AdminRole 타입 (단일 소스) ──
export type AdminRole = 'system_admin' | 'super_admin' | 'admin' | 'customer_service'

// ── 역할 계층 (숫자가 클수록 상위) ──
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  system_admin: 4,
  super_admin: 3,
  admin: 2,
  customer_service: 1,
}

// ── 역할 그룹 (단일 소스) ──
export const ROLE_GROUPS = {
  SYSTEM_ONLY: ['system_admin'] as AdminRole[],
  SUPER_PLUS: ['system_admin', 'super_admin'] as AdminRole[],
  ADMIN_PLUS: ['system_admin', 'super_admin', 'admin'] as AdminRole[],
  ALL_ROLES: ['system_admin', 'super_admin', 'admin', 'customer_service'] as AdminRole[],
} as const

// ── 역할 메타 (라벨, 배지 색상, 로고 색상) ──
export const ROLE_META: Record<AdminRole, { label: string; bg: string; text: string; logoBg: string }> = {
  system_admin:     { label: '시스템 관리자', bg: 'bg-red-50',    text: 'text-red-700',    logoBg: 'bg-red-600' },
  super_admin:      { label: '슈퍼관리자',   bg: 'bg-purple-50', text: 'text-purple-700', logoBg: 'bg-primary-500' },
  admin:            { label: '관리자',       bg: 'bg-blue-50',   text: 'text-blue-700',   logoBg: 'bg-blue-500' },
  customer_service: { label: 'CS 담당자',    bg: 'bg-gray-100',  text: 'text-gray-600',   logoBg: 'bg-emerald-600' },
}

// ── 핵심 함수 ──

/** 특정 역할 그룹에 포함되는지 확인 */
export function hasRole(role: AdminRole | undefined, allowed: readonly AdminRole[]): boolean {
  if (!role) return false
  return allowed.includes(role)
}

/** 계층 비교: role이 minRole 이상인지 */
export function isAtLeast(role: AdminRole | undefined, minRole: AdminRole): boolean {
  if (!role) return false
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]
}

// ── 의미 있는 권한 헬퍼 ──

/** 운영 행위 가능 — 센터 승인, 계정 잠금, 검사 CRUD 등 */
export function canOperate(role: AdminRole | undefined): boolean {
  return isAtLeast(role, 'admin')
}

/** 관리 행위 가능 — 어드민 계정 관리 */
export function canAdminister(role: AdminRole | undefined): boolean {
  return isAtLeast(role, 'super_admin')
}

/** 시스템 행위 가능 — 감사 로그, 시스템 설정, 인프라, 데이터 삭제 */
export function canSystemManage(role: AdminRole | undefined): boolean {
  return isAtLeast(role, 'system_admin')
}
```

### 3.3 사용 예시

```svelte
<script lang="ts">
  import { canOperate, canAdminister, canSystemManage, ROLE_META } from '$utils/permissions'
  import type { AdminRole } from '$utils/permissions'
  import { auth } from '$lib/stores/auth'

  const role = $derived($auth.user?.role as AdminRole | undefined)

  // BEFORE: const canManage = $derived($auth.user?.role !== 'customer_service')
  // AFTER:
  const canManage = $derived(canOperate(role))
</script>

<!-- 조건부 렌더링 -->
{#if canManage}
  <Button onclick={handleApprove}>승인</Button>
{/if}

<!-- 역할 배지 -->
{#if role}
  {@const meta = ROLE_META[role]}
  <span class="rounded-full px-2.5 py-1 text-xs font-medium {meta.bg} {meta.text}">
    {meta.label}
  </span>
{/if}
```

### 3.4 대시보드 위젯 역할 필터

```typescript
import { hasRole, ROLE_GROUPS } from '$utils/permissions'
const { SYSTEM_ONLY, SUPER_PLUS, ADMIN_PLUS, ALL_ROLES } = ROLE_GROUPS

// StatCard 설정 배열
const STAT_CARDS = [
  { id: 'total-centers',     roles: ADMIN_PLUS,  ... },
  { id: 'active-centers',    roles: ADMIN_PLUS,  ... },
  { id: 'pending-apps',      roles: ADMIN_PLUS,  ... },
  { id: 'pending-inquiries', roles: ALL_ROLES,   ... },
  { id: 'today-memos',       roles: ALL_ROLES,   ... },
  { id: 'admin-accounts',    roles: SUPER_PLUS,  ... },
  { id: 'infra-status',      roles: SYSTEM_ONLY, ... },
  { id: 'pending-deletion',  roles: SYSTEM_ONLY, ... },
]

// 렌더링 — 역할에 맞는 위젯만 표시
{#each STAT_CARDS.filter(c => hasRole(role, c.roles)) as card}
  <StatCard {...card} />
{/each}
```

### 3.5 서버 사이드 가드 (`+page.server.ts`)

```typescript
import { canAdminister, canOperate, canSystemManage } from '$utils/permissions'

// super_admin+ 전용 페이지 (어드민 계정 관리)
if (!canAdminister(locals.user?.role)) {
  throw error(403, '슈퍼관리자 이상만 접근할 수 있습니다')
}

// admin+ 전용 페이지 (AI 사용량)
if (!canOperate(locals.user?.role)) {
  throw error(403, '관리자 이상만 접근할 수 있습니다')
}

// system_admin 전용 페이지 (감사 로그, 시스템 설정, 인프라, 해지 데이터)
if (!canSystemManage(locals.user?.role)) {
  throw error(403, '시스템 관리자만 접근할 수 있습니다')
}
```

### 3.6 사이드바 네비게이션

```typescript
import { ROLE_GROUPS } from '$utils/permissions'
const { SYSTEM_ONLY, SUPER_PLUS, ADMIN_PLUS, ALL_ROLES } = ROLE_GROUPS

const navItems: NavItem[] = [
  { id: 'dashboard',    roles: ALL_ROLES, ... },
  { id: 'center-group', roles: ALL_ROLES, children: [...] },
  { id: 'assessments',  roles: ALL_ROLES, ... },
  { id: 'ai-usage',     roles: ADMIN_PLUS, ... },
  { id: 'cs-group',     roles: ALL_ROLES, children: [...] },
  { id: 'account-group', roles: SUPER_PLUS, children: [
    { id: 'admin-accounts', roles: SUPER_PLUS },
  ]},
  { id: 'system-group', roles: SYSTEM_ONLY, children: [
    { id: 'audit-logs',       roles: SYSTEM_ONLY },
    { id: 'settings',         roles: SYSTEM_ONLY },
    { id: 'infra-monitor',    roles: SYSTEM_ONLY },
    { id: 'data-retention',   roles: SYSTEM_ONLY },
  ]},
]
```

### 3.7 AdminRole 타입 단일 소스

```
현재 문제: AdminRole이 두 곳에 중복 정의
  - apps/admin/src/app.d.ts
  - apps/admin/src/lib/hooks/actions/admin-account.action.ts

변경 후: permissions.ts에서 export하고 나머지에서 import
  - src/lib/utils/permissions.ts  → export type AdminRole (정의)
  - src/app.d.ts                  → import type { AdminRole } (사용)
  - admin-account.action.ts       → import type { AdminRole } (사용)
```

---

## 4. 백엔드 API 가드

### 4.1 현재 문제점

```
현재 상태:
- get_current_admin     → 로그인만 확인 (역할 무관)
- require_admin_role    → audit_log, admin_account_management에서만 사용

문제:
- center_application 승인/거절: get_current_admin만 → CS 담당자도 API 호출 가능
- center 정지/활성화: 동일
- account 잠금/해제: 동일
- assessment CRUD: 동일
```

### 4.2 AdminRole 모델 변경

```python
# apps/api/app/modules/platform_admin/admin_account/models.py

class AdminRole:
    """어드민 역할 상수"""
    SYSTEM_ADMIN = "system_admin"         # 신규
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    CUSTOMER_SERVICE = "customer_service"
    ALL = [SYSTEM_ADMIN, SUPER_ADMIN, ADMIN, CUSTOMER_SERVICE]

    # 역할 그룹 (가드에서 사용)
    SYSTEM_ONLY = [SYSTEM_ADMIN]
    SUPER_PLUS = [SYSTEM_ADMIN, SUPER_ADMIN]
    ADMIN_PLUS = [SYSTEM_ADMIN, SUPER_ADMIN, ADMIN]
```

### 4.3 제안: 라우터별 가드 적용

| 라우터 | 현재 | 변경 후 |
|--------|------|---------|
| `center_application` GET | `get_current_admin` | 유지 (ALL_ROLES) |
| `center_application` POST (approve/reject) | `get_current_admin` | `require_admin_role(*AdminRole.ADMIN_PLUS)` |
| `center` GET | `get_current_admin` | 유지 (ALL_ROLES) |
| `center` PATCH (suspend/activate) | `get_current_admin` | `require_admin_role(*AdminRole.ADMIN_PLUS)` |
| `account` GET | `get_current_admin` | 유지 (ALL_ROLES) |
| `account` POST (lock/unlock/logout) | `get_current_admin` | `require_admin_role(*AdminRole.ADMIN_PLUS)` |
| `assessment` GET | `get_current_admin` | 유지 (ALL_ROLES) |
| `assessment` POST/PATCH/DELETE | `get_current_admin` | `require_admin_role(*AdminRole.ADMIN_PLUS)` |
| `notice` 전체 | `get_current_admin` | 유지 (ALL_ROLES) |
| `cs_memo` 전체 | `get_current_admin` | 유지 (ALL_ROLES) |
| `qna` 전체 | `get_current_admin` | 유지 (ALL_ROLES) |
| `faq` 전체 | `get_current_admin` | 유지 (ALL_ROLES) |
| `ai_usage` 전체 | `get_current_admin` | `require_admin_role(*AdminRole.ADMIN_PLUS)` |
| `audit_log` 전체 | `require_admin_role("super_admin")` | `require_admin_role(*AdminRole.SYSTEM_ONLY)` |
| `admin_account_management` 전체 | `require_admin_role("super_admin")` | `require_admin_role(*AdminRole.SUPER_PLUS)` |
| `settings` 전체 | `require_admin_role("super_admin")` | `require_admin_role(*AdminRole.SYSTEM_ONLY)` |
| **`infra_monitor`** (신규) | — | `require_admin_role(*AdminRole.SYSTEM_ONLY)` |
| **`data_retention`** (신규) | — | `require_admin_role(*AdminRole.SYSTEM_ONLY)` |

### 4.4 적용 패턴

```python
from app.modules.platform_admin.admin_account.models import AdminRole

# 라우터 레벨 의존성
_auth = Depends(get_current_admin)                                # ALL_ROLES
_admin_plus = Depends(require_admin_role(*AdminRole.ADMIN_PLUS))  # admin+
_super_plus = Depends(require_admin_role(*AdminRole.SUPER_PLUS))  # super_admin+
_system_only = Depends(require_admin_role(*AdminRole.SYSTEM_ONLY)) # system_admin

@router.get("/", dependencies=[_auth])
async def list_applications(...): ...

@router.post("/{id}/approve", dependencies=[_admin_plus])
async def approve_application(...): ...
```

### 4.5 어드민 계정 관리 규칙

| 행위 | 허용 역할 | 비고 |
|------|----------|------|
| 어드민 목록 조회 | SUPER_PLUS | |
| 어드민 초대 | SUPER_PLUS | 초대 가능 역할: `admin`, `customer_service` |
| 역할 변경 | SUPER_PLUS | 변경 가능: `admin` ↔ `customer_service` |
| 계정 잠금/해제 | SUPER_PLUS | `system_admin`, `super_admin` 대상 변경 불가 |
| 계정 해임 | SUPER_PLUS | `system_admin`, `super_admin` 대상 삭제 불가 |
| `system_admin` 생성 | DB seed만 | UI/API 미제공 |
| `super_admin` 생성 | DB seed만 | UI/API 미제공 |

---

## 5. 구현 순서

### Phase 1: 프론트엔드 권한 유틸리티 (선행)

1. `src/lib/utils/permissions.ts` 생성
2. `AdminRole` 타입을 permissions.ts로 통합 (app.d.ts, admin-account.action.ts에서 import)
3. 기존 `canManage = role !== 'customer_service'` → `canOperate(role)`로 교체 (4곳)
4. `+page.server.ts` 가드에 유틸리티 적용 (4곳)
5. 사이드바 역할 상수를 permissions.ts로 이동
6. ROLE_META로 역할 배지/로고 색상 통합

### Phase 2: 대시보드 위젯 분리

1. StatCard/Widget에 `roles` 속성 추가 또는 설정 배열로 관리
2. 역할별 필터링으로 위젯 표시/숨김
3. CS 담당자 전용 대시보드 레이아웃 (문의 + 메모 중심)

### Phase 3: 백엔드 역할 추가 + API 가드 강화

1. `AdminRole` 모델에 `SYSTEM_ADMIN` + 그룹 상수 추가
2. 변경 API에 `require_admin_role` 적용
3. seed 스크립트에 `system_admin` 계정 추가
4. 기존 `super_admin` 전용 가드 재매핑 (감사 로그/설정 → SYSTEM_ONLY, 어드민 계정 → SUPER_PLUS)

### Phase 4: system_admin 전용 기능 (추후)

1. 인프라 모니터링 대시보드 (서버 부하, 요청량, 데이터 용량)
2. 해지 데이터 관리 (30일 경과 건 조회 + 삭제 처리)

---

## 6. 보안 메커니즘

| 메커니즘 | 설명 |
|---------|------|
| **Token Version** | 역할 변경 시 `token_version += 1` → 기존 JWT 즉시 무효화 |
| **Token Type 분리** | `token_type: "admin"` — 센터 토큰 혼용 방지 |
| **계정 잠금** | 로그인 실패 N회 → `locked_until` 자동 설정 |
| **세션 타임아웃** | 프론트엔드 비활성 30분 → 자동 로그아웃 |
| **감사 로그** | 모든 변경 행위 기록 (`audit.log()`) |
| **Seed 전용 역할** | `system_admin`, `super_admin`은 초대 불가 — DB seed로만 생성 |
