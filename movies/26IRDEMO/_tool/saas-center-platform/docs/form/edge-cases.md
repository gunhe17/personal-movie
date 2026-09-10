# Form 도메인 엣지케이스

복잡한 상황 및 예외 처리 시나리오

---

## 1. 제출 중 템플릿 변경

### 상황
사용자가 양식 작성 중에 관리자가 템플릿을 수정하여 새 버전 배포.

```
T0: 사용자 A가 템플릿 v1(uuid-v1)로 instance 생성 (draft)
T1: 관리자가 템플릿 수정 → v2(uuid-v2) 생성, v1 is_active=false
T2: 사용자 A가 작성 완료 후 제출 시도
```

**해결**: Immutable row 전략으로 자동 해결

```python
# instance.template_id = 'uuid-v1' (생성 시 고정)
# v1 row가 is_active=false여도 row 자체는 존재
# 제출 시 template_id로 직접 조회 → v1 schema 기준으로 검증

async def submit_instance(instance_id: str):
    instance = await instance_repo.get(instance_id)

    # template_id로 직접 조회 (is_active 무관)
    template = await template_repo.get(instance.template_id)

    # v1 schema 기준으로 필수 필드 검증
    validate_required_fields(template.schema, answers)
```

**장점**: instance가 특정 version row의 UUID를 직접 참조하므로 버전 불일치 문제 없음.

---

## 2. 전자 서명 크기 초과

### 상황
사용자가 고해상도 서명 이미지 생성 → Base64 크기가 100KB 초과.

**해결**: 크기 기반 저장 전략

```python
async def create_signature(
    instance_id: str,
    field_id: str,
    signature_data: str,  # Base64
):
    signature_bytes = base64.b64decode(signature_data.split(",")[1])
    size_kb = len(signature_bytes) / 1024

    if size_kb < 100:
        # DB에 직접 저장
        await signature_repo.create({
            "storage_type": "base64",
            "signature_data": signature_data,
            "storage_path": None,
        })
    else:
        # S3에 저장
        storage_path = f"centers/{center_id}/signatures/{uuid4()}.png"
        await s3.upload(signature_bytes, storage_path)

        await signature_repo.create({
            "storage_type": "s3",
            "signature_data": None,
            "storage_path": storage_path,
        })
```

---

## 3. PDF Export 실패 처리

### 상황
Instance → PDF 변환 중 오류 발생 (라이브러리 오류, 메모리 부족 등).

**해결**: 재시도 + 에러 응답

```python
async def export_to_pdf(instance_id: str, max_retries: int = 3):
    instance = await instance_repo.get(instance_id)
    template = await template_repo.get(instance.template_id)
    answers = await answer_repo.find_by_instance(instance_id)
    signatures = await signature_repo.find_by_instance(instance_id)

    for attempt in range(max_retries):
        try:
            pdf_bytes = await generate_pdf(template, answers, signatures)

            # Document 도메인에 저장
            document = await document_facade.upload(pdf_bytes, ...)

            # 매핑 테이블 연결
            await document_form_repo.create({
                "document_id": document.id,
                "instance_id": instance_id,
            })

            return document

        except PDFGenerationError as e:
            logger.error(f"PDF export failed (attempt {attempt+1}): {e}")

            if attempt == max_retries - 1:
                raise InvalidOperationException(
                    "PDF 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
                )

            await asyncio.sleep(2 ** attempt)
```

---

## 4. 동시 제출 (같은 instance_id)

### 상황
사용자가 "제출" 버튼을 빠르게 여러 번 클릭.

**해결**: Idempotent 제출

```python
async def submit_instance(instance_id: str):
    instance = await instance_repo.get(instance_id)

    # 이미 제출된 경우 → 성공 응답 (idempotent)
    if instance.status == "submitted":
        return instance

    # draft만 제출 가능
    if instance.status != "draft":
        raise InvalidOperationException(f"Cannot submit: status is {instance.status}")

    # 트랜잭션 내에서 상태 변경
    instance.status = "submitted"
    instance.submitted_at = utc_now()
    await instance_repo.update(instance)
```

---

## 5. 조건부 필드 검증 (Phase 2)

### 상황
조건부 필드에서 조건 충족 시만 required.

```json
{
  "has_guardian": { "type": "checkbox", "label": "보호자 있음" },
  "guardian_name": {
    "type": "text",
    "label": "보호자 이름",
    "required": true,
    "conditional": { "field": "has_guardian", "operator": "equals", "value": true }
  }
}
```

**해결**: 조건부 검증 로직

```python
def validate_required_fields(schema: dict, answers: dict[str, dict]):
    errors = []

    for field_id, field_def in schema["fields"].items():
        # 조건부 필드 확인
        if "conditional" in field_def:
            condition = field_def["conditional"]
            condition_value = answers.get(condition["field"], {}).get("value")

            if not evaluate_condition(condition_value, condition["operator"], condition["value"]):
                continue  # 조건 불충족 → 스킵

        # 필수 필드 검증
        if field_def.get("required", False):
            answer = answers.get(field_id)
            if not answer or not answer.get("value"):
                errors.append(f"필수 필드 누락: {field_def['label']}")

    if errors:
        raise InvalidOperationException(", ".join(errors))


def evaluate_condition(value, operator: str, expected):
    if operator == "equals":
        return value == expected
    elif operator == "not_equals":
        return value != expected
    elif operator == "in":
        return value in expected
    elif operator == "not_in":
        return value not in expected
    else:
        raise ValueError(f"Unknown operator: {operator}")
```

---

## 6. 매핑 테이블 중복

### 상황
Client에 동일 Instance를 동시에 연결.

**해결**: UPSERT 패턴

