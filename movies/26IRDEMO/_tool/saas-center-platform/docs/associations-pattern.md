# 매핑 테이블 패턴 (Associations Pattern)

## 개요

상담센터 SaaS 시스템에서 **도메인 간 연결을 관리하는 표준 패턴**입니다.

### 핵심 원칙

1. **FK 제약 없음**: Foreign Key 제약 대신 참조용 ID만 저장
2. **JOIN 금지**: 서로 다른 모듈 간 JOIN 연산 금지
3. **도메인 독립성**: 각 도메인은 다른 도메인의 존재를 모름
4. **2단계 조회**: 매핑 테이블 → Service 호출 패턴

### 왜 이 패턴인가?

| 기존 방식 | 문제점 | 매핑 테이블 패턴 |
|----------|--------|-----------------|
| FK 제약 사용 | 마이크로서비스 분리 어려움 | FK 없이 참조만 |
| Polymorphic 참조 (entity_type/entity_id) | 중앙 도메인이 모든 도메인 알아야 함 | 각 도메인이 자신의 매핑 테이블 소유 |
| JOIN으로 조회 | 모듈 간 결합도 높음 | 2단계 조회로 분리 |
| 중앙 집중식 관계 관리 | 새 도메인 추가 시 중앙 수정 필요 | 새 도메인은 자신의 매핑만 추가 |

---

## 패턴 구조

### 기본 구조

```
┌──────────────────┐           ┌──────────────────────┐           ┌──────────────────┐
│   Client Domain  │           │ Document Domain      │           │ Counseling Domain│
│                  │           │ (독립적, 중앙 모듈)   │           │                  │
│  ┌────────────┐  │           │  ┌────────────────┐  │           │  ┌────────────┐  │
│  │  Client    │  │           │  │  Document      │  │           │  │  Session   │  │
│  └────────────┘  │           │  └────────────────┘  │           │  └────────────┘  │
│        ↓         │           │                      │           │        ↓         │
│  ┌────────────┐  │           │                      │           │  ┌────────────┐  │
│  │ Client     │──┼─참조───→  │  (FK 없음)           │  ←──참조──┼─ │ Session    │  │
│  │ Document   │  │           │                      │           │  │ Document   │  │
│  └────────────┘  │           │                      │           │  └────────────┘  │
└──────────────────┘           └──────────────────────┘           └──────────────────┘

        ↑                                                                    ↑
        └───────── 각 도메인이 자신의 매핑 테이블 소유 ─────────────────────┘
```

### 매핑 테이블 표준 구조

```python
class {Domain}{CentralModule}(Base):
    """
    {Domain}과 {CentralModule} 연결
    - FK 제약 없음
    - 각 도메인이 소유
    - {central_module}_id는 참조용
    """
    __tablename__ = "{domain}_{central_modules}"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # 도메인 엔티티 참조 (FK 없음)
    {domain}_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # 중앙 모듈 참조 (FK 없음)
    {central_module}_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # 연결 유형 (도메인별 의미)
    relation_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 메타데이터 (선택)
    metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index("idx_{table}_domain", "{domain}_id"),
        Index("idx_{table}_central", "{central_module}_id"),
        UniqueConstraint("{domain}_id", "{central_module}_id"),  # 중복 방지
    )
```

---

## 실제 예시

### 1. Document 연결 패턴

#### Client ↔ Document

```python
# modules/client/document/models.py
class ClientDocument(Base):
    """Client와 Document 연결"""
    __tablename__ = "client_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Client 참조 (UUID)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # Document 참조 (integer)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # 문서 유형 (Client 도메인에서 정의)
    relation_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "consent_form", "contract", "id_card", "assessment_result"

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_client_documents_client", "client_id"),
        Index("idx_client_documents_document", "document_id"),
        UniqueConstraint("client_id", "document_id"),
    )
```

#### Counseling ↔ Document

```python
# modules/counseling/document/models.py
class CounselingSessionDocument(Base):
    """CounselingSession과 Document 연결"""
    __tablename__ = "counseling_session_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    counseling_session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # Counseling 도메인에서 정의
    relation_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "goal", "content", "summary", "private_memo", "attachment"

    created_at: Mapped[datetime]

    __table_args__ = (
        Index("idx_session_documents_session", "counseling_session_id"),
        Index("idx_session_documents_document", "document_id"),
        UniqueConstraint("counseling_session_id", "document_id"),
    )
```

#### Assessment ↔ Document

```python
# modules/assessment/document/models.py
class AssessmentDocument(Base):
    """Assessment와 Document 연결"""
    __tablename__ = "assessment_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    assessment_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # Assessment 도메인에서 정의
    relation_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "test_result", "interpretation_report", "raw_data"

    created_at: Mapped[datetime]

    __table_args__ = (
        Index("idx_assessment_documents_assessment", "assessment_id"),
        Index("idx_assessment_documents_document", "document_id"),
        UniqueConstraint("assessment_id", "document_id"),
    )
```

