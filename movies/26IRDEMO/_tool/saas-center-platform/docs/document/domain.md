# Document 도메인 설계 (v3.0)

> **v3.0 핵심**: DocumentVersion 테이블 제거, S3 Versioning으로 버전 관리 통일

## 설계 철학

### 핵심 원칙
1. **S3 Native**: AWS S3 Versioning 활용, 이중 버전 관리 제거
2. **도메인 독립성**: 매핑 테이블 패턴으로 모듈러 모놀리스 준수
3. **단순성**: 필요한 테이블만 유지, 핵심 기능에 집중
4. **감사 추적**: S3 Object Versioning + DocumentAccess 로그

### v2.0 → v3.0 변경사항
- ❌ **DocumentVersion 테이블 완전 제거**: S3 Versioning이 대체
- ❌ **current_version_id 제거**: 항상 최신 버전 사용
- ✅ **Document에 파일 정보 추가**: file_type, file_size, checksum (현재 버전만)
- ✅ **S3 경로 고정**: `centers/{center_id}/documents/{document_id}/{uuid}-{filename}`
- ✅ **버전 이력 조회**: S3 List Object Versions API 사용
- ✅ **S3 Versioning 활성화**: 버전별 경로 분리 불필요 (v1/, v2/ 제거)

---

## 엔티티 설계

### 1. Document (문서 메타데이터)

**책임**: 문서의 메타데이터 및 현재 상태 관리

```python
from sqlalchemy import Integer, String, Text, DateTime, BigInteger, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Document(Base):
    __tablename__ = "documents"

    # 식별자
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    center_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    uploader_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # 메타데이터
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # S3 저장 경로 (고정, 변경 안됨)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    # 예: "centers/123/documents/456/abc-uuid-consent_form.pdf"

    # 현재 버전 정보 (성능 최적화용)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)  # bytes
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # SHA-256

    # 접근 제어
    access_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="center"
    )  # "center", "public"

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_documents_center_deleted", "center_id", "deleted_at"),
        Index("ix_documents_checksum", "center_id", "checksum"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Integer | PK | 문서 고유 ID |
| `center_id` | Integer | NOT NULL, INDEX | 센터 ID (FK 없음) |
| `uploader_id` | Integer | NOT NULL, INDEX | 업로더 계정 ID (FK 없음) |
| `name` | String(255) | NOT NULL | 파일명 |
| `description` | Text | NULL | 문서 설명 |
| `storage_path` | String(512) | NOT NULL, UNIQUE | S3 키 (고정) |
| `file_type` | String(100) | NOT NULL | MIME type |
| `file_size` | BigInteger | NOT NULL | 파일 크기 (bytes) |
| `checksum` | String(64) | NOT NULL, INDEX | SHA-256 해시 |
| `access_level` | String(20) | NOT NULL | 접근 수준 |
| `deleted_at` | DateTime | NULL, INDEX | Soft Delete 시간 |
| `created_at` | DateTime | NOT NULL | 생성 시간 |
| `updated_at` | DateTime | NOT NULL | 수정 시간 |

---

### 2. DocumentAccess (접근 로그)

**책임**: 문서 접근 이력 추적 (감사 로그)

```python
class DocumentAccess(Base):
    __tablename__ = "document_accesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # S3 Version ID (선택적)
    s3_version_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    account_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    # "download", "delete", "restore", "share"

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    accessed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_document_accesses_document", "document_id", "accessed_at"),
        Index("ix_document_accesses_account", "account_id", "accessed_at"),
    )
```

---

### 3. ShareToken (외부 공유 토큰)

**책임**: 외부 공유 링크 관리 (선택적 기능)

```python
class ShareToken(Base):
    __tablename__ = "share_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    created_by: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Phase 2 기능
    max_downloads: Mapped[int | None] = mapped_column(Integer, nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
```

---

## 매핑 테이블 패턴

Document 도메인은 완전 독립적이며, 각 도메인이 자체 매핑 테이블을 소유합니다.

### ClientDocument (Client 모듈)

```python
# modules/client/document/models.py
class ClientDocument(Base):
    __tablename__ = "client_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "consent_form", "contract", "assessment_result", "counseling_note"

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_client_documents_client", "client_id", "created_at"),
        UniqueConstraint("client_id", "document_id"),
    )
