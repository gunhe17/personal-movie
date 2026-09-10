# Role 도메인 설계

> 역할 기반 접근 제어 (RBAC). 권한 정의, 프리셋 역할 제공, Member 권한 커스터마이징.

---

## 도메인 개요

### 핵심 개념

**Role = 프리셋 역할 (고정)**:
- 시스템에서 제공하는 5개 고정 역할 (생성/수정/삭제 불가)
- RolePermission으로 기본 권한 매핑 (플랫폼 관리자만 조정 가능)

**Member = 커스터마이징 (유연)**:
- Member 생성 시 Role 권한을 배열로 복사
- Member별 권한 추가/제거 가능 (센터 관리자)
- Center 도메인에서 관리

**Sub-Module 구조**:
```
role/
├── permission/          # 권한 정의 (client:read, counseling:write 등)
├── role/               # 프리셋 역할 (5개 고정)
└── role_permission/    # 역할-권한 N:M 매핑
```

### 연동 관계

```
┌────────────────────────┐
│   Permission (권한)     │
│   - code: client:read  │
│   - category: client   │
└────────────────────────┘
           ↑ N:M
┌────────────────────────┐
│ RolePermission (매핑)  │  ← 플랫폼 관리자만 수정
│   - role_id            │
│   - permission_id      │
└────────────────────────┘
           ↑ N
┌────────────────────────┐
│   Role (프리셋 역할)     │  ← 5개 고정 (CRUD 없음)
│   - code: counselor    │
│   - name: 상담사        │
└────────────────────────┘
           ↓ 배열 복사
┌────────────────────────┐
│   Member (센터 구성원)   │  ← Center 도메인
│   - role_id            │  ← 참조만 (FK 없음)
│   - permissions: []    │  ← 배열 (커스터마이징 가능)
└────────────────────────┘
```

### 설계 원칙

1. **Global Scope**: 모든 엔티티가 센터 경계 없음 (center_id 없음)
2. **Role = 프리셋**: 5개 고정 역할, CRUD 불가
3. **Member = 커스터마이징**: 배열로 권한 복사 후 개별 조정
4. **FK 없음**: Member → Role은 참조만
5. **권한 코드 체계**: `{resource}:{action}`

---

## 스키마 정의

### 1. Permission (권한)

```python
class Permission(Base):
    """권한 정의 (Global)"""
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

**필드**:
| 필드 | 타입 | 설명 |
|------|------|------|
| `code` | String(100) | 권한 코드 (`client:read`) |
| `name` | String(100) | 권한 이름 ("내담자 조회") |
| `category` | String(50) | 카테고리 (client, counseling, assessment 등) |
| `is_new` | Boolean | 신규 권한 여부 (코드 배포 후 추가됨) |

**권한 코드 체계**:
```
{resource}:{action}

예시:
client:read, client:write, client:delete
counseling:read, counseling:write
assessment:read, assessment:write
schedule:read, schedule:write
billing:read, billing:write
center:admin
system:admin
```

---

### 2. Role (프리셋 역할)

```python
class Role(Base):
    """프리셋 역할 (Global, 5개 고정)"""
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

**5개 고정 역할** (Seed 데이터):

| Code | Name | Description | 기본 권한 |
|------|------|-------------|----------|
| `platform_admin` | 플랫폼 관리자 | 전체 시스템 관리 | 모든 권한 |
| `center_admin` | 센터 관리자 | 센터 내 모든 권한 | center:* 외 모든 센터 권한 |
| `counselor` | 상담사 | 상담/검사 수행 | client:*, counseling:*, assessment:*, schedule:read/write |
| `intern` | 실습생 | 읽기 전용 | *:read |
| `receptionist` | 접수/행정 | 일정/결제 관리 | client:read, schedule:*, billing:* |

**특징**:
- 생성/수정/삭제 불가 (조회만 가능)
- RolePermission은 플랫폼 관리자만 조정 가능

---

### 3. RolePermission (역할-권한 매핑)

```python
class RolePermission(Base):
    """역할-권한 N:M (Global)"""
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True
    )
    permission_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True
    )
    created_at: Mapped[datetime]
```

**관리 권한**:
- 플랫폼 관리자만 수정 가능 (프리셋 역할 권한 조정)
- 센터 관리자는 조회만 가능

---

### 4. Member 권한 (Center 도메인)

```python
# app/modules/center/member/models.py
class Member(Base):
    """센터 구성원 (Center 도메인에서 관리)"""
    __tablename__ = "members"

    id: Mapped[str]  # UUID
    center_id: Mapped[str]  # UUID (FK 없음)
    account_id: Mapped[int]  # int (FK 없음)

    # Role 참조 (FK 없음)
    role_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # 권한 배열 (JSONB)
    permissions: Mapped[list] = mapped_column(JSONB, nullable=False)
    # ["client:read", "client:write", "counseling:read", ...]
```

**권한 복사 예시**:
```python
# Member 생성 시 Role 권한을 배열로 복사
async def create_member(role_id: int):
    # 1. Role 권한 조회
    perms = await role_repo.get_permissions(role_id)
    perm_codes = [p.code for p in perms]  # 배열 생성

    # 2. Member 생성 (권한 배열 복사)
    member = await member_repo.create({
        "role_id": role_id,
        "permissions": perm_codes  # JSONB 배열
    })
```

**권한 커스터마이징**:
```python
# 센터 관리자가 Member 권한 개별 조정
await member_repo.update(member_id, {
    "permissions": [
        "client:read",
        "client:write",
        "counseling:read",
        "assessment:read"  # 추가
    ]
})
```

---

## 비즈니스 규칙

### Permission 관리

| 규칙 | 설명 |
|------|------|
| 코드 체계 | `{resource}:{action}` 필수 |
| 세밀한 분리 | read, write, delete 분리 |
| 신규 권한 알림 | `is_new=True` → 센터 관리자 알림 |
| 권한 동기화 | `/permissions/sync` API로 코드와 DB 동기화 |

### Role 관리 (프리셋)

| 규칙 | 설명 |
|------|------|
| **고정 역할** | 5개 프리셋만 제공 (생성/수정/삭제 불가) |
| **조회만** | 센터 관리자는 역할 목록 조회만 가능 |
| **권한 조정** | 플랫폼 관리자만 RolePermission 수정 가능 |

### Member 권한 부여

| 규칙 | 설명 |
|------|------|
| **배열 복사** | Member 생성 시 Role 권한을 배열로 복사 |
| **개별 조정** | 센터 관리자가 Member별 권한 추가/제거 |
| **자동 동기화 없음** | Role 권한 변경 시 기존 Member 권한 유지 |
| **수동 동기화** | 센터 관리자가 명시적으로 동기화 수행 |

### 접근 제어

**FastAPI Dependency**:
```python
# app/modules/role/rbac/dependencies.py
async def require_permission(permission_code: str):
    async def check(current_user = Depends(get_current_user)):
        member = current_user.get_member_for_center(center_id)
        if permission_code not in member.permissions:  # 배열 검사
            raise HTTPException(403)
        return current_user
    return check
```

**엔드포인트 적용**:
```python
@router.get("/", dependencies=[Depends(require_permission("client:read"))])
async def list_clients():
    ...
```

---

## 참고 문서

- **API 명세**: `docs/role/api.md`
- **엣지 케이스**: `docs/role/edge-cases.md`
- **사용 시나리오**: `docs/role/scenarios.md`
- **스키마**: `docs/schema.md` (lines 195-297)

---

**작성일**: 2026-01-26
**버전**: 1.0
