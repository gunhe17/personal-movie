# Form 도메인 시나리오

## 시나리오 1: 시스템 템플릿 조회

### 상황
센터 관리자가 사용 가능한 양식 템플릿 목록을 조회 (시스템 템플릿 + 센터 템플릿 모두 표시).

### HTTP Request
```http
GET /forms/templates?include_system=true
Authorization: Bearer eyJhbGc...
```

### 처리 흐름
```python
async def list_templates_handler(
    include_system: bool = True,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormTemplateFacade(uow)
        result = await facade.list_templates_with_response(
            center_id=center_id,
            include_system=include_system,
        )
    return result
```

### DB Query
```sql
-- 센터 템플릿 조회
SELECT * FROM form_templates
WHERE center_id = 'uuid-center-123' AND is_active = TRUE;

-- 시스템 템플릿 조회 (include_system=true)
SELECT * FROM form_templates
WHERE center_id IS NULL AND is_active = TRUE;
```

### HTTP Response
```json
{
  "items": [
    {
      "id": "uuid-center-1",
      "center_id": "uuid-center-123",
      "name": "개인정보 동의서 (우리 센터)",
      "version": 2,
      "is_active": true,
      "is_system_template": false
    },
    {
      "id": "uuid-system-1",
      "center_id": null,
      "name": "개인정보 동의서 (기본)",
      "version": 1,
      "is_active": true,
      "is_system_template": true
    }
  ],
  "total": 2
}
```

### Final State
- 변경 없음 (조회만)
- 시스템 템플릿과 센터 템플릿 모두 표시 (숨기지 않음)

---

## 시나리오 2: 시스템 템플릿 복제 (센터 커스터마이징)

### 상황
센터가 시스템 제공 "개인정보 동의서"를 복제하여 전화번호 필드를 추가한 커스텀 템플릿 생성.

