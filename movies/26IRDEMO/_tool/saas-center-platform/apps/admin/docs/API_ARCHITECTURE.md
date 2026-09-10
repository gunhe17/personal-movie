# Admin API 아키텍처 가이드

> `apps/api/app/modules/platform_admin/` 하위 모든 모듈의 구조 기준.
> 신규 API 추가 및 기존 코드 리팩토링 시 이 문서를 따른다.

---

## 1. 레이어 구조

```
Request → Router → Handler → Service → Repository → DB
                      ↓
                 Unit of Work (트랜잭션 경계)
```

| 레이어 | 파일 | 책임 |
|---|---|---|
| **Router** | `router.py` | FastAPI endpoint 선언, `Depends()` 주입 |
| **Handler** | `handlers/{action}.py` | `uow.repo()` → Service 호출 + `audit.log` + `uow.commit` |
| **Service** | `services/{action}.py` | 조회 → 권한 검증 → 비즈니스 로직 |
| **Repository** | `repository.py` | 순수 쿼리 (복잡한 필터/집계/페이지네이션) |
| **Model** | `models.py` | SQLAlchemy ORM 엔티티 |
| **Schema** | `schemas.py` | Pydantic 요청/응답 모델 |

**Facade 불필요**: platform_admin 모듈은 도메인 간 복합 조합이 적음.
복잡한 경우(여러 Service 조합이 필요한 경우)는 Handler에서 직접 조합.

---

## 2. 디렉토리 구조

### 현재 모듈 목록

```
apps/api/app/modules/platform_admin/
├── router.py                        # 전체 라우터 등록
├── auth/                            # 인증 (login, refresh, 2FA)
├── admin_account/                   # 어드민 계정 모델 + 로그인 서비스
├── admin_account_management/        # 어드민 계정 관리 CRUD
├── center/                          # 센터 조회/관리
├── center_application/              # 센터 신청 승인/반려
├── account/                         # 센터 사용자 계정 관리
├── assessment/                      # 검사 도구 관리
├── notice/                          # 공지사항 관리
├── cs_memo/                         # CS 전화 메모 관리 ← 표준 패턴 참고
├── qna/                             # 문의(inquiry) + FAQ 관리
├── audit_log/                       # 감사 로그 조회
└── upload/                          # 이미지 업로드
```

### 표준 모듈 구조 (Repository 있음)

쿼리가 복잡하거나(복합 필터, 날짜 범위, 집계 등) 재사용이 필요한 경우:

```
{module}/
├── models.py
├── schemas.py
├── router.py
├── repository.py          # 복잡한 쿼리 전담
├── handlers/
│   ├── __init__.py
│   ├── list_{items}.py
│   ├── get_{item}.py
│   ├── create_{item}.py
│   ├── update_{item}.py
│   └── delete_{item}.py
└── services/
    ├── __init__.py
    ├── list_{items}.py
    ├── get_{item}.py
    ├── create_{item}.py
    ├── update_{item}.py
    └── delete_{item}.py
```

### 단순 모듈 구조 (Repository 없음)

쿼리가 단순한 경우 — Service에서 `self.repo._session`으로 직접 처리:

```
{module}/
├── models.py
├── schemas.py
├── router.py
└── handlers/
    ├── __init__.py
    └── {action}.py        # Service 없이 handler에서 직접 처리도 허용
```

---

## 3. 각 레이어 작성 규칙

### 3.1 Router

```python
"""모듈 라우터"""
from datetime import date
from fastapi import APIRouter, Depends, Query

from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.platform_admin.auth.dependencies import get_current_admin
from app.modules.platform_admin.audit_log.dependencies import AuditLogger, get_audit_logger
from app.modules.platform_admin.{module}.schemas import {ListResponse}, {DetailResponse}, {CreateSchema}
from app.modules.platform_admin.{module}.handlers.list_{items} import list_{items}_handler
from app.modules.platform_admin.{module}.handlers.create_{item} import create_{item}_handler

router = APIRouter(tags=["Admin - {모듈명}"])


# 조회: audit 불필요
@router.get("/", response_model={ListResponse}, summary="{항목} 목록 조회")
async def list_items(
    search: str | None = Query(default=None, description="검색어"),
    date_from: date | None = Query(default=None, description="시작 날짜 (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="종료 날짜 (YYYY-MM-DD)"),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    current_admin: dict = Depends(get_current_admin),
    uow: UnitOfWork = Depends(get_uow),
):
    return await list_items_handler(
        uow,
        current_admin=current_admin,
        search=search,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )


# 쓰기: audit 필수
@router.post("/", response_model={DetailResponse}, status_code=201, summary="{항목} 생성")
async def create_item(
    data: {CreateSchema},
    current_admin: dict = Depends(get_current_admin),
    uow: UnitOfWork = Depends(get_uow),
    audit: AuditLogger = Depends(get_audit_logger),
):
    return await create_item_handler(data, current_admin, uow, audit)
```

