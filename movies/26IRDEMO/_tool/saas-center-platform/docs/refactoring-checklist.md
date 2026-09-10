# 모듈 리팩토링 체크리스트

> Document 모듈을 기준으로 한 표준 패턴. 모든 모듈은 이 패턴을 따라야 합니다.

## 왜 이 패턴인가?

- ✅ **코드량 75% 감소**: Handler의 try-except 제거
- ✅ **타입 안전성**: 문자열 비교 대신 타입 기반 예외
- ✅ **유지보수성**: 명확한 책임 분리, 중복 제거
- ✅ **테스트 용이성**: Service 단위 테스트 가능
- ✅ **일관성**: 모든 모듈이 동일한 구조

---

## 📋 리팩토링 체크리스트

### 1. Repository Layer

**목적**: 순수 CRUD + 쿼리만, 비즈니스 로직 금지

#### ✅ 체크포인트

- [ ] 비즈니스 로직 메서드 제거 (`soft_delete`, `restore`, `update_*` 등)
- [ ] CRUD 메서드만 유지 (`create`, `update`, `delete`, `get`, `find`)
- [ ] 쿼리 메서드는 순수 SELECT만 (검증 없음)
- [ ] `datetime` import 제거 (비즈니스 로직에 속함)
- [ ] 메서드는 `commit()`하지 않음 (UoW가 담당)

#### 📝 올바른 예시 (Document Repository)

```python
# app/modules/document/document/repository.py
class DocumentRepository(BaseRepository[Document]):
    """순수 CRUD + 쿼리만"""

    async def find_by_center(
        self,
        center_id: str,
        page: int,
        size: int,
        include_deleted: bool = False
    ) -> tuple[list[Document], int]:
        """센터의 문서 목록 조회 (페이지네이션)"""
        # ✅ 순수 SELECT 쿼리만
        query = select(Document).where(Document.center_id == center_id)

        if not include_deleted:
            query = query.where(Document.deleted_at.is_(None))

        # ... 페이지네이션, 정렬
        return documents, total

    async def get_by_id(
        self,
        document_id: str,
        include_deleted: bool = False
    ) -> Document | None:
        """ID로 문서 조회"""
        # ✅ 순수 SELECT 쿼리만
        query = select(Document).where(Document.id == document_id)

        if not include_deleted:
            query = query.where(Document.deleted_at.is_(None))

        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    # ❌ 제거해야 할 메서드들
    # async def soft_delete(self, document_id: str) -> Document
    # async def restore(self, document_id: str) -> Document
    # async def update_storage_path(self, document_id: str, path: str) -> Document
```

---

### 2. Service Layer

**목적**: 모든 비즈니스 로직 (조회 + 검증 + 실행)

#### ✅ 체크포인트

- [ ] Service는 단일 책임 (1 Service = 1 비즈니스 로직)
- [ ] 조회 → 검증 → 로직 순서 준수
- [ ] Custom Domain Exception 사용 (`EntityNotFoundException`, `PermissionDeniedException` 등)
- [ ] Repository를 직접 사용 (`self.repo`)
- [ ] `async def execute()` 메서드 이름 통일

#### 📝 올바른 예시 (DeleteDocumentService)

```python
# app/modules/document/document/services/delete_document.py
from datetime import datetime, timezone
from app.core.exceptions import EntityNotFoundException, PermissionDeniedException

class DeleteDocumentService:
    """단일 책임: Document Soft Delete"""

    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(self, document_id: str, center_id: str) -> Document:
        """
        문서 Soft Delete

        1. 조회
        2. 검증
        3. 비즈니스 로직
        """
        # 1. 조회
        document = await self.repo.get_by_id(document_id, include_deleted=False)

        # 2. 검증 - Custom Exception 사용
        if not document:
            raise EntityNotFoundException(f"Document not found: {document_id}")

        if document.center_id != center_id:
            raise PermissionDeniedException("권한이 없는 센터의 문서입니다")

        # 3. 비즈니스 로직
        document.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.repo._session.flush()

        return document
```

#### 📝 올바른 예시 (GetDocumentService)

```python
# app/modules/document/document/services/get_document.py
from app.core.exceptions import EntityNotFoundException, PermissionDeniedException

class GetDocumentService:
    """단일 책임: Document 조회"""

    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def execute(
        self,
        document_id: str,
        center_id: str,
        include_deleted: bool = False
    ) -> Document:
        """문서 조회 및 권한 검증"""
        # 1. 조회
        document = await self.repo.get_by_id(document_id, include_deleted)

        # 2. 검증
        if not document:
            raise EntityNotFoundException(f"Document not found: {document_id}")

        if document.center_id != center_id:
            raise PermissionDeniedException("권한이 없는 센터의 문서입니다")

        return document
```