### HTTP Request
```http
POST /forms/templates/uuid-system-1/clone
Authorization: Bearer eyJhbGc...
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

### 처리 흐름
```python
async def clone_template_handler(
    template_id: str,
    data: TemplateCloneRequest,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormTemplateFacade(uow)
        result = await facade.clone_template_with_response(
            source_template_id=template_id,
            center_id=center_id,
            name=data.name,
            schema=data.schema,
        )
        await uow.commit()
    return result
```

### DB Changes
```sql
-- 1. 원본 시스템 템플릿 조회
SELECT * FROM form_templates WHERE id = 'uuid-system-1' AND center_id IS NULL;

-- 2. 새 센터 템플릿 생성 (version=1)
INSERT INTO form_templates (id, center_id, name, version, schema, is_active, created_at)
VALUES (
    'uuid-center-1',
    'uuid-center-123',
    '개인정보 동의서 (우리 센터)',
    1,
    '{"fields": {...}, "layout": {...}}'::jsonb,
    TRUE,
    NOW()
);
```

### Final State
- DB: form_templates 1건 추가 (센터 커스텀 템플릿, version=1)
- 시스템 템플릿은 그대로 유지 (숨기지 않음)

---

## 시나리오 3: 센터 독자 템플릿 생성

### 상황
센터가 시스템 템플릿에 없는 "상담 만족도 설문"을 처음부터 직접 생성.

### HTTP Request
```http
POST /forms/templates
Authorization: Bearer eyJhbGc...
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

### 처리 흐름
```python
async def create_template_handler(
    data: TemplateCreateRequest,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormTemplateFacade(uow)
        result = await facade.create_template_with_response(
            center_id=center_id,
            name=data.name,
            schema=data.schema,
        )
        await uow.commit()
    return result
```

### DB Changes
```sql
INSERT INTO form_templates (id, center_id, name, version, schema, is_active, created_at)
VALUES (
    'uuid-center-new',
    'uuid-center-123',
    '상담 만족도 설문',
    1,
    '{"fields": {...}, "layout": {...}}'::jsonb,
    TRUE,
    NOW()
);
```

### Final State
- DB: form_templates 1건 추가 (센터 독자 템플릿, version=1)
- 시스템 템플릿 기반이 아닌 완전히 새로운 템플릿

---

## 시나리오 4: 양식 작성 시작 (Draft 생성)

### 상황
상담사가 신규 내담자에게 개인정보 동의서 작성을 시작.

### HTTP Request
```http
POST /forms/instances
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "template_id": "uuid-center-1"
}
```

### 처리 흐름
```python
async def create_instance_handler(
    data: InstanceCreateRequest,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormInstanceFacade(uow)
        result = await facade.create_instance_with_response(
            center_id=center_id,
            template_id=data.template_id,
        )
        await uow.commit()
    return result
```

### DB Changes
```sql
-- 1. 템플릿 조회 (활성 확인)
SELECT * FROM form_templates WHERE id = 'uuid-center-1' AND is_active = TRUE;

-- 2. Instance 생성 (draft)
INSERT INTO form_instances (id, center_id, template_id, status, created_at)
VALUES ('uuid-instance-100', 'uuid-center-123', 'uuid-center-1', 'draft', NOW());
```

### Final State
- DB: form_instances 1건 추가 (draft 상태)
- form_answers: 0건 (아직 답변 없음)

---

## 시나리오 5: 답변 저장 (임시 저장)

### 상황
사용자가 양식을 작성하면서 중간 저장.

### HTTP Request
```http
PUT /forms/instances/uuid-instance-100/answers
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "answers": {
    "name": { "value": "김철수" },
    "birth": { "value": "1990-01-01" },
    "phone": { "value": "010-1234-5678" }
  }
}
```

### 처리 흐름
```python
async def save_answers_handler(
    instance_id: str,
    data: AnswersSaveRequest,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormAnswerFacade(uow)
        result = await facade.save_answers_with_response(
            instance_id=instance_id,
            center_id=center_id,
            answers=data.answers,
        )
        await uow.commit()
    return result
```

### DB Changes
```sql
-- question_id별 UPSERT (3건)
INSERT INTO form_answers (id, center_id, instance_id, question_id, answer, created_at, updated_at)
VALUES (gen_random_uuid(), 'uuid-center-123', 'uuid-instance-100', 'name', '{"value": "김철수"}', NOW(), NOW())
ON CONFLICT (instance_id, question_id)
DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW();

INSERT INTO form_answers (id, center_id, instance_id, question_id, answer, created_at, updated_at)
VALUES (gen_random_uuid(), 'uuid-center-123', 'uuid-instance-100', 'birth', '{"value": "1990-01-01"}', NOW(), NOW())
ON CONFLICT (instance_id, question_id)
DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW();

INSERT INTO form_answers (id, center_id, instance_id, question_id, answer, created_at, updated_at)
VALUES (gen_random_uuid(), 'uuid-center-123', 'uuid-instance-100', 'phone', '{"value": "010-1234-5678"}', NOW(), NOW())
ON CONFLICT (instance_id, question_id)
DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW();
```

### Final State
- DB: form_answers 3건 추가/수정
- instance 여전히 draft 상태

---

## 시나리오 6: 전자 서명 생성

### 상황
사용자가 양식에 전자 서명 추가.

### HTTP Request
```http
POST /forms/signatures
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "instance_id": "uuid-instance-100",
  "field_id": "signature",
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..."
}
```

### 처리 흐름
```python
async def create_signature_handler(
    data: SignatureCreateRequest,
    center_id: str = Depends(get_verified_center_id),
    request: Request,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormSignatureFacade(uow)
        result = await facade.create_signature_with_response(
            instance_id=data.instance_id,
            center_id=center_id,
            field_id=data.field_id,
            signature_data=data.signature_data,
            signer_name=get_signer_name(request),
            signer_ip=request.client.host,
        )
        await uow.commit()
    return result
```

### DB Changes
```sql
-- 크기 확인 후 저장 방식 결정 (<100KB → base64)
INSERT INTO form_signatures (
    id, center_id, instance_id, field_id, storage_type,
    signature_data, signer_name, signer_ip, signed_at, created_at
) VALUES (
    'uuid-signature-1', 'uuid-center-123', 'uuid-instance-100', 'signature', 'base64',
    'data:image/png;base64,iVBORw0KGgo...', '김철수', '192.168.1.10',
    NOW(), NOW()
);
```

### Final State
- DB: form_signatures 1건 추가 (불변)

---

## 시나리오 7: 양식 제출

### 상황
사용자가 모든 필드를 작성하고 양식 제출 (draft → submitted).

### HTTP Request
```http
POST /forms/instances/uuid-instance-100/submit
Authorization: Bearer eyJhbGc...
```

### 처리 흐름
```python
async def submit_instance_handler(
    instance_id: str,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        facade = FormInstanceFacade(uow)
        result = await facade.submit_instance_with_response(
            instance_id=instance_id,
            center_id=center_id,
        )
        await uow.commit()
    return result
```

### 검증 로직
```python
# 1. instance status = 'draft' 확인
# 2. 템플릿 schema에서 required 필드 목록 추출
# 3. form_answers에서 해당 instance의 답변 조회
# 4. required 필드에 대한 답변 존재 확인
# 5. signature 타입 필드에 대한 form_signatures 존재 확인
```

### DB Changes
```sql
-- 1. 필수 필드 답변 확인
SELECT question_id FROM form_answers WHERE instance_id = 'uuid-instance-100';
-- Result: ['name', 'birth', 'phone', 'consent']

-- 2. 서명 확인
SELECT field_id FROM form_signatures WHERE instance_id = 'uuid-instance-100';
-- Result: ['signature']

-- 3. 상태 변경
UPDATE form_instances
SET status = 'submitted', submitted_at = NOW()
WHERE id = 'uuid-instance-100';
```

### Final State
- DB: form_instances.status = 'submitted', submitted_at 기록
- 답변 수정 불가 (draft로 되돌려야 함)

---

## 시나리오 8: 재수정 (submitted → draft)

### 상황
제출된 양식에 수정이 필요하여 draft로 되돌림.

### HTTP Request
```http
POST /forms/instances/uuid-instance-100/revert
Authorization: Bearer eyJhbGc...
```

### DB Changes
```sql
UPDATE form_instances
SET status = 'draft', submitted_at = NULL
WHERE id = 'uuid-instance-100' AND status = 'submitted';
```

### Final State
- DB: form_instances.status = 'draft'
- 답변 수정 다시 가능
- 재제출 시 다시 필수 필드 검증

---

## 시나리오 9: PDF Export

### 상황
제출된 양식을 PDF로 export하여 Document 도메인에 저장.

### HTTP Request
```http
POST /forms/instances/uuid-instance-100/export
Authorization: Bearer eyJhbGc...
```

### 처리 흐름
```python
async def export_instance_handler(
    instance_id: str,
    center_id: str = Depends(get_verified_center_id),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 기존 export 확인 (캐싱)
        existing = await document_form_repo.find_by_instance(instance_id)
        if existing:
            return existing_export_response(existing)

        # 2. 템플릿 + 답변 + 서명 조회
        instance = await instance_repo.get(instance_id)
        template = await template_repo.get(instance.template_id)
        answers = await answer_repo.find_by_instance(instance_id)
        signatures = await signature_repo.find_by_instance(instance_id)

        # 3. PDF 생성
        pdf_bytes = await generate_pdf(template, answers, signatures)

        # 4. Document 도메인에 저장
        document = await document_facade.upload(...)

        # 5. 매핑 테이블 연결
        await document_form_repo.create({
            "document_id": document.id,
            "instance_id": instance_id,
        })

        await uow.commit()
    return export_response
```

### DB Changes
```sql
-- 1. 캐싱 확인
SELECT * FROM document_form_instances WHERE instance_id = 'uuid-instance-100';
-- Result: 없음 (최초 export)

-- 2. 답변 조회
SELECT question_id, answer FROM form_answers WHERE instance_id = 'uuid-instance-100';

-- 3. 서명 조회
SELECT * FROM form_signatures WHERE instance_id = 'uuid-instance-100';

-- 4. Document 생성 (Document 도메인)
-- ... (Document 도메인 로직)

-- 5. 매핑 테이블 생성
INSERT INTO document_form_instances (id, document_id, instance_id, created_at)
VALUES (gen_random_uuid(), 'uuid-document-500', 'uuid-instance-100', NOW());
```

### Final State
- Document 도메인: PDF 파일 저장
- DB: document_form_instances 1건 추가 (매핑)
- 재요청 시 기존 Document 반환 (캐싱)

---

## 시나리오 10: 템플릿 수정 (새 버전 생성)

### 상황
센터가 커스텀 템플릿에 "주소" 필드를 추가 (version 1 → version 2).

### HTTP Request
```http
PUT /forms/templates/uuid-center-1
Authorization: Bearer eyJhbGc...
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

### DB Changes
```sql
-- 1. 기존 버전 비활성화
UPDATE form_templates
SET is_active = FALSE
WHERE id = 'uuid-center-1';
-- (center_id='uuid-center-123', name='개인정보 동의서 (우리 센터)', version=1)

-- 2. 새 버전 row 생성 (immutable)
INSERT INTO form_templates (id, center_id, name, version, schema, is_active, created_at)
VALUES (
    'uuid-center-1-v2',
    'uuid-center-123',
    '개인정보 동의서 (우리 센터)',
    2,
    '{"fields": {...address 추가...}}'::jsonb,
    TRUE,
    NOW()
);
```

### Final State
- DB: form_templates에 새 row 추가 (version=2, is_active=TRUE)
- 기존 row: version=1, is_active=FALSE (삭제되지 않음)
- **기존 instance**: template_id='uuid-center-1' (v1) 계속 참조 → 보호됨
- **새 instance**: template_id='uuid-center-1-v2' (v2) 참조

---

## 요약

| 시나리오 | HTTP 메서드 | 엔드포인트 | 주요 로직 |
|----------|-------------|------------|----------|
| 1. 템플릿 조회 | GET | /forms/templates | 시스템 + 센터 모두 표시 |
| 2. 템플릿 복제 | POST | /forms/templates/{id}/clone | 시스템 템플릿 → 센터 템플릿 |
| 3. 센터 독자 템플릿 | POST | /forms/templates | 시스템 템플릿 없이 직접 생성 |
| 4. 양식 작성 시작 | POST | /forms/instances | draft 생성 |
| 5. 답변 저장 | PUT | /forms/instances/{id}/answers | UPSERT (row-per-answer) |
| 6. 전자 서명 | POST | /forms/signatures | Base64 or S3, 불변 |
| 7. 양식 제출 | POST | /forms/instances/{id}/submit | 필수 필드 검증, draft → submitted |
| 8. 재수정 | POST | /forms/instances/{id}/revert | submitted → draft |
| 9. PDF Export | POST | /forms/instances/{id}/export | Document 도메인 연계 + 매핑 테이블 |
| 10. 템플릿 수정 | PUT | /forms/templates/{id} | 새 row 생성 (immutable), 기존 참조 보호 |