### 2. Form 연결 패턴

#### Client ↔ FormSubmission

```python
# modules/client/form/models.py
class ClientFormSubmission(Base):
    """Client와 FormSubmission 연결"""
    __tablename__ = "client_form_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # Client 도메인에서 정의
    relation_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "application", "consent_form", "initial_interview", "emergency_contact"

    created_at: Mapped[datetime]

    __table_args__ = (
        Index("idx_client_submissions_client", "client_id"),
        Index("idx_client_submissions_submission", "submission_id"),
        UniqueConstraint("client_id", "submission_id"),
    )
```

#### Counseling ↔ FormSubmission

```python
# modules/counseling/form/models.py
class CounselingSessionFormSubmission(Base):
    """CounselingSession과 FormSubmission 연결"""
    __tablename__ = "counseling_session_form_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    counseling_session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # Counseling 도메인에서 정의
    relation_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # "contract", "progress_note", "termination_report"

    created_at: Mapped[datetime]

    __table_args__ = (
        Index("idx_session_submissions_session", "counseling_session_id"),
        Index("idx_session_submissions_submission", "submission_id"),
        UniqueConstraint("counseling_session_id", "submission_id"),
    )
```

---

## 조회 패턴 (2단계)

### 기본 조회 패턴

```python
async def get_client_documents(
    client_id: str,
    client_doc_repo: ClientDocumentRepository,
    document_service: DocumentService
) -> list[dict]:
    """
    Client의 모든 문서 조회 (2단계)
    """
    # 1단계: 매핑 테이블에서 document_ids 조회
    client_docs = await client_doc_repo.find_by_client(client_id)
    document_ids = [cd.document_id for cd in client_docs]

    # relation_type 매핑 생성
    relation_map = {cd.document_id: cd.relation_type for cd in client_docs}

    # 2단계: Document Service 호출 (JOIN 없음)
    documents = await document_service.get_by_ids(document_ids)

    # 3단계: relation_type 추가
    for doc in documents:
        doc["relation_type"] = relation_map.get(doc["id"])

    return documents
```

### Repository 구현

```python
# modules/client/document/repository.py
class ClientDocumentRepository(BaseRepository):
    """ClientDocument 매핑 테이블 Repository"""

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.model = ClientDocument

    async def find_by_client(
        self,
        client_id: str
    ) -> list[ClientDocument]:
        """Client의 모든 문서 매핑 조회"""
        stmt = (
            select(self.model)
            .where(self.model.client_id == client_id)
            .order_by(self.model.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def find_by_document(
        self,
        document_id: int
    ) -> list[ClientDocument]:
        """Document를 참조하는 모든 Client 조회"""
        stmt = (
            select(self.model)
            .where(self.model.document_id == document_id)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def create_mapping(
        self,
        client_id: str,
        document_id: int,
        relation_type: str | None = None
    ) -> ClientDocument:
        """Client-Document 연결 생성"""
        mapping = ClientDocument(
            client_id=client_id,
            document_id=document_id,
            relation_type=relation_type
        )
        return await self.add(mapping)

    async def delete_mapping(
        self,
        client_id: str,
        document_id: int
    ) -> bool:
        """Client-Document 연결 삭제"""
        stmt = (
            delete(self.model)
            .where(
                self.model.client_id == client_id,
                self.model.document_id == document_id
            )
        )
        result = await self._session.execute(stmt)
        return result.rowcount > 0
```

### Handler 구현 (트랜잭션 관리)

```python
# modules/client/document/handlers/attach_document.py
async def attach_document_to_client_handler(
    client_id: str,
    document_id: int,
    relation_type: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """
    Document를 Client에 연결
    """
    async with uow:
        # 1. Client 존재 확인
        client_repo = uow.repo(ClientRepository)
        client = await client_repo.get(client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        # 2. Document 존재 확인 (Document Service 호출)
        document = await document_service.get_by_id(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # 3. 매핑 생성
        client_doc_repo = uow.repo(ClientDocumentRepository)
        mapping = await client_doc_repo.create_mapping(
            client_id=client_id,
            document_id=document_id,
            relation_type=relation_type
        )

        await uow.commit()
        return {"success": True, "mapping_id": mapping.id}
```

### API 엔드포인트