**규칙:**
- `response_model` 반드시 명시
- GET은 `audit` 불필요, POST/PATCH/DELETE는 `audit: AuditLogger = Depends(get_audit_logger)` 주입
- 파라미터는 primitives만 (Pydantic 스키마는 body로 받고 handler에 그대로 전달)

---

### 3.2 Handler

```python
"""핸들러: Service 호출 + audit + commit만 담당"""
from app.core.unit_of_work import UnitOfWork
from app.modules.platform_admin.{module}.repository import {Module}Repository
from app.modules.platform_admin.{module}.schemas import {CreateSchema}, {DetailResponse}
from app.modules.platform_admin.{module}.services.create_{item} import Create{Item}Service
from app.modules.platform_admin.audit_log.dependencies import AuditLogger


async def create_item_handler(
    data: {CreateSchema},
    current_admin: dict,
    uow: UnitOfWork,
    audit: AuditLogger,
) -> {DetailResponse}:
    async with uow:
        repo = uow.repo({Module}Repository)
        service = Create{Item}Service(repo)
        result = await service.execute(data, current_admin)

        await audit.log(
            action="{module}.created",
            target_type="{module}",
            target_id=result.id,
            summary=f"{항목} 생성: {result.title}",
        )
        await uow.commit()

    return result
```

**규칙:**
- `uow._session` 직접 접근 금지 → `uow.repo()` 사용
- `try-except` 금지 (전역 예외 핸들러가 처리)
- `audit.log()` 는 반드시 `uow.commit()` 직전에 호출
- 조회 핸들러는 `async with uow:` 블록만, `commit()` 없음
- Repository가 없는 단순 모듈은 Handler에서 `uow._session` 직접 사용 허용 (단, 점진적으로 Repository로 이전)

---

### 3.3 Service

```python
"""서비스: 조회 → 권한 검증 → 비즈니스 로직"""
from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.modules.platform_admin.{module}.repository import {Module}Repository
from app.modules.platform_admin.{module}.schemas import {DetailResponse}


class Create{Item}Service:
    def __init__(self, repo: {Module}Repository):
        self.repo = repo

    async def execute(self, data: {CreateSchema}, current_admin: dict) -> {DetailResponse}:
        # 1. 필요시 선행 조회 (예: 센터명 비정규화)
        center_name = None
        if data.center_id:
            stmt = select(Center.name).where(Center.id == data.center_id)
            center_name = (await self.repo._session.execute(stmt)).scalar_one_or_none()

        # 2. 엔티티 생성
        item = await self.repo.create({
            "title": data.title,
            "created_by": current_admin["admin_account_id"],
            ...
        })

        return {DetailResponse}.model_validate(item)


class Get{Item}Service:
    def __init__(self, repo: {Module}Repository):
        self.repo = repo

    async def execute(self, item_id: str, current_admin: dict) -> {DetailResponse}:
        # 1. 조회
        item = await self.repo.get_active(item_id)
        if not item:
            raise EntityNotFoundException(f"항목을 찾을 수 없습니다: {item_id}")

        # 2. 권한 검증
        if current_admin["role"] != "super_admin" and item.created_by != current_admin["admin_account_id"]:
            raise PermissionDeniedException("권한이 없습니다")

        return {DetailResponse}.model_validate(item)
```

**규칙:**
- `HTTPException` 금지 → `EntityNotFoundException`, `PermissionDeniedException` 등 도메인 예외만 사용
- `commit()`/`rollback()` 금지 → `flush()`만 허용
- Repository는 1개만 사용 (여러 Repository가 필요하면 Handler에서 각 Service를 조합)
- Boolean 컬럼 비교: `== True` 대신 `.is_(True)` / `.is_(False)` 사용

---

### 3.4 Repository

