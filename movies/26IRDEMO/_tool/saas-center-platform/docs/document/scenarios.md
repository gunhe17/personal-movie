# Document 도메인 시나리오 (v3.0)

> **v3.0 변경**: DocumentVersion 테이블 제거, S3 Versioning으로 버전 관리 통일

---

## 시나리오 1: 문서 최초 업로드

### 상황
상담사가 내담자의 동의서 PDF 파일을 업로드.

### HTTP Request
```http
POST /documents
Authorization: Bearer eyJhbGc...
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="consent_form.pdf"
Content-Type: application/pdf

<binary data>
--boundary
Content-Disposition: form-data; name="description"

김철수 내담자 동의서 원본
--boundary--
```

### Handler Logic
```python
async def upload_document_handler(
    file: UploadFile,
    description: str | None,
    account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow)
):
    # 1. 파일 검증
    if file.size > 50 * 1024 * 1024:  # 50MB
        raise FileTooLargeError()

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise InvalidFileTypeError()

    # 2. 저장소 용량 체크
    current_usage = await get_center_storage_usage(account.center_id)
    quota_limit = await get_storage_quota(account.center_id)
    if current_usage + file.size > quota_limit:
        raise StorageQuotaExceededError()

    # 3. 체크섬 계산
    checksum = await calculate_sha256(file)

    async with uow:
        document_repo = uow.repo(DocumentRepository)

        # 4. Document 생성
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

        # 5. S3 경로 생성 (document.id 확정 후)
        storage_path = f"centers/{account.center_id}/documents/{document.id}/{uuid.uuid4()}-{file.filename}"

        # 6. S3 업로드 (메타데이터 포함)
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

        # 7. storage_path 업데이트
        document.storage_path = storage_path
        await document_repo.update(document)

        await uow.commit()

    return DocumentResponse.model_validate(document)
```

### DB Changes
```sql
-- 1. Document 생성
INSERT INTO documents (
    center_id, uploader_id, name, description,
    file_type, file_size, checksum, access_level,
    created_at, updated_at
) VALUES (
    10, 5, 'consent_form.pdf', '김철수 내담자 동의서 원본',
    'application/pdf', 2048576,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'center',
    '2024-01-15 10:00:00', '2024-01-15 10:00:00'
);
-- RETURNING id = 1

-- 2. storage_path 업데이트
UPDATE documents
SET storage_path = 'centers/10/documents/1/abc-uuid-consent_form.pdf',
    updated_at = '2024-01-15 10:00:00'
WHERE id = 1;
```

### S3 Changes
```
S3 PUT:
Key: centers/10/documents/1/abc-uuid-consent_form.pdf
Version ID: v1-abc123 (S3가 자동 생성)
Metadata:
  uploaded-by: 5
  original-filename: consent_form.pdf
```

### HTTP Response
```json
{
  "id": 1,
  "center_id": 10,
  "uploader_id": 5,
  "name": "consent_form.pdf",
  "description": "김철수 내담자 동의서 원본",
  "storage_path": "centers/10/documents/1/abc-uuid-consent_form.pdf",
  "file_type": "application/pdf",
  "file_size": 2048576,
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "access_level": "center",
  "deleted_at": null,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### Final State
- S3: `centers/10/documents/1/abc-uuid-consent_form.pdf` (Version ID: v1-abc123)
- DB: documents 1건
- 센터 10의 저장소 사용량: +2048576 bytes

---

## 시나리오 2: 새 버전 업로드 (S3 Versioning)

### 상황
동의서에 서명이 추가되어 수정된 파일을 새 버전으로 업로드.

### HTTP Request
```http
PUT /documents/1
Authorization: Bearer eyJhbGc...
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="consent_form_signed.pdf"
Content-Type: application/pdf

<binary data>
--boundary
Content-Disposition: form-data; name="change_note"

서명 추가됨
--boundary--
```

### Handler Logic
```python
async def update_document_handler(
    document_id: int,
    file: UploadFile,
    change_note: str | None,
    account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow)
):
    # 1. 문서 조회 및 권한 확인
    document_repo = uow.repo(DocumentRepository)
    document = await document_repo.get(document_id)

    if not document or document.deleted_at:
        raise NotFoundError()

    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 2. 파일 검증
    if file.size > 50 * 1024 * 1024:
        raise FileTooLargeError()

    # 3. 저장소 용량 체크
    current_usage = await get_center_storage_usage(account.center_id)
    quota_limit = await get_storage_quota(account.center_id)
    if current_usage + file.size > quota_limit:
        raise StorageQuotaExceededError()

    # 4. 체크섬 계산
    checksum = await calculate_sha256(file)

    # 5. S3 업로드 (같은 키에 PUT → 자동으로 새 버전 생성)
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

    # 6. Document 정보 갱신 (현재 버전만)
    async with uow:
        document.file_type = file.content_type
        document.file_size = file.size
        document.checksum = checksum
        document.name = file.filename
        await document_repo.update(document)

        await uow.commit()

    return DocumentResponse.model_validate(document)
