## API 설계

### 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| **템플릿 관리** |
| GET | /forms/templates | 템플릿 목록 조회 (시스템 + 센터) |
| GET | /forms/templates/{id} | 템플릿 상세 조회 |
| POST | /forms/templates | 센터 템플릿 생성 |
| PUT | /forms/templates/{id} | 템플릿 수정 (새 버전 row 생성) |
| DELETE | /forms/templates/{id} | 템플릿 비활성화 |
| POST | /forms/templates/{id}/clone | 시스템 템플릿 복제 |
| **양식 작성** |
| POST | /forms/instances | 양식 작성 시작 (draft 생성) |
| GET | /forms/instances | instance 목록 조회 |
| GET | /forms/instances/{id} | instance 상세 조회 (답변 포함) |
| POST | /forms/instances/{id}/submit | 제출 (draft → submitted) |
| POST | /forms/instances/{id}/revert | 재수정 (submitted → draft) |
| DELETE | /forms/instances/{id} | instance 삭제 (soft delete) |
| **답변 관리** |
| PUT | /forms/instances/{id}/answers | 답변 일괄 저장/수정 (draft만) |
| GET | /forms/instances/{id}/answers | instance의 전체 답변 조회 |
| **전자 서명** |
| POST | /forms/signatures | 서명 생성 |
| GET | /forms/signatures/{id} | 서명 조회 |
| **PDF Export** |
| POST | /forms/instances/{id}/export | PDF export 요청 |

---

### 1. 템플릿 목록 조회

```http
GET /forms/templates?include_system=true
Authorization: Bearer {jwt_token}
```

**Query Parameters**:
- `include_system`: 시스템 템플릿 포함 여부 (default: true)

**Response (200 OK)**:
```json
{
  "items": [
    {
      "id": "uuid-system-1",
      "center_id": null,
      "name": "개인정보 동의서 (기본)",
      "version": 1,
      "is_active": true,
      "is_system_template": true,
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid-center-1",
      "center_id": "uuid-center-123",
      "name": "개인정보 동의서 (우리 센터)",
      "version": 2,
      "is_active": true,
      "is_system_template": false,
      "created_at": "2024-06-01T00:00:00Z"
    }
  ],
  "total": 2
}
```

### 2. 템플릿 상세 조회