```

### CounselingSessionDocument (Counseling 모듈)

```python
# modules/counseling/session/document/models.py
class CounselingSessionDocument(Base):
    __tablename__ = "counseling_session_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "session_note", "homework", "report"

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_counseling_session_documents_session", "session_id", "created_at"),
        UniqueConstraint("session_id", "document_id"),
    )
```

### AssessmentDocument (Assessment 모듈)

```python
# modules/assessment/document/models.py
class AssessmentDocument(Base):
    __tablename__ = "assessment_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assessment_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "test_sheet", "result_report", "interpretation"

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_assessment_documents_assessment", "assessment_id", "created_at"),
        UniqueConstraint("assessment_id", "document_id"),
    )
```

---

## S3 설계

### S3 경로 구조 (v3.0)

```
centers/{center_id}/documents/{document_id}/{uuid}-{filename}

예시:
centers/123/documents/456/7a3b2c1d-consent_form.pdf  (최초 업로드)
centers/123/documents/456/7a3b2c1d-consent_form.pdf  (업데이트 시 같은 경로에 PUT)
```

**특징**:
- ✅ 고정된 S3 키 (버전별 디렉토리 v1/, v2/ 제거)
- ✅ UUID로 파일명 충돌 방지
- ✅ S3 Versioning으로 이력 관리

### S3 Bucket 설정

```json
{
  "Versioning": {
    "Status": "Enabled"
  },
  "LifecycleConfiguration": {
    "Rules": [
      {
        "Id": "DeleteSoftDeletedDocuments",
        "Status": "Enabled",
        "Filter": {
          "Tag": {
            "Key": "deleted",
            "Value": "true"
          }
        },
        "Expiration": {
          "Days": 30
        }
      },
      {
        "Id": "DeleteOldVersionsAfter90Days",
        "Status": "Enabled",
        "NoncurrentVersionExpiration": {
          "NoncurrentDays": 90
        }
      },
      {
        "Id": "AbortIncompleteUploads",
        "Status": "Enabled",
        "AbortIncompleteMultipartUpload": {
          "DaysAfterInitiation": 7
        }
      }
    ]
  }
}
```

**Lifecycle 정책**:
- Soft Delete 후 30일 지난 객체 완전 삭제
- 이전 버전은 90일 후 자동 삭제
- 미완료 Multipart Upload 7일 후 정리

### S3 Versioning 동작 방식

```python
# 최초 업로드
PUT /centers/123/documents/456/uuid-file.pdf
→ S3 Version ID: v1-abc123 (최신)

# 업데이트 (같은 키에 PUT)
PUT /centers/123/documents/456/uuid-file.pdf
→ S3 Version ID: v2-def456 (최신)
→ S3 Version ID: v1-abc123 (이전 버전, 자동 유지)

# Soft Delete (Delete Marker 생성)
DELETE /centers/123/documents/456/uuid-file.pdf
→ Delete Marker 생성 (최신)
→ 모든 버전 유지됨 (숨김)

# 복구 (Delete Marker 제거)
DELETE /centers/123/documents/456/uuid-file.pdf?versionId=DeleteMarker
→ 최신 버전 복원
```

---

## 버전 이력 조회

### S3 API 활용

```python
async def list_document_versions_handler(document_id: int):
    document = await document_repo.get(document_id)

    # S3 List Object Versions API
    response = s3_client.list_object_versions(
        Bucket='imomtae-documents',
        Prefix=document.storage_path
    )

    versions = []
    for v in response.get('Versions', []):
        # 각 버전의 메타데이터 조회 (선택적)
        metadata = s3_client.head_object(
            Bucket='imomtae-documents',
            Key=document.storage_path,
            VersionId=v['VersionId']
        )

        versions.append({
            "version_id": v['VersionId'],
            "size": v['Size'],
            "last_modified": v['LastModified'],
            "is_latest": v.get('IsLatest', False),
            "etag": v['ETag'],
            "uploader": metadata['Metadata'].get('uploaded-by'),
            "change_note": metadata['Metadata'].get('change-note')
        })

    return {"versions": versions}