```

### DB Changes
```sql
-- Document 업데이트 (현재 버전 정보만)
UPDATE documents
SET
    file_type = 'application/pdf',
    file_size = 2150000,
    checksum = 'f1d2d2f924e986ac86fdf7b36c94bcdf32beec15',
    name = 'consent_form_signed.pdf',
    updated_at = '2024-01-16 14:30:00'
WHERE id = 1;
```

### S3 Changes
```
S3 PUT (같은 Key):
Key: centers/10/documents/1/abc-uuid-consent_form.pdf
Version ID: v2-def456 (S3가 자동 생성, 최신)
Metadata:
  uploaded-by: 5
  change-note: 서명 추가됨
  original-filename: consent_form_signed.pdf

S3 자동 유지:
Version ID: v1-abc123 (이전 버전, 자동 보관)
```

### HTTP Response
```json
{
  "id": 1,
  "center_id": 10,
  "uploader_id": 5,
  "name": "consent_form_signed.pdf",
  "description": "김철수 내담자 동의서 원본",
  "storage_path": "centers/10/documents/1/abc-uuid-consent_form.pdf",
  "file_type": "application/pdf",
  "file_size": 2150000,
  "checksum": "f1d2d2f924e986ac86fdf7b36c94bcdf32beec15",
  "access_level": "center",
  "deleted_at": null,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-16T14:30:00Z"
}
```

### Final State
- S3: 같은 경로에 2개 버전 (v1-abc123, v2-def456)
- DB: documents 정보만 갱신
- 센터 10의 저장소 사용량: +2150000 bytes

---

## 시나리오 3: 버전 이력 조회 (S3 API)

### 상황
문서의 모든 버전 이력 조회.

### HTTP Request
```http
GET /documents/1/versions
Authorization: Bearer eyJhbGc...
```

### Handler Logic
```python
async def list_document_versions_handler(
    document_id: int,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_session)
):
    # 1. 문서 조회 및 권한 확인
    document_repo = DocumentRepository(session)
    document = await document_repo.get(document_id)

    if not document or document.deleted_at:
        raise NotFoundError()

    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 2. S3 List Object Versions API
    response = s3_client.list_object_versions(
        Bucket='imomtae-documents',
        Prefix=document.storage_path
    )

    # 3. 버전 목록 생성
    versions = []
    for v in response.get('Versions', []):
        # 각 버전의 메타데이터 조회
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
            "change_note": metadata['Metadata'].get('change-note', '')
        })

    return {"versions": versions}
```

### S3 API Call
```
S3 ListObjectVersions:
Bucket: imomtae-documents
Prefix: centers/10/documents/1/abc-uuid-consent_form.pdf

Response:
[
  {
    "VersionId": "v2-def456",
    "LastModified": "2024-01-16T14:30:00Z",
    "Size": 2150000,
    "IsLatest": true,
    "ETag": "f1d2d2f924e986ac86fdf7b36c94bcdf32beec15"
  },
  {
    "VersionId": "v1-abc123",
    "LastModified": "2024-01-15T10:00:00Z",
    "Size": 2048576,
    "IsLatest": false,
    "ETag": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
]
```

### HTTP Response
```json
{
  "versions": [
    {
      "version_id": "v2-def456",
      "size": 2150000,
      "last_modified": "2024-01-16T14:30:00Z",
      "is_latest": true,
      "etag": "f1d2d2f924e986ac86fdf7b36c94bcdf32beec15",
      "uploader": "5",
      "change_note": "서명 추가됨"
    },
    {
      "version_id": "v1-abc123",
      "size": 2048576,
      "last_modified": "2024-01-15T10:00:00Z",
      "is_latest": false,
      "etag": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "uploader": "5",
      "change_note": ""
    }
  ]
}
```

---

## 시나리오 4: 특정 버전 다운로드

### 상황
상담사가 이전 버전(v1)을 다운로드.

### HTTP Request
```http
GET /documents/1/versions/v1-abc123/download
Authorization: Bearer eyJhbGc...
```

### Handler Logic
```python
async def download_version_handler(
    document_id: int,
    version_id: str,  # S3 Version ID
    account: Account = Depends(get_current_account),
    request: Request,
    uow: UnitOfWork = Depends(get_uow)
):
    # 1. 문서 조회 및 권한 확인
    document_repo = uow.repo(DocumentRepository)
    document = await document_repo.get(document_id)

    if not document or document.deleted_at:
        raise NotFoundError()

    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 2. S3 Pre-signed URL 생성 (특정 버전)
    download_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': 'imomtae-documents',
            'Key': document.storage_path,
            'VersionId': version_id  # 버전 지정!
        },
        ExpiresIn=3600
    )

    # 3. 접근 로그 생성
    async with uow:
        access_repo = uow.repo(DocumentAccessRepository)
        await access_repo.create({
            "document_id": document_id,
            "s3_version_id": version_id,
            "account_id": account.id,
            "action": "download",
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "accessed_at": datetime.utcnow()
        })
        await uow.commit()

    return {
        "download_url": download_url,
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "version_id": version_id
    }