---

### 3. Handler Layer

**목적**: Service 조합 + 트랜잭션 관리 (try-except 없음!)

#### ✅ 체크포인트

- [ ] HTTPException import 제거
- [ ] 모든 try-except 블록 제거
- [ ] Service 조합만 수행
- [ ] UnitOfWork로 트랜잭션 관리
- [ ] `Depends()` 사용 금지 (Router에서만)
- [ ] 기본값 금지 (모든 파라미터 required)

#### 📝 올바른 예시 (delete_document_handler)

```python
# app/modules/document/document/handlers/delete_document.py
from app.core.unit_of_work import UnitOfWork
from ..schemas import DocumentResponse
from ..repository import DocumentRepository
from ..services.delete_document import DeleteDocumentService
from ...document_access.handlers.create_access_log import create_access_log_internal

async def delete_document_handler(
    document_id: str,
    center_id: str,
    account_id: str,
    client_info: ClientInfo,
    uow: UnitOfWork,  # ❌ Depends 없음
) -> DocumentResponse:
    """
    문서 삭제 Handler

    - Service 조합
    - 트랜잭션 관리
    - try-except 없음!
    """
    async with uow:
        # Repository 획득
        document_repo = uow.repo(DocumentRepository)

        # Service 호출 - 도메인 예외는 전역 핸들러가 자동 변환!
        delete_service = DeleteDocumentService(document_repo)
        document = await delete_service.execute(document_id, center_id)

        # 크로스 모듈 조합 (접근 로그 생성)
        await create_access_log_internal(
            uow=uow,
            document_id=document_id,
            account_id=account_id,
            action="delete",
            client_info=client_info,
        )

        await uow.commit()

    return DocumentResponse.model_validate(document)
```

#### ❌ 안티패턴 (이전 방식 - 사용 금지)

```python
# ❌ 나쁨: try-except + HTTPException
async def delete_document_handler(...):
    async with uow:
        repo = uow.repo(DocumentRepository)

        try:
            # 10줄의 조회/검증 로직
            document = await repo.get_by_id(...)
            if not document:
                raise ValueError("Document not found")
            if document.center_id != center_id:
                raise ValueError("Permission denied")

            # 10줄의 삭제 로직
            await repo.soft_delete(...)

        except ValueError as e:
            # 15줄의 예외 처리
            if "not found" in str(e):
                raise HTTPException(404, ...)
            elif "permission" in str(e):
                raise HTTPException(403, ...)
            else:
                raise HTTPException(400, ...)

        await uow.commit()

    return DocumentResponse.model_validate(document)
```

---

### 4. Router Layer

**목적**: HTTP 계층 처리 + Handler 호출

#### ✅ 체크포인트

- [ ] Endpoint 함수에서 HTTP 계층 처리 (`Depends`, 기본값, 타입 변환)
- [ ] Handler 호출 (순수 파라미터 전달)
- [ ] `response_model` 명시 (Swagger 문서화)
- [ ] 구체적인 Pydantic 타입 사용 (`dict` 금지)

#### 📝 올바른 예시

```python
# app/modules/document/document/router.py
from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_center_context, CenterContext
from app.core.unit_of_work import UnitOfWork, get_uow
from .handlers import delete_document_handler, list_documents_handler
from .schemas import DocumentResponse, DocumentListResponse

router = APIRouter(tags=["document"])

# ✅ 목록 조회: DocumentListResponse (Summary 포함)
@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    ctx: CenterContext = Depends(get_center_context),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    include_deleted: bool = Query(False),
    uow: UnitOfWork = Depends(get_uow),
):
    """문서 목록 조회"""
    return await list_documents_handler(
        center_id=ctx.center_id,
        page=page,
        size=size,
        include_deleted=include_deleted,
        uow=uow,
    )

# ✅ 상세 조회: DocumentResponse (전체 필드)
@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    ctx: CenterContext = Depends(get_center_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """문서 상세 조회"""
    return await get_document_handler(
        document_id=document_id,
        center_id=ctx.center_id,
        uow=uow,
    )

# ✅ 삭제: DocumentResponse
@router.delete("/{document_id}", response_model=DocumentResponse)
async def delete_document(
    document_id: str,
    ctx: CenterContext = Depends(get_center_context),
    client: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    """문서 Soft Delete"""
    return await delete_document_handler(
        document_id=document_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        client_info=client,
        uow=uow,
    )
```