```http
GET /forms/templates/{id}
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "id": "uuid-system-1",
  "center_id": null,
  "name": "개인정보 동의서 (기본)",
  "version": 1,
  "is_active": true,
  "schema": {
    "fields": {
      "name": {
        "type": "text",
        "label": "이름",
        "required": true,
        "order": 1
      },
      "birth": {
        "type": "date",
        "label": "생년월일",
        "required": true,
        "order": 2
      },
      "consent": {
        "type": "checkbox",
        "label": "개인정보 수집 및 이용에 동의합니다",
        "required": true,
        "order": 3
      },
      "signature": {
        "type": "signature",
        "label": "본인 서명",
        "required": true,
        "order": 4
      }
    },
    "layout": {
      "sections": [
        { "title": "기본 정보", "fields": ["name", "birth"] },
        { "title": "동의", "fields": ["consent", "signature"] }
      ]
    }
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 3. 센터 템플릿 생성 (독자적)

센터가 시스템 템플릿 복제 없이 처음부터 새 템플릿 생성.

```http
POST /forms/templates
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "상담 만족도 설문",
  "schema": {
    "fields": {
      "satisfaction": {
        "type": "radio",
        "label": "상담에 만족하셨나요?",
        "required": true,
        "options": [
          { "value": "very_satisfied", "label": "매우 만족" },
          { "value": "satisfied", "label": "만족" },
          { "value": "neutral", "label": "보통" },
          { "value": "dissatisfied", "label": "불만족" }
        ],
        "order": 1
      },
      "feedback": {
        "type": "textarea",
        "label": "추가 의견",
        "required": false,
        "order": 2
      }
    },
    "layout": {
      "sections": [
        { "title": "만족도", "fields": ["satisfaction", "feedback"] }
      ]
    }
  }
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid-center-new",
  "center_id": "uuid-center-123",
  "name": "상담 만족도 설문",
  "version": 1,
  "is_active": true,
  "schema": { "..." },
  "created_at": "2024-07-01T10:00:00Z"
}
```

### 4. 시스템 템플릿 복제

센터가 시스템 템플릿을 복제하여 자체 템플릿으로 사용.

```http
POST /forms/templates/{id}/clone
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "개인정보 동의서 (우리 센터)",
  "schema": {
    "fields": {
      "name": { "type": "text", "label": "성함", "required": true, "order": 1 },
      "birth": { "type": "date", "label": "생년월일", "required": true, "order": 2 },
      "phone": { "type": "phone", "label": "연락처", "required": true, "order": 3 },
      "consent": { "type": "checkbox", "label": "동의합니다", "required": true, "order": 4 },
      "signature": { "type": "signature", "label": "본인 서명", "required": true, "order": 5 }
    },
    "layout": {
      "sections": [
        { "title": "기본 정보", "fields": ["name", "birth", "phone"] },
        { "title": "동의", "fields": ["consent", "signature"] }
      ]
    }
  }
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid-center-1",
  "center_id": "uuid-center-123",
  "name": "개인정보 동의서 (우리 센터)",
  "version": 1,
  "is_active": true,
  "schema": { "..." },
  "created_at": "2024-06-01T10:00:00Z"
}
```

### 5. 템플릿 수정 (새 버전 생성)

센터 템플릿 수정 시 기존 row를 비활성화하고 새 version row 생성 (immutable).

```http
PUT /forms/templates/{id}
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "schema": {
    "fields": {
      "name": { "type": "text", "label": "성함", "required": true, "order": 1 },
      "birth": { "type": "date", "label": "생년월일", "required": true, "order": 2 },
      "phone": { "type": "phone", "label": "연락처", "required": true, "order": 3 },
      "address": { "type": "textarea", "label": "주소", "required": false, "order": 4 },
      "consent": { "type": "checkbox", "label": "동의합니다", "required": true, "order": 5 },
      "signature": { "type": "signature", "label": "본인 서명", "required": true, "order": 6 }
    }
  }
}
```

**내부 처리**:
1. 기존 template row → `is_active = FALSE`
2. 새 row 생성 (같은 `center_id`, `name`, `version + 1`, `is_active = TRUE`)

**Response (200 OK)**:
```json
{
  "id": "uuid-center-1-v2",
  "center_id": "uuid-center-123",
  "name": "개인정보 동의서 (우리 센터)",
  "version": 2,
  "is_active": true,
  "schema": { "..." },
  "created_at": "2024-07-01T10:00:00Z"
}
```

**주의**: 기존 instance의 `template_id`는 이전 version row UUID를 참조하므로 영향 없음.

### 6. 양식 작성 시작 (draft 생성)

```http
POST /forms/instances
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "template_id": "uuid-center-1"
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid-instance-100",
  "center_id": "uuid-center-123",
  "template_id": "uuid-center-1",
  "status": "draft",
  "submitted_at": null,
  "created_at": "2024-06-15T14:00:00Z"
}
```

**엔티티 연결**: 생성 후 각 도메인에서 매핑 테이블 생성

```python
# Client 도메인에서 연결
await client_form_repo.create({
    "client_id": client_id,
    "instance_id": instance_id,
    "relation_type": "application"
})
```

### 7. 답변 일괄 저장/수정

draft 상태에서만 답변 추가/수정 가능. 전달된 답변을 UPSERT.

```http
PUT /forms/instances/{id}/answers
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "answers": {
    "name": { "value": "김철수" },
    "birth": { "value": "1990-01-01" },
    "phone": { "value": "010-1234-5678" }
  }
}
```

**내부 처리**:
```sql
-- question_id별 UPSERT
INSERT INTO form_answers (id, center_id, instance_id, question_id, answer, created_at, updated_at)
VALUES ($1, $2, $3, 'name', '{"value": "김철수"}', NOW(), NOW())
ON CONFLICT (instance_id, question_id)
DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW();
```

**Response (200 OK)**:
```json
{
  "instance_id": "uuid-instance-100",
  "saved_count": 3,
  "answers": {
    "name": { "value": "김철수" },
    "birth": { "value": "1990-01-01" },
    "phone": { "value": "010-1234-5678" }
  }
}
```

### 8. 전자 서명 생성

```http
POST /forms/signatures
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "instance_id": "uuid-instance-100",
  "field_id": "signature",
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid-signature-1",
  "instance_id": "uuid-instance-100",
  "field_id": "signature",
  "storage_type": "base64",
  "signer_name": "김철수",
  "signed_at": "2024-06-15T14:10:00Z"
}
```

### 9. 양식 제출

필수 필드 검증 후 draft → submitted.

```http
POST /forms/instances/{id}/submit
Authorization: Bearer {jwt_token}
```

**검증 로직**:
1. status = 'draft' 확인
2. 템플릿의 required 필드에 대한 답변 존재 확인
3. signature 필드에 대한 서명 데이터 존재 확인

**Response (200 OK)**:
```json
{
  "id": "uuid-instance-100",
  "status": "submitted",
  "submitted_at": "2024-06-15T14:15:00Z"
}
```

### 10. 재수정 (submitted → draft)

```http
POST /forms/instances/{id}/revert
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "id": "uuid-instance-100",
  "status": "draft",
  "submitted_at": null
}
```

### 11. PDF Export 요청

submitted 상태에서만 가능. Document 도메인에 PDF 저장 후 매핑 테이블로 연결.

```http
POST /forms/instances/{id}/export
POST /forms/instances/{id}/export?force=true  # 강제 재생성
Authorization: Bearer {jwt_token}
```

**Query Parameters**:
- `force`: 기존 PDF 무시하고 재생성 (default: false). 재생성 시 기존 매핑 삭제 후 새 매핑 (1:1 유지).

**Response (200 OK)**:
```json
{
  "instance_id": "uuid-instance-100",
  "document_id": "uuid-document-500",
  "download_url": "/documents/uuid-document-500/download",
  "exported_at": "2024-06-15T14:20:00Z"
}
```

### 12. 엔티티별 양식 조회 (2단계 패턴)

각 도메인에서 매핑 테이블을 통해 조회.

```http
GET /clients/{client_id}/forms?page=1&size=20
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "items": [
    {
      "id": "uuid-instance-100",
      "template_id": "uuid-center-1",
      "template_name": "개인정보 동의서",
      "relation_type": "application",
      "status": "submitted",
      "submitted_at": "2024-06-15T14:15:00Z",
      "created_at": "2024-06-15T14:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20,
  "pages": 1
}
```