```

### DB Changes
```sql
-- DocumentAccess 로그 생성
INSERT INTO document_accesses (
    document_id, s3_version_id, account_id, action,
    ip_address, user_agent, accessed_at
) VALUES (
    1, 'v1-abc123', 5, 'download',
    '192.168.1.10', 'Mozilla/5.0 ...',
    '2024-01-21 15:00:00'
);
```

### HTTP Response
```json
{
  "download_url": "https://imomtae-documents.s3.amazonaws.com/centers/10/documents/1/abc-uuid-consent_form.pdf?versionId=v1-abc123&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=...",
  "expires_at": "2024-01-21T16:00:00Z",
  "version_id": "v1-abc123"
}
```

---

## 시나리오 5: Client에 문서 연결 (매핑 테이블)

### 상황
업로드된 문서를 내담자(Client)에 연결.

### HTTP Request
```http
POST /clients/{client_id}/documents
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "document_id": 1,
  "relation_type": "consent_form"
}
```

### Handler Logic
```python
# Client 모듈 Handler
async def attach_document_to_client_handler(
    client_id: str,
    document_id: int,
    relation_type: str,
    account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow)
):
    # 1. Client 존재 확인
    client_repo = uow.repo(ClientRepository)
    client = await client_repo.get(client_id)
    if not client:
        raise NotFoundError("Client not found")

    # 2. Document 존재 및 권한 확인
    document_repo = uow.repo(DocumentRepository)
    document = await document_repo.get(document_id)
    if not document or document.deleted_at:
        raise NotFoundError("Document not found")

    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 3. 매핑 테이블에 연결 추가
    async with uow:
        client_doc_repo = uow.repo(ClientDocumentRepository)
        client_doc = await client_doc_repo.create({
            "client_id": client_id,
            "document_id": document_id,
            "relation_type": relation_type
        })
        await uow.commit()

    return {"message": "Document attached to client successfully"}
```

### DB Changes
```sql
-- ClientDocument 매핑 테이블에 연결 추가
INSERT INTO client_documents (
    client_id, document_id, relation_type, created_at
) VALUES (
    'uuid-client-123', 1, 'consent_form', '2024-01-15 10:05:00'
);
```

### HTTP Response
```json
{
  "message": "Document attached to client successfully"
}
```

---

## 시나리오 6: Client 문서 목록 조회 (2단계 조회)

### 상황
내담자의 모든 문서 조회.

### HTTP Request
```http
GET /clients/{client_id}/documents?page=1&size=20
Authorization: Bearer eyJhbGc...
```

### Handler Logic
```python
# Client 모듈 Handler
async def get_client_documents_handler(
    client_id: str,
    page: int = 1,
    size: int = 20,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_session)
):
    # 1단계: ClientDocument 매핑 테이블에서 document_ids 조회
    client_doc_repo = ClientDocumentRepository(session)
    client_docs = await client_doc_repo.find_by_client(client_id, page, size)

    document_ids = [cd.document_id for cd in client_docs.items]
    relation_map = {cd.document_id: cd.relation_type for cd in client_docs.items}

    # 2단계: Document Service 호출 (JOIN 없음)
    document_service = GetDocumentsService(session)
    documents = await document_service.get_by_ids(document_ids)

    # 3단계: relation_type 추가
    for doc in documents:
        doc["relation_type"] = relation_map.get(doc["id"])

    return ListResponse(
        items=documents,
        total=client_docs.total,
        page=page,
        size=size,
        pages=client_docs.pages
    )