```python
# modules/client/document/router.py
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/clients", tags=["client-documents"])

@router.get("/{client_id}/documents")
async def get_client_documents(
    client_id: str,
    session: AsyncSession = Depends(get_session)
):
    """Client의 모든 문서 조회 (2단계 패턴)"""
    # 1단계: 매핑 조회
    client_doc_repo = ClientDocumentRepository(session)
    client_docs = await client_doc_repo.find_by_client(client_id)

    document_ids = [cd.document_id for cd in client_docs]
    relation_map = {cd.document_id: cd.relation_type for cd in client_docs}

    # 2단계: Document Service 호출
    documents = await document_service.get_by_ids(document_ids)

    # 3단계: relation_type 추가
    for doc in documents:
        doc["relation_type"] = relation_map.get(doc["id"])

    return {"items": documents}


@router.post("/{client_id}/documents/{document_id}")
async def attach_document(
    client_id: str,
    document_id: int,
    relation_type: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """Document를 Client에 연결"""
    return await attach_document_to_client_handler(
        client_id=client_id,
        document_id=document_id,
        relation_type=relation_type,
        uow=uow
    )


@router.delete("/{client_id}/documents/{document_id}")
async def detach_document(
    client_id: str,
    document_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Client에서 Document 연결 해제"""
    client_doc_repo = ClientDocumentRepository(session)
    deleted = await client_doc_repo.delete_mapping(client_id, document_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Mapping not found")

    await session.commit()
    return {"success": True}
```

---

## 무결성 관리 (Application Level)

### 삭제 시 Cascade 구현

FK 제약이 없으므로, 삭제 시 **application level에서 cascade 처리**가 필요합니다.

```python
# modules/client/services/delete_client.py
class DeleteClientService:
    """Client 삭제 Service"""

    def __init__(
        self,
        client_repo: ClientRepository,
        client_doc_repo: ClientDocumentRepository,
        client_form_repo: ClientFormSubmissionRepository
    ):
        self.client_repo = client_repo
        self.client_doc_repo = client_doc_repo
        self.client_form_repo = client_form_repo

    async def execute(self, client_id: str) -> bool:
        """
        Client 삭제 (연관된 매핑도 함께 삭제)
        """
        # 1. 매핑 삭제
        await self.client_doc_repo.delete_by_client(client_id)
        await self.client_form_repo.delete_by_client(client_id)

        # 2. Client 삭제
        deleted = await self.client_repo.delete(client_id)

        return deleted
```

### 참조 검증

```python
# modules/client/services/validate_document_reference.py
async def validate_document_exists(document_id: int) -> bool:
    """
    Document가 존재하는지 확인
    """
    document = await document_service.get_by_id(document_id)
    return document is not None


async def attach_document_with_validation(
    client_id: str,
    document_id: int,
    relation_type: str,
    client_doc_repo: ClientDocumentRepository
):
    """
    Document 연결 전 검증
    """
    # 1. Document 존재 확인
    if not await validate_document_exists(document_id):
        raise ValueError(f"Document {document_id} does not exist")

    # 2. 중복 확인
    existing = await client_doc_repo.find_by_client_and_document(
        client_id, document_id
    )
    if existing:
        raise ValueError("Document already attached to this client")

    # 3. 매핑 생성
    return await client_doc_repo.create_mapping(
        client_id=client_id,
        document_id=document_id,
        relation_type=relation_type
    )
```

---

## 성능 최적화

### 배치 조회

```python
async def get_multiple_clients_documents(
    client_ids: list[str],
    client_doc_repo: ClientDocumentRepository,
    document_service: DocumentService
) -> dict[str, list[dict]]:
    """
    여러 Client의 문서를 한 번에 조회
    """
    # 1. 모든 매핑 조회
    all_mappings = await client_doc_repo.find_by_clients(client_ids)

    # 2. document_ids 추출
    document_ids = list(set(m.document_id for m in all_mappings))

    # 3. 문서 일괄 조회
    documents = await document_service.get_by_ids(document_ids)
    document_map = {doc["id"]: doc for doc in documents}

    # 4. Client별로 그룹화
    result = {client_id: [] for client_id in client_ids}
    for mapping in all_mappings:
        doc = document_map.get(mapping.document_id)
        if doc:
            doc_with_relation = {**doc, "relation_type": mapping.relation_type}
            result[mapping.client_id].append(doc_with_relation)

    return result
```

### 캐싱 전략

```python
# 자주 조회되는 매핑은 Redis 캐싱
from functools import lru_cache
from redis import Redis

redis_client = Redis()

async def get_client_document_ids_cached(
    client_id: str,
    client_doc_repo: ClientDocumentRepository
) -> list[int]:
    """
    Client의 document_ids 조회 (캐시 사용)
    """
    cache_key = f"client:{client_id}:documents"

    # 캐시 확인
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # DB 조회
    client_docs = await client_doc_repo.find_by_client(client_id)
    document_ids = [cd.document_id for cd in client_docs]

    # 캐시 저장 (5분)
    redis_client.setex(cache_key, 300, json.dumps(document_ids))

    return document_ids
```