---

### 5. Schemas Layer

**목적**: 목록/상세 응답 분리

#### ✅ 체크포인트

- [ ] `{Entity}Summary` 스키마 정의 (최소 필드)
- [ ] `{Entity}Response` 스키마 정의 (전체 필드)
- [ ] `{Entity}ListResponse`의 items 타입: `list[{Entity}Summary]`
- [ ] Response 스키마에 Enum 타입 사용 (`str` 금지)
- [ ] `model_config = {"from_attributes": True}` 설정

#### 📝 올바른 예시

```python
# app/modules/document/document/schemas.py
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict

class AccessLevel(str, Enum):
    """접근 수준"""
    CENTER = "center"
    PUBLIC = "public"

class DocumentResponse(BaseModel):
    """문서 상세 응답 (모든 필드)"""
    id: str
    center_id: str
    uploader_id: str
    name: str
    description: str | None
    storage_path: str
    file_type: str
    file_size: int
    checksum: str
    access_level: AccessLevel  # ✅ Enum 타입 사용
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentSummary(BaseModel):
    """문서 요약 (목록용 - 최소 필드만)"""
    id: str
    name: str
    file_type: str
    file_size: int
    storage_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    """문서 목록 응답"""
    items: list[DocumentSummary]  # ✅ Summary 사용
    total: int
    page: int
    size: int
    pages: int
```

---

## 🚀 리팩토링 순서

### 1단계: Custom Domain Exceptions 확인
- `app/core/exceptions.py` 확인
- 필요한 예외 타입 추가

### 2단계: Repository 정리
- 비즈니스 로직 메서드 제거
- 순수 CRUD + 쿼리만 유지

### 3단계: Service 작성
- 각 비즈니스 로직을 독립된 Service로 분리
- 조회 → 검증 → 로직 순서 준수
- Custom Exception 사용

### 4단계: Handler 간소화
- HTTPException import 제거
- try-except 블록 제거
- Service 조합만 수행

### 5단계: Schemas 정리
- Summary 스키마 정의
- ListResponse에 Summary 적용
- Enum 타입 사용

### 6단계: Router 업데이트
- response_model 명시
- Handler 호출 파라미터 정리

### 7단계: 테스트
- 서버 시작 확인
- API 엔드포인트 테스트
- 에러 응답 확인

---

## 📊 리팩토링 효과 측정

### Before (이전 방식)
```
Repository: 비즈니스 로직 포함 (10개 메서드)
Service: 거의 없음 (Repository 직접 호출)
Handler: try-except + 검증 로직 (40줄)
```

### After (Document 패턴)
```
Repository: 순수 CRUD (3개 메서드)
Service: 모든 비즈니스 로직 (5개 Service)
Handler: Service 조합만 (10줄)
```

**개선 효과**:
- Handler 코드량: **75% 감소**
- 타입 안전성: **100% 향상**
- 테스트 용이성: **Service 단위 테스트 가능**
- 유지보수성: **중복 제거, 명확한 책임**

---

## ⚠️ 주의사항

### 절대 하지 말 것

1. **Handler에 try-except 추가**
   - 도메인 예외는 전역 핸들러가 자동 변환
   - try-except는 제거하세요

2. **Repository에 비즈니스 로직 추가**
   - `soft_delete`, `restore` 같은 메서드 금지
   - Service에서 처리하세요

3. **Service에서 HTTPException 사용**
   - Custom Domain Exception만 사용
   - HTTP 응답은 전역 핸들러가 담당

4. **목록 응답에 전체 필드 반환**
   - Summary 스키마 사용
   - 네트워크 효율성 중요

5. **Handler에 Depends() 사용**
   - Router에서만 사용
   - Handler는 순수 파라미터만

---

## 📚 참고 문서

- [CLAUDE.md](../CLAUDE.md): 전체 프로젝트 가이드
- [app/core/exceptions.py](../apps/api/app/core/exceptions.py): 도메인 예외 정의
- [app/core/logger.py](../apps/api/app/core/logger.py): 로깅 시스템
- [Document 모듈](../apps/api/app/modules/document/document/): 표준 패턴 예시