```

### DB Queries
```sql
-- 1단계: 매핑 테이블 조회
SELECT id, client_id, document_id, relation_type, created_at
FROM client_documents
WHERE client_id = 'uuid-client-123'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
-- Result: document_ids = [1, 5, 8]

-- 2단계: Document 조회 (IN 쿼리, JOIN 없음)
SELECT *
FROM documents
WHERE id IN (1, 5, 8)
  AND deleted_at IS NULL;
```

### HTTP Response
```json
{
  "items": [
    {
      "id": 1,
      "name": "consent_form_signed.pdf",
      "file_type": "application/pdf",
      "file_size": 2150000,
      "relation_type": "consent_form",
      "created_at": "2024-01-15T10:00:00Z"
    },
    {
      "id": 5,
      "name": "assessment_result.pdf",
      "file_type": "application/pdf",
      "file_size": 1500000,
      "relation_type": "assessment_result",
      "created_at": "2024-01-20T09:00:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

---

## 시나리오 7: 문서 삭제 (Soft Delete + S3 Tag)

### 상황
상담사가 잘못 업로드한 문서를 삭제.

### HTTP Request
```http
DELETE /documents/5
Authorization: Bearer eyJhbGc...
```

### Handler Logic
```python
async def delete_document_handler(
    document_id: int,
    account: Account = Depends(get_current_account),
    request: Request,
    uow: UnitOfWork = Depends(get_uow)
):
    # 1. 문서 조회 및 권한 확인
    document_repo = uow.repo(DocumentRepository)
    document = await document_repo.get(document_id)

    if not document or document.deleted_at:
        raise NotFoundError()

    if document.center_id != account.center_id:
        raise ForbiddenError()

    # 2. S3 객체에 삭제 태그 추가 (Lifecycle Policy 트리거)
    await s3_client.put_object_tagging(
        Bucket='imomtae-documents',
        Key=document.storage_path,
        Tagging={'TagSet': [{'Key': 'deleted', 'Value': 'true'}]}
    )

    # 3. Soft Delete
    async with uow:
        document.deleted_at = datetime.utcnow()
        await document_repo.update(document)

        # 4. 접근 로그 생성
        access_repo = uow.repo(DocumentAccessRepository)
        await access_repo.create({
            "document_id": document_id,
            "account_id": account.id,
            "action": "delete",
            "ip_address": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "accessed_at": datetime.utcnow()
        })

        await uow.commit()

    return {"message": "Document deleted successfully"}
```

### DB Changes
```sql
-- Document Soft Delete
UPDATE documents
SET deleted_at = '2024-01-22 10:00:00', updated_at = '2024-01-22 10:00:00'
WHERE id = 5;

-- DocumentAccess 로그
INSERT INTO document_accesses (
    document_id, account_id, action,
    ip_address, user_agent, accessed_at
) VALUES (
    5, 5, 'delete',
    '192.168.1.10', 'Mozilla/5.0 ...',
    '2024-01-22 10:00:00'
);
```

### S3 Changes
```
S3 PutObjectTagging:
Key: centers/10/documents/5/xyz-uuid-file.pdf
Tag: deleted=true

→ S3 Lifecycle Policy가 30일 후 자동 삭제
```

### HTTP Response
```json
{
  "message": "Document deleted successfully"
}
```

---

## 요약

| 시나리오 | HTTP 메서드 | 엔드포인트 | 주요 로직 |
|----------|-------------|------------|----------|
| 1. 문서 최초 업로드 | POST | /documents | Document 생성, S3 업로드 |
| 2. 새 버전 업로드 | PUT | /documents/{id} | S3 Versioning (같은 키에 PUT) |
| 3. 버전 이력 조회 | GET | /documents/{id}/versions | S3 List Object Versions API |
| 4. 특정 버전 다운로드 | GET | /documents/{id}/versions/{version_id}/download | S3 Pre-signed URL (Version ID 포함) |
| 5. Client에 연결 | POST | /clients/{client_id}/documents | ClientDocument 매핑 테이블 추가 |
| 6. Client 문서 조회 | GET | /clients/{client_id}/documents | 2단계 조회 (매핑 → Document) |
| 7. 문서 삭제 | DELETE | /documents/{id} | Soft Delete + S3 Tag |