---

## 장점 및 단점

### 장점

| 항목 | 설명 |
|------|------|
| **도메인 독립성** | Document, Form 등 중앙 모듈은 다른 도메인을 모름 |
| **확장 용이** | 새 도메인 추가 시 중앙 모듈 수정 불필요 |
| **마이크로서비스 준비** | FK 없어 서비스 분리 시 마이그레이션 용이 |
| **M:N 지원** | 하나의 Document를 여러 엔티티가 참조 가능 |
| **명시적 관계** | relation_type으로 연결 의미 명확 |

### 단점 및 해결책

| 단점 | 해결책 |
|------|--------|
| **참조 무결성 없음** | Application level 검증 구현 |
| **성능 오버헤드 (2단계 조회)** | 배치 조회, 캐싱 전략 |
| **Cascade 수동 구현** | Service layer에서 명시적 cascade 처리 |
| **복잡도 증가** | 명확한 패턴 문서화 및 코드 템플릿 제공 |

---

## 패턴 적용 체크리스트

새 도메인에서 중앙 모듈(Document, Form)을 연결할 때:

- [ ] 매핑 테이블 생성 (`{Domain}{CentralModule}`)
- [ ] FK 제약 없음 확인 (String/Integer 컬럼만)
- [ ] UniqueConstraint 추가 (중복 방지)
- [ ] Index 추가 (양방향 조회 최적화)
- [ ] Repository 구현 (find_by_domain, create_mapping, delete_mapping)
- [ ] Handler에서 참조 검증 구현
- [ ] 2단계 조회 패턴 적용
- [ ] Cascade 삭제 로직 구현
- [ ] API 엔드포인트 추가 (`GET /domain/{id}/central_modules`)

---

## 엣지케이스 처리

### 1. 중복 매핑 생성

**문제**: 동일한 엔티티-문서 쌍을 동시에 연결 시도

**해결책**: UPSERT 패턴 + UniqueConstraint

```sql
INSERT INTO client_documents (client_id, document_id, relation_type, created_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (client_id, document_id)
DO UPDATE SET relation_type = EXCLUDED.relation_type
RETURNING *;
```

### 2. Orphan 매핑 정리

**문제**: 엔티티 삭제 후 매핑만 남음

**해결책**: 배치 작업으로 정리

```python
# 매일 실행
async def cleanup_orphan_mappings():
    """삭제된 엔티티의 매핑 정리"""
    orphans = await db.execute("""
        SELECT cd.id
        FROM client_documents cd
        LEFT JOIN clients c ON cd.client_id = c.id
        WHERE c.id IS NULL OR c.deleted_at IS NOT NULL
    """)

    await client_doc_repo.delete_by_ids([row.id for row in orphans])
```

### 3. 대량 매핑 생성 성능

**문제**: 100개 엔티티에 동일 문서 연결 시 느림

**해결책**: Bulk Insert

```python
# 한 번의 쿼리로 처리
values = [(client_id, document_id, "consent", now())
          for client_id in client_ids]

await db.executemany("""
    INSERT INTO client_documents (client_id, document_id, relation_type, created_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
""", values)
```

### 4. 캐시 무효화

**문제**: 매핑 변경 후 캐시 불일치

**해결책**: 이벤트 기반 무효화

```python
async def attach_document(client_id: str, document_id: int):
    # 매핑 생성
    await client_doc_repo.create_mapping(client_id, document_id)

    # 캐시 무효화
    await redis_client.delete(f"client:{client_id}:documents")
    await redis_client.delete(f"document:{document_id}:references")
```

### 5. 센터 이관 시 매핑 처리

**문제**: Client가 다른 센터로 이관 시 Document 매핑 유지?

**전략 1**: 매핑 유지 (Document도 함께 이관)
```python
# Client와 관련 Document 모두 새 센터로 이관
await document_repo.update_center_bulk(document_ids, new_center_id)
```

**전략 2**: 매핑 해제 (센터별 격리 유지)
```python
# 기존 매핑 삭제
await client_doc_repo.delete_by_client(client_id)
```

**권장**: 전략 1 (사용자 경험 우선)

---

## 결론

**매핑 테이블 패턴은 마이크로서비스 지향 모놀리스를 위한 핵심 패턴**입니다.

- FK 제약 없이 참조만 유지
- 각 도메인이 자신의 매핑 테이블 소유
- 2단계 조회로 모듈 간 결합도 최소화
- Application level에서 무결성 관리

이 패턴을 통해 향후 마이크로서비스로 전환 시 **매끄러운 분리**가 가능합니다.