```

### S3 Object Metadata 저장

```python
# 업로드 시 메타데이터 포함
await s3_client.put_object(
    Bucket='imomtae-documents',
    Key=storage_path,
    Body=file_content,
    Metadata={
        'uploaded-by': str(account.id),
        'change-note': change_note or '',
        'original-filename': file.filename
    },
    ContentType=file.content_type
)
```

---

## 워크플로우

### 1. 문서 업로드

```python
async def upload_document_handler(
    file: UploadFile,
    description: str | None,
    account: Account,
    uow: UnitOfWork
):
    # 1. 파일 검증
    if file.size > 50 * 1024 * 1024:
        raise FileTooLargeError()

    # 2. 체크섬 계산
    checksum = calculate_sha256(file)

    async with uow:
        document_repo = uow.repo(DocumentRepository)

        # 3. Document 생성
        document = await document_repo.create({
            "center_id": account.center_id,
            "uploader_id": account.id,
            "name": file.filename,
            "description": description,
            "file_type": file.content_type,
            "file_size": file.size,
            "checksum": checksum,
            "access_level": "center"
        })

        # 4. S3 경로 생성 (document.id 확정 후)
        storage_path = f"centers/{account.center_id}/documents/{document.id}/{uuid.uuid4()}-{file.filename}"

        # 5. S3 업로드 (메타데이터 포함)
        await s3_client.put_object(
            Bucket='imomtae-documents',
            Key=storage_path,
            Body=file.file,
            Metadata={
                'uploaded-by': str(account.id),
                'original-filename': file.filename
            },
            ContentType=file.content_type
        )

        # 6. storage_path 업데이트
        document.storage_path = storage_path
        await document_repo.update(document)

        await uow.commit()

    return document
```

### 2. 문서 업데이트 (새 버전)

```python
async def update_document_handler(
    document_id: int,
    file: UploadFile,
    change_note: str | None,
    account: Account,
    uow: UnitOfWork
):
    document = await document_repo.get(document_id)

    # 권한 확인
    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 체크섬 계산
    checksum = calculate_sha256(file)

    # S3 업로드 (같은 키에 PUT → 자동으로 새 버전 생성)
    await s3_client.put_object(
        Bucket='imomtae-documents',
        Key=document.storage_path,  # 같은 경로!
        Body=file.file,
        Metadata={
            'uploaded-by': str(account.id),
            'change-note': change_note or '',
            'original-filename': file.filename
        },
        ContentType=file.content_type
    )

    # Document 정보 갱신
    async with uow:
        document.file_type = file.content_type
        document.file_size = file.size
        document.checksum = checksum
        document.name = file.filename
        await document_repo.update(document)
        await uow.commit()

    return document
```

### 3. 특정 버전 다운로드

```python
async def download_version_handler(
    document_id: int,
    version_id: str,  # S3 Version ID
    account: Account
):
    document = await document_repo.get(document_id)

    # 권한 확인
    if document.center_id != account.center_id:
        raise ForbiddenError()

    # S3 Pre-signed URL 생성 (특정 버전)
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': 'imomtae-documents',
            'Key': document.storage_path,
            'VersionId': version_id  # 버전 지정!
        },
        ExpiresIn=3600
    )

    # 접근 로그
    await document_access_repo.create({
        "document_id": document_id,
        "s3_version_id": version_id,
        "account_id": account.id,
        "action": "download",
        "accessed_at": datetime.utcnow()
    })

    return {"download_url": download_url, "expires_at": ...}