```python
"""Repository: 순수 쿼리만 — 비즈니스 로직 금지"""
from datetime import date, datetime, time
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.platform_admin.{module}.models import {Model}


class {Module}Repository(BaseRepository[{Model}]):
    def __init__(self, session: AsyncSession):
        super().__init__({Model}, session)

    async def list_items(
        self,
        *,
        admin_id: str | None = None,      # None이면 전체 조회 (super_admin용)
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[{Model}], int]:
        conditions = [{Model}.deleted_at.is_(None)]

        if admin_id:
            conditions.append({Model}.created_by == admin_id)

        if search:
            conditions.append(
                or_(
                    {Model}.title.ilike(f"%{search}%"),
                    {Model}.content.ilike(f"%{search}%"),
                )
            )

        if date_from:
            conditions.append({Model}.created_at >= date_from)

        if date_to:
            end_of_day = datetime.combine(date_to, time.max)
            conditions.append({Model}.created_at <= end_of_day)

        count_stmt = select(func.count()).select_from({Model}).where(*conditions)
        total = (await self._session.execute(count_stmt)).scalar_one()

        offset = (page - 1) * size
        stmt = (
            select({Model})
            .where(*conditions)
            .order_by({Model}.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        return rows, total

    async def get_active(self, item_id: str) -> {Model} | None:
        """소프트 삭제되지 않은 단건 조회"""
        stmt = select({Model}).where(
            {Model}.id == item_id,
            {Model}.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def get_active_many(self, item_ids: list[str]) -> list[{Model}]:
        """소프트 삭제되지 않은 다건 조회"""
        stmt = select({Model}).where(
            {Model}.id.in_(item_ids),
            {Model}.deleted_at.is_(None),
        )
        return list((await self._session.execute(stmt)).scalars().all())
```

**규칙:**
- `commit()`/`rollback()` 금지 → `flush()`만 허용
- 비즈니스 로직, 권한 검증 금지
- Boolean 컬럼: `.is_(True)` / `.is_(False)` 사용 (`==` 연산자 사용 불가)

---

## 4. Repository 생성 기준

| 기준 | Repository 없음 | Repository 있음 |
|---|---|---|
| 쿼리 복잡도 | 단순 CRUD, 1-2개 조건 | 복합 필터, 날짜 범위, 집계, 전문 검색 |
| 재사용 | 한 곳에서만 사용 | 여러 handler/service에서 재사용 |
| 현재 적용 | `notice`, `qna`, `center`, `account` | `cs_memo`, `admin_account_management`, `audit_log` |

> 단순 모듈도 쿼리가 복잡해지면 `repository.py`를 추가하고 Service 내 직접 쿼리를 Repository 메서드로 이전한다.

---

## 5. 감사 로그 (Audit Log) 작성 규칙

모든 **쓰기 작업** (POST/PATCH/DELETE) Handler에 필수:

```python
await audit.log(
    action="{target_type}.{행위}",    # 형식: "cs_memo.created"
    target_type="{target_type}",      # 예: "cs_memo"
    target_id=result.id,
    summary="사람이 읽을 수 있는 한국어 설명",
    extra={...},                      # 선택: 추가 메타데이터
)
await uow.commit()  # audit.log 이후 반드시 commit
```

| 행위 | action 형식 | 예시 |
|---|---|---|
| 생성 | `{module}.created` | `cs_memo.created` |
| 수정 | `{module}.updated` | `notice.updated` |
| 삭제 | `{module}.deleted` | `center.deleted` |
| 일괄 삭제 | `{module}.bulk_deleted` | `cs_memo.bulk_deleted` |
| 상태 변경 | `{module}.{상태}` | `center_application.approved` |

**예외 (로그 불필요):**
- GET 요청 (조회만)
- 로그인/로그아웃 (`auth.*`) — `current_admin`이 없는 시점이므로 별도 방식 사용

---

## 6. 현재 모듈별 구조 현황

| 모듈 | Repository | Services | 상태 |
|---|---|---|---|
| `auth` | ✗ | ✓ | `admin_account` 모델 참조 |
| `admin_account` | ✓ | ✓ | 인증 전용 서비스 |
| `admin_account_management` | ✓ | ✓ | 표준 패턴 적용 |
| `center` | ✗ | ✗ | Handler 직접 처리 |
| `center_application` | ✗ | ✗ | Handler 직접 처리 |
| `account` | ✗ | ✗ | Handler 직접 처리 |
| `assessment` | ✗ | ✗ | Handler 직접 처리 |
| `notice` | ✗ | ✗ | Handler 직접 처리 |
| `cs_memo` | ✓ | ✓ | **표준 패턴 참고 예시** |
| `qna` | ✗ | ✗ | Handler 직접 처리 |
| `audit_log` | ✓ | ✗ | append-only, 커스텀 Repository |
| `upload` | ✗ | ✗ | 인프라 서비스 위임 |

---