```sql
INSERT INTO client_form_instances (id, client_id, instance_id, relation_type, created_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (client_id, instance_id)
DO UPDATE SET relation_type = EXCLUDED.relation_type
RETURNING *;
```

---

## 7. 서명 필드 누락 시 제출 방지

### 상황
서명 필드(required=true)인데 서명 데이터가 없음.

**해결**: 제출 시 서명 검증

```python
async def validate_signatures(schema: dict, instance_id: str):
    signature_fields = {
        fid: fdef
        for fid, fdef in schema["fields"].items()
        if fdef["type"] == "signature" and fdef.get("required", False)
    }

    for field_id, field_def in signature_fields.items():
        # 최신 signed_at 기준 유효 서명 조회 (다중 서명 허용, 최신이 유효)
        signature = await signature_repo.find_latest_by_instance_and_field(
            instance_id, field_id
        )

        if not signature:
            raise InvalidOperationException(f"서명 필드 누락: {field_def['label']}")
```

---

## 8. Revert 후 재서명

### 상황
submitted → draft로 되돌린 후 사용자가 서명을 다시 하고 싶음. 기존 서명은 immutable.

**해결**: 새 서명 row 생성 (기존 보존, 최신이 유효)

```python
async def create_signature(instance_id: str, field_id: str, ...):
    # 기존 서명 삭제하지 않음 (immutable)
    # 새 서명 row 생성
    await signature_repo.create({
        "instance_id": instance_id,
        "field_id": field_id,
        "signature_data": new_signature_data,
        "signed_at": utc_now(),
        ...
    })

# 유효 서명 조회 (최신만)
async def get_current_signatures(instance_id: str):
    """field_id별 최신 서명만 반환"""
    stmt = text("""
        SELECT DISTINCT ON (field_id) *
        FROM form_signatures
        WHERE instance_id = :instance_id
        ORDER BY field_id, signed_at DESC
    """)
    return await session.execute(stmt, {"instance_id": instance_id})
```

**감사 추적**: 과거 서명 row는 삭제되지 않으므로 서명 이력 확인 가능.

---

## 9. 템플릿 비활성화 후 제출

### 상황
사용자가 작성 중인 양식의 템플릿이 비활성화됨 (새 버전 배포).

**해결**: 제출 허용 (instance는 특정 version row를 직접 참조)

```python
async def submit_instance(instance_id: str):
    instance = await instance_repo.get(instance_id)

    # template_id로 직접 조회 (is_active 무관)
    template = await template_repo.get(instance.template_id)

    # is_active=false여도 row 자체는 존재하므로 검증 가능
    validate_required_fields(template.schema, answers)

    # 제출 처리
    instance.status = "submitted"
    instance.submitted_at = utc_now()
```

**근거**: immutable row 전략 덕분에 비활성화된 template row도 삭제되지 않으므로 항상 참조 가능.

---

## 10. PDF Export 캐싱

### 상황
동일 Instance에 대해 PDF export 여러 번 요청.

**해결**: 매핑 테이블 기반 캐싱 (1:1 유지)

```python
async def export_to_pdf(instance_id: str, force: bool = False):
    # 캐싱 확인
    if not force:
        existing = await document_form_repo.find_by_instance(instance_id)
        if existing:
            return {
                "document_id": existing.document_id,
                "cached": True,
            }

    # force=true: 기존 매핑 삭제 (1:1 유지)
    if force:
        await document_form_repo.delete_by_instance(instance_id)

    # 새로 export
    pdf_bytes = await generate_pdf(...)
    document = await document_facade.upload(pdf_bytes, ...)

    await document_form_repo.create({
        "document_id": document.id,
        "instance_id": instance_id,
    })

    return { "document_id": document.id, "cached": False }
```

**재생성 옵션**:
```http
POST /forms/instances/{id}/export?force=true
```

**주의**: force=true 시 기존 매핑만 삭제. Document 자체는 Document 도메인에서 관리 (삭제 여부는 Document 정책에 따름).

---

## 11. 재수정 후 재제출

### 상황
submitted → draft로 되돌린 후 답변 수정, 재제출.

**흐름**:
```
submitted → revert → draft → 답변 수정 → submit → submitted
```

```python
async def revert_instance(instance_id: str):
    instance = await instance_repo.get(instance_id)

    if instance.status != "submitted":
        raise InvalidOperationException("제출된 양식만 되돌릴 수 있습니다")

    instance.status = "draft"
    instance.submitted_at = None
    await instance_repo.update(instance)

# 이후 답변 수정 가능 (draft 상태)
# 재제출 시 다시 필수 필드 검증
```

**PDF 관련**: 재수정 후 재제출 시 기존 PDF는 이전 버전 데이터 기준. 필요 시 `force=true`로 재생성.

---

## 엣지케이스 체크리스트

새 기능 개발 시 확인:

- [ ] **템플릿 버전**: instance가 특정 version row UUID를 직접 참조 (immutable)
- [ ] **전자 서명**: 크기 기반 저장 전략 (Base64 vs S3)
- [ ] **PDF Export**: 실패 재시도 + 매핑 테이블 캐싱
- [ ] **동시 제출**: Idempotent 처리
- [ ] **조건부 필드**: 조건 평가 후 검증 (Phase 2)
- [ ] **매핑 중복**: UPSERT 패턴
- [ ] **서명 검증**: 필수 서명 누락 방지
- [ ] **재서명**: revert 후 재서명 시 새 row 생성, 최신 signed_at이 유효
- [ ] **템플릿 비활성화**: immutable row 덕분에 항상 참조 가능
- [ ] **PDF 캐싱**: 매핑 테이블 존재 여부로 중복 확인, force=true 시 기존 매핑 삭제 (1:1)
- [ ] **재수정 흐름**: submitted → draft → submitted (필수 필드 재검증)