```

---

## 도메인 간 통합 패턴

### 2단계 조회 패턴 (JOIN 없음)

```python
# Client 모듈: 내담자의 문서 목록 조회
async def get_client_documents_handler(
    client_id: str,
    page: int = 1,
    size: int = 20
):
    # 1단계: 매핑 테이블에서 document_ids 조회
    client_docs = await client_doc_repo.find_by_client(client_id, page, size)
    document_ids = [cd.document_id for cd in client_docs.items]
    relation_map = {cd.document_id: cd.relation_type for cd in client_docs.items}

    # 2단계: Document Service 호출
    documents = await document_service.get_by_ids(document_ids)

    # 3단계: relation_type 추가
    for doc in documents:
        doc["relation_type"] = relation_map.get(doc["id"])

    return ListResponse(
        items=documents,
        total=client_docs.total,
        page=page,
        size=size
    )
```

---

## 비즈니스 규칙

### 파일 업로드 제약

| 항목 | 제약 | 근거 |
|------|------|------|
| 최대 파일 크기 | 50MB | 일반 문서/이미지 충분 |
| 허용 파일 타입 | PDF, DOCX, XLSX, PNG, JPG | 업무 문서만 |
| 파일명 길이 | 최대 255자 | OS 제약 |

**허용 MIME 타입**:
```python
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
}
```

### 접근 제어

| access_level | 대상 | 설명 |
|--------------|------|------|
| `center` | 센터 멤버 전체 | 같은 center_id 접근 가능 (기본값) |
| `public` | 외부 공유 가능 | 서명된 URL로 외부 접근 허용 |

### 삭제 처리

1. **Soft Delete**: `deleted_at` 설정
2. **S3 파일**: 30일 보관 (Lifecycle Policy)
3. **복구 기간**: 30일 이내
4. **영구 삭제**: 30일 후 S3가 자동 삭제

---

## 구현 순서

### Phase 1: 핵심 기능 (MVP)
- ✅ Document 테이블 (12 필드)
- ✅ S3 업로드/다운로드
- ✅ S3 Versioning 활성화
- ✅ 매핑 테이블 (ClientDocument 등)
- ✅ Soft Delete (30일)

### Phase 2: 고급 기능
- DocumentAccess 로그
- ShareToken (외부 공유)
- 중복 제거 (Deduplication)
- 저장소 용량 관리

### Phase 3: 최적화
- S3 Transfer Acceleration
- CloudFront CDN
- 이미지 자동 리사이징
- 전문 검색 (텍스트 추출)

---

## 스키마 비교

| 항목 | v1 (초기) | v2 (매핑 테이블) | v3 (S3 Native) |
|------|-----------|------------------|----------------|
| Document 필드 | 14개 | 10개 | **12개** |
| 테이블 수 | 4개 | 4개 | **3개** |
| 버전 관리 | DocumentVersion | DocumentVersion | **S3 Versioning** |
| S3 경로 | 불명확 | v1/, v2/, v3/ | **고정 경로** |
| 복잡도 | 높음 | 중간 | **낮음** |

---

## 결론

**v3.0 핵심 개선사항**:

1. **단순성**: DocumentVersion 제거로 테이블 1개 감소
2. **S3 Native**: AWS 네이티브 기능 활용, 이중 관리 제거
3. **유지보수성**: 버전 관리 로직이 S3로 이관
4. **확장성**: 매핑 테이블 패턴으로 도메인 독립성 유지

**트레이드오프**:
- ❌ 버전별 메타데이터는 S3 Object Metadata에 의존
- ❌ 버전 이력 조회 시 S3 API 호출 필요
- ✅ 대부분의 경우 최신 버전만 사용하므로 성능 문제 없음
- ✅ 감사 추적은 S3가 제공 (Last Modified, Version ID, ETag)

---

**작성일**: 2026-01-26
**버전**: 3.0 (S3 Native)
**변경 이력**:
- v1: Polymorphic Association
- v2: 매핑 테이블 패턴, 필드 간소화
- v3: DocumentVersion 제거, S3 Versioning 활용