## 7. 표준 패턴 참고 예시 — `cs_memo`

`cs_memo`가 현재 표준 패턴을 완전히 따르는 기준 모듈입니다.

```
cs_memo/
├── models.py              ← BaseModel 상속, partial index 정의
├── schemas.py             ← Summary(목록용) / DetailResponse(상세용) / ListResponse 분리
├── router.py              ← date_from/date_to 포함, GET/POST/PATCH/DELETE audit 구분
├── repository.py          ← list_memos(복합 필터+페이지네이션), get_active, get_active_many
├── handlers/
│   ├── list_memos.py      ← uow.repo() → ListMemosService → return (commit 없음)
│   ├── get_memo.py        ← uow.repo() → GetMemoService → return (commit 없음)
│   ├── create_memo.py     ← uow.repo() → CreateMemoService → audit.log → commit
│   ├── update_memo.py     ← uow.repo() → UpdateMemoService → audit.log → commit
│   ├── delete_memo.py     ← uow.repo() → DeleteMemoService → audit.log → commit
│   └── bulk_delete_memos.py
└── services/
    ├── list_memos.py      ← 권한 필터(admin_id) + ListMemosService.execute()
    ├── get_memo.py        ← 존재 확인 + 권한 검증
    ├── create_memo.py     ← 센터명 비정규화 + repo.create()
    ├── update_memo.py     ← 존재 확인 + 권한 검증 + 필드 업데이트
    ├── delete_memo.py     ← 존재 확인 + 권한 검증 + repo.delete()
    └── bulk_delete_memos.py
```

---

## 8. 센터용 모듈과의 의존 관계

```
관리자 모듈은 기존 센터용 모듈의 Model만 참조한다.
Service/Facade/Repository는 절대 재사용하지 않는다.

✅ 허용:
  from app.modules.center.center.models import Center
  from app.modules.auth.account.models import Account

❌ 금지:
  from app.modules.center.facade import CenterFacade
  from app.modules.client.repository import ClientRepository
  from app.modules.counseling.services import ...
```

**이유:**
- 관리자 쿼리는 전체 범위, 센터 쿼리는 센터 내 범위
- 결합도를 낮춰 관리자 기능 변경이 센터 기능에 영향을 주지 않도록 유지

---

## 9. 신규 모듈 추가 체크리스트

```
□ models.py
  - BaseModel 상속
  - 자주 필터링되는 컬럼에 Index 추가
  - partial index: postgresql_where="deleted_at IS NULL"

□ schemas.py
  - Request: {Item}Create, {Item}Update, (필요시) {Item}BulkDelete
  - Response: {Item}Summary(목록용), {Item}DetailResponse(상세용), {Item}ListResponse
  - ListResponse에 build() classmethod 포함 (total, page, size, pages)
  - model_config = {"from_attributes": True}

□ router.py
  - response_model 반드시 명시
  - GET은 audit 불필요, POST/PATCH/DELETE는 audit 주입
  - Query 파라미터에 description 작성

□ handlers/{action}.py
  - uow.repo() → service 호출
  - 쓰기 핸들러: audit.log → uow.commit
  - 조회 핸들러: commit 없음
  - try-except 금지

□ services/{action}.py (비즈니스 로직 있을 때)
  - EntityNotFoundException, PermissionDeniedException 사용
  - HTTPException 금지
  - flush()만 허용, commit 금지

□ repository.py (쿼리 복잡할 때)
  - BaseRepository 상속
  - Boolean 컬럼: .is_(True) / .is_(False) 사용
  - 비즈니스 로직 금지

□ platform_admin/router.py 에 include_router 등록
□ 감사 로그 action 형식: "{module}.{행위}" (예: cs_memo.created)
```

---

## 10. 안티패턴

```
❌ Handler에서 uow._session 직접 접근 (Repository가 있는 모듈)
   → uow.repo({Module}Repository) 사용

❌ Handler에서 try-except
   → 전역 예외 핸들러가 도메인 예외를 HTTP 응답으로 변환

❌ Service에서 HTTPException
   → EntityNotFoundException, PermissionDeniedException 등 도메인 예외 사용

❌ Service/Repository에서 commit/rollback
   → Handler의 UoW가 유일한 트랜잭션 관리자

❌ Boolean 컬럼에 == True / == False
   → SQLAlchemy에서 ArgumentError 발생, .is_(True) / .is_(False) 사용

❌ audit.log 없이 쓰기 작업 commit
   → 모든 POST/PATCH/DELETE는 audit.log → commit 순서 준수
```
