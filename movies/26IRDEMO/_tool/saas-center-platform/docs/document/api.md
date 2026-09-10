## API 설계

### 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| POST | /documents | 문서 업로드 (첫 버전 생성) |
| GET | /documents | 문서 목록 조회 (필터링) |
| GET | /documents/{id} | 문서 상세 조회 |
| PUT | /documents/{id} | 문서 메타데이터 수정 (버전 X) |
| DELETE | /documents/{id} | 문서 삭제 (Soft Delete) |
| POST | /documents/{id}/restore | 삭제된 문서 복구 (30일 이내) |
| POST | /documents/{id}/versions | 새 버전 업로드 |
| GET | /documents/{id}/versions | 버전 목록 조회 |
| GET | /documents/{id}/versions/{version_number}/download | 특정 버전 다운로드 URL 생성 |
| GET | /documents/{id}/download | 최신 버전 다운로드 URL 생성 |
| POST | /documents/{id}/share | 외부 공유 URL 생성 (만료 시간 포함) |
| GET | /documents/{id}/access-logs | 접근 로그 조회 |

### 1. 문서 업로드

```http
POST /documents
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

{
  "file": <binary>,
  "description": "동의서 원본",
  "access_level": "center"
}
```

**Response (201 Created)**:
```json
{
  "id": 1,
  "center_id": 10,
  "uploader_id": 5,
  "name": "consent_form.pdf",
  "description": "동의서 원본",
  "file_type": "application/pdf",
  "file_size": 2048576,
  "current_version_id": 1,
  "version_count": 1,
  "access_level": "center",
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**엔티티 연결**: 업로드 후 각 도메인에서 매핑 테이블 생성

```python
# Client 도메인에서 연결
from app.modules.client.document.repository import ClientDocumentRepository

async def attach_document_to_client(client_id: str, document_id: int):
    client_doc_repo = ClientDocumentRepository(session)
    await client_doc_repo.create({
        "client_id": client_id,
        "document_id": document_id,
        "relation_type": "consent_form"
    })
```

### 2. 문서 목록 조회 (필터링)

```http
GET /documents?uploader_id=5&file_type=application/pdf&page=1&size=20
Authorization: Bearer {jwt_token}
```

**Query Parameters**:
- `uploader_id`: 업로더 필터
- `file_type`: 파일 타입 필터 (예: "application/pdf")
- `page`, `size`: 페이지네이션

**Response (200 OK)**:
```json
{
  "items": [
    {
      "id": 1,
      "name": "consent_form.pdf",
      "file_type": "application/pdf",
      "file_size": 2048576,
      "version_count": 3,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

### 2-1. 엔티티별 문서 조회 (2단계 패턴)

**각 도메인에서 조회** - Client 예시:

```http
GET /clients/{client_id}/documents?page=1&size=20
Authorization: Bearer {jwt_token}
```

**내부 구현 (2단계 조회)**:
```python
# 1단계: 매핑 테이블에서 document_ids 조회
client_docs = await client_doc_repo.find_by_client(client_id)
document_ids = [cd.document_id for cd in client_docs]
relation_map = {cd.document_id: cd.relation_type for cd in client_docs}

# 2단계: Document Service 호출
documents = await document_service.get_by_ids(document_ids)

# 3단계: relation_type 추가
for doc in documents:
    doc["relation_type"] = relation_map.get(doc["id"])
```

**Response (200 OK)**:
```json
{
  "items": [
    {
      "id": 1,
      "name": "consent_form.pdf",
      "file_type": "application/pdf",
      "file_size": 2048576,
      "relation_type": "consent_form",
      "version_count": 3,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 3,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

### 3. 새 버전 업로드

```http
POST /documents/1/versions
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data

{
  "file": <binary>,
  "change_note": "서명 추가됨"
}
```

**Response (201 Created)**:
```json
{
  "id": 4,
  "document_id": 1,
  "version_number": 4,
  "file_name": "consent_form.pdf",
  "file_type": "application/pdf",
  "file_size": 2150000,
  "storage_path": "centers/10/documents/1/v4/consent_form_uuid.pdf",
  "checksum": "abc123...",
  "change_note": "서명 추가됨",
  "uploaded_by": 5,
  "created_at": "2024-01-16T14:30:00Z"
}
```

### 4. 다운로드 URL 생성

```http
GET /documents/1/download
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "download_url": "https://storage.example.com/signed-url?token=xyz&expires=1234567890",
  "expires_at": "2024-01-15T11:00:00Z",
  "file_name": "consent_form.pdf",
  "file_size": 2048576
}
```

**보안**: 서명된 URL은 1시간 유효, 다운로드 시 DocumentAccess 로그 생성

### 5. 외부 공유 URL 생성

```http
POST /documents/1/share
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "expires_in_hours": 24
}
```

**Response (200 OK)**:
```json
{
  "share_url": "https://app.example.com/shared/documents/xyz123",
  "expires_at": "2024-01-16T10:00:00Z"
}
```

**제약**: `access_level=public`인 문서만 공유 가능

### 6. 삭제된 문서 복구

```http
POST /documents/5/restore
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "id": 5,
  "center_id": 10,
  "uploader_id": 5,
  "name": "assessment_result.pdf",
  "file_type": "application/pdf",
  "file_size": 1500000,
  "current_version_id": 5,
  "version_count": 1,
  "access_level": "center",
  "deleted_at": null,
  "created_at": "2024-01-20T09:00:00Z",
  "updated_at": "2024-02-06T14:00:00Z"
