# Form 도메인 설계

## 도메인 개요

### 문제 정의
상담센터 운영 시 다양한 온라인 양식 관리 필요:
- 내담자 신청서, 개인정보 동의서, 초기 상담 기록지
- 검사 동의서, 심리 검사 설문지
- 상담 계약서, 종결 보고서

**핵심 문제**:
1. 센터마다 다른 양식 형식 (시스템 템플릿 기반 + 센터별 커스터마이징)
2. 템플릿 버전 관리 (immutable row 전략)
3. 작성된 양식의 개별 답변 저장 및 수정
4. PDF export (법적 보관, 출력 목적)
5. 전자 서명 지원 (법적 효력)

### 설계 원칙
1. **독립적 Main Module**: Document 도메인과 분리, 양식 전문화, FK 제약 없음
2. **템플릿 계층**: 시스템 템플릿(global) + 센터 템플릿(항상 복제 후 사용)
3. **Immutable 버전 관리**: 템플릿 수정 시 새 row 생성 (기존 instance 참조 보호)
4. **정규화된 답변 저장**: row-per-answer 방식 (개별 답변 쿼리 가능)
5. **Document 연계**: PDF export 시 Document 도메인 활용 (매핑 테이블)
6. **매핑 테이블 패턴**: 엔티티 연결은 각 도메인의 매핑 테이블이 담당
7. **모듈 간 JOIN 금지**: 조회는 2단계 (매핑 테이블 → Form Service 호출)
8. **RLS / Multi-tenancy**: 모든 테이블에 `center_id` 필수 (form_templates만 예외: NULL = 시스템 템플릿)

---

## 핵심 개념

### FormTemplate (양식 템플릿)
- **정의**: 양식의 구조 및 필드 정의 (재사용 가능한 양식 설계)
- **책임**:
  - 필드 정의 (타입, 레이블, 검증 규칙)
  - Immutable 버전 관리 (수정 시 새 row)
  - 시스템 템플릿 vs 센터 템플릿 구분
  - 활성화/비활성화 상태 관리
- **생명주기**: 생성 → 수정 시 새 버전 row 생성 → 비활성화
- **시스템 템플릿 규칙**: 센터는 항상 복제 후 사용, 시스템 템플릿은 숨기지 않음

### FormInstance (양식 인스턴스)
- **정의**: 특정 템플릿 버전 기반으로 생성된 양식 작성 단위
- **책임**:
  - 작성 상태 관리 (draft ↔ submitted)
  - 특정 템플릿 버전 참조 (immutable 참조)
  - **연결은 각 도메인의 매핑 테이블이 담당**
- **생명주기**: 생성(draft) → 제출(submitted) → 재수정(draft) → 재제출(submitted)

### FormAnswer (양식 답변)
- **정의**: instance의 개별 질문에 대한 답변 (row-per-answer)
- **책임**:
  - 질문별 답변 저장 (JSONB 단순 값)
  - 수정 시 덮어쓰기 (이력 없음)
- **장점**: 개별 답변 SQL 쿼리 가능, 부분 업데이트 가능

### FormSignature (전자 서명)
- **정의**: 양식에 대한 전자 서명 데이터
- **책임**:
  - 서명 이미지 저장 (Base64 또는 S3)
  - 서명자 정보 기록
  - 서명 시간 기록
- **생명주기**: 서명 생성 → 불변 (Immutable)

---

## 스키마 정의

### 1. FormTemplate

```sql
CREATE TABLE form_templates (
    id UUID PRIMARY KEY,

    -- 소유자 (RLS 예외: NULL = 시스템 템플릿, global 데이터)
    center_id UUID,

    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    -- 필드/질문/레이아웃 정의
    schema JSONB NOT NULL,

    -- 같은 (center_id, name) 시리즈 중 현재 활성 버전
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL,

    -- 버전 전략: 수정 시 새 row (immutable)
    UNIQUE (center_id, name, version)
);

CREATE INDEX idx_templates_center_active
    ON form_templates (center_id, is_active)
    WHERE is_active = TRUE;

CREATE INDEX idx_templates_system
    ON form_templates (is_active)
    WHERE center_id IS NULL AND is_active = TRUE;
```

**schema JSONB 구조**:
```json
{
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
}
```

**버전 전략 예시**:
```sql
-- 템플릿 v1 (비활성화)
INSERT INTO form_templates (id, center_id, name, version, schema, is_active, created_at)
VALUES ('aaa', '123', '개인정보 동의서', 1, '{...}', FALSE, '2024-01-01');

-- 템플릿 v2 (활성)
INSERT INTO form_templates (id, center_id, name, version, schema, is_active, created_at)
VALUES ('bbb', '123', '개인정보 동의서', 2, '{...}', TRUE, '2024-06-01');

-- 기존 instance는 template_id='aaa' (v1)를 계속 참조 → 보호됨
```

### 2. FormInstance

```sql
CREATE TABLE form_instances (
    id UUID PRIMARY KEY,
    center_id UUID NOT NULL,

    -- 특정 버전의 템플릿 row를 직접 참조 (immutable 참조)
    template_id UUID NOT NULL,

    -- draft ↔ submitted
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_instances_center ON form_instances (center_id, status);
CREATE INDEX idx_instances_template ON form_instances (template_id);
```

**상태 전환**:
```
생성 → draft → submitted → draft (재수정) → submitted
```
- `draft`: 답변 추가/수정 가능
- `submitted`: 제출 완료 (수정하려면 draft로 되돌림)

### 3. FormAnswer

```sql
CREATE TABLE form_answers (
    id UUID PRIMARY KEY,

    center_id UUID NOT NULL,
    instance_id UUID NOT NULL,
    question_id VARCHAR(100) NOT NULL,

    -- 단순 값: { "value": "김철수" }
    -- 다중 선택: { "value": ["option1", "option2"] }
    -- 체크박스: { "value": true }
    answer JSONB NOT NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    -- 수정 시 덮어쓰기 (이력 없음)
    UNIQUE (instance_id, question_id)
);

CREATE INDEX idx_answers_instance ON form_answers (instance_id);
CREATE INDEX idx_answers_center ON form_answers (center_id);
```

**row-per-answer 장점**:
```sql
-- 특정 질문에 특정 답변을 한 instance 검색
SELECT instance_id FROM form_answers
WHERE question_id = 'consent'
AND answer->>'value' = 'false';

-- instance의 전체 답변 조회
SELECT question_id, answer FROM form_answers
WHERE instance_id = $1
ORDER BY created_at;
```

### 4. FormSignature

```sql
CREATE TABLE form_signatures (
    id UUID PRIMARY KEY,

    center_id UUID NOT NULL,
    instance_id UUID NOT NULL,

    -- schema의 어떤 signature 필드인지
    field_id VARCHAR(100) NOT NULL,

    -- 저장 방식
    storage_type VARCHAR(20) NOT NULL DEFAULT 'base64',  -- 'base64' | 's3'
    signature_data TEXT,       -- base64: 데이터 직접 저장
    storage_path VARCHAR(500), -- s3: 경로

    -- 서명자 정보 (스냅샷, 변경되어도 기록 보존)
    signer_name VARCHAR(100) NOT NULL,
    signer_ip VARCHAR(45),

    -- 서명은 불변 (Immutable)
    -- 같은 (instance_id, field_id)에 여러 서명 가능 (revert 후 재서명)
    -- 최신 signed_at이 유효한 서명
    signed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_signatures_instance ON form_signatures (instance_id, field_id);
CREATE INDEX idx_signatures_center ON form_signatures (center_id);
```

### 5. 매핑 테이블 (도메인 간 연결)

Form 도메인은 **완전 독립적**이며, 다른 도메인과의 연결은 **각 도메인의 매핑 테이블**이 담당합니다.

#### Client 도메인

```sql
CREATE TABLE client_form_instances (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL,
    instance_id UUID NOT NULL,
    relation_type VARCHAR(50),  -- 'application', 'consent', 'initial_interview'
    created_at TIMESTAMP NOT NULL,
    UNIQUE (client_id, instance_id)
);
```

#### Counseling 도메인

```sql
CREATE TABLE counseling_form_instances (
    id UUID PRIMARY KEY,
    counseling_session_id UUID NOT NULL,
    instance_id UUID NOT NULL,
    relation_type VARCHAR(50),  -- 'contract', 'termination_report'
    created_at TIMESTAMP NOT NULL,
    UNIQUE (counseling_session_id, instance_id)
);
```

#### Document 도메인 (PDF export 연계)

```sql
CREATE TABLE document_form_instances (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,
    instance_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL,
    UNIQUE (instance_id)  -- 1:1 관계: instance당 하나의 document만 매핑
);
```

#### 조회 패턴 (JOIN 금지, 2단계 조회)

```python
# 1단계: 매핑 테이블에서 instance_ids 조회
client_forms = await client_form_repo.find_by_client(client_id)
instance_ids = [cf.instance_id for cf in client_forms]
relation_map = {cf.instance_id: cf.relation_type for cf in client_forms}

# 2단계: Form Service 호출 (JOIN 없음)
instances = await form_instance_service.get_by_ids(instance_ids)

# 3단계: relation_type 추가
for inst in instances:
    inst["relation_type"] = relation_map.get(inst["id"])
```

---

## 비즈니스 규칙

### 템플릿 관리 규칙

| 항목 | 규칙 | 근거 |
|------|------|------|
| 시스템 템플릿 | center_id = NULL, 모든 센터에서 조회 가능 | RLS 유일한 예외, global 데이터 |
| 센터 템플릿 | center_id = 센터 UUID, 해당 센터만 조회 | RLS 적용 |
| 복제 규칙 | 센터는 시스템 템플릿을 항상 복제 후 사용 | 센터별 독립성 보장 |
| 시스템 템플릿 노출 | 센터 템플릿이 있어도 시스템 템플릿 숨기지 않음 | 카탈로그 역할 유지 |
| 버전 전략 | 수정 시 새 row 생성 (immutable), 기존 row is_active=false | 기존 instance 참조 보호 |
| 활성화 상태 | 같은 (center_id, name) 시리즈 중 하나만 is_active=true | 최신 버전만 신규 작성에 사용 |

### 양식 상태 규칙

| 상태 | 설명 | 답변 수정 | 전환 |
|------|------|----------|------|
| `draft` | 작성 중 | 가능 | → submitted |
| `submitted` | 제출 완료 | 불가 (draft로 되돌려야 함) | → draft (재수정) |

**상태 전환 흐름**:
```
생성(draft) → 제출(submitted) → 재수정 요청(draft) → 재제출(submitted) → ...
```

### 답변 규칙

| 항목 | 규칙 | 근거 |
|------|------|------|
| 저장 방식 | row-per-answer (question_id별 1 row) | 개별 답변 쿼리 가능 |
| answer 형식 | `{ "value": ... }` 단순 값 | 일관된 구조, 파싱 용이 |
| 수정 정책 | 덮어쓰기 (이력 없음) | 단순성 우선 |
| 수정 가능 조건 | instance.status = 'draft'일 때만 | 제출 후 무결성 보장 |
| 제출 검증 | 필수 필드(required=true) 답변 존재 확인 | 데이터 완전성 |

### 전자 서명 규칙

| 항목 | 규칙 | 근거 |
|------|------|------|
| 서명 불변성 | 생성 후 수정/삭제 불가 | 법적 효력 보장 |
| 다중 서명 | 같은 (instance_id, field_id)에 여러 서명 가능 | revert 후 재서명 지원 |
| 유효 서명 | 최신 signed_at이 현재 유효한 서명 | 과거 서명은 감사 추적용 보존 |
| 저장 전략 | <100KB: Base64 DB 저장, ≥100KB: S3 저장 | 성능 최적화 |
| 서명자 정보 | signer_name 스냅샷 저장 | 이름 변경되어도 기록 보존 |
| IP 기록 | 서명 시점 IP 저장 | 부정 서명 방지 |

**유효 서명 조회**:
```sql
SELECT DISTINCT ON (field_id) *
FROM form_signatures
WHERE instance_id = $1
ORDER BY field_id, signed_at DESC;
```

### PDF Export 규칙

| 항목 | 규칙 | 근거 |
|------|------|------|
| Export 시점 | 사용자 요청 시 (on-demand) | 불필요한 PDF 생성 방지 |
| 저장 방식 | Document 도메인에 저장 + 매핑 테이블 연결 | 기존 파일 관리 인프라 재사용 |
| 캐싱 | 매핑 테이블 존재 여부로 중복 확인 | 중복 생성 방지 |
| 재생성 | force=true 시 기존 매핑 삭제 후 새 매핑 (1:1 유지) | 최신 PDF만 유효 |
| 버전 동결 | export 시점의 template 버전 사용 | 과거 양식 재현 |

---

## 필드 타입 정의

### 지원 필드 타입

```python
from enum import Enum

class FieldType(str, Enum):
    # 텍스트 입력
    TEXT = "text"
    TEXTAREA = "textarea"
    EMAIL = "email"
    PHONE = "phone"

    # 숫자
    NUMBER = "number"

    # 날짜/시간
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"

    # 선택
    SELECT = "select"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    CHECKBOX_GROUP = "checkbox_group"

    # 파일
    FILE = "file"
    IMAGE = "image"

    # 전자 서명
    SIGNATURE = "signature"

    # 레이아웃 (데이터 없음)
    DIVIDER = "divider"
    HEADING = "heading"
```

### 필드 정의 예시

```json
{
  "name": {
    "type": "text",
    "label": "이름",
    "required": true,
    "placeholder": "홍길동",
    "validation": { "minLength": 2, "maxLength": 50 },
    "order": 1
  },
  "birth": {
    "type": "date",
    "label": "생년월일",
    "required": true,
    "order": 2
  },
  "gender": {
    "type": "radio",
    "label": "성별",
    "required": true,
    "options": [
      { "value": "male", "label": "남성" },
      { "value": "female", "label": "여성" }
    ],
    "order": 3
  },
  "consent": {
    "type": "checkbox",
    "label": "개인정보 수집 및 이용에 동의합니다",
    "required": true,
    "order": 4
  },
  "signature": {
    "type": "signature",
    "label": "본인 서명",
    "required": true,
    "order": 5
  }
}
```

### 조건부 필드 (Phase 2)

```json
{
  "has_guardian": {
    "type": "checkbox",
    "label": "보호자 정보 입력",
    "required": false,
    "order": 10
  },
  "guardian_name": {
    "type": "text",
    "label": "보호자 이름",
    "required": true,
    "conditional": {
      "field": "has_guardian",
      "operator": "equals",
      "value": true
    },
    "order": 11
  }
}
```

---

## API 설계

API 명세는 [api.md](./api.md)를 참조하세요.

---

## 구현 우선순위

### Phase 1: 기본 템플릿 및 작성 (MVP)
- FormTemplate, FormInstance, FormAnswer 스키마 정의
- 시스템 템플릿 생성 (시드 데이터)
- 기본 필드 타입 지원 (text, date, select, checkbox)
- 양식 작성 및 제출 API (draft → submitted)
- 템플릿 목록 조회 (시스템 + 센터)
- 시스템 템플릿 복제 API
- **각 도메인**: 매핑 테이블 생성 (client_form_instances 등)

### Phase 2: 템플릿 관리
- 센터 템플릿 수정 (새 버전 생성)
- 템플릿 비활성화
- 조건부 필드

### Phase 3: 전자 서명
- FormSignature 스키마 정의
- signature 필드 타입 지원
- 서명 이미지 저장 (Base64 / S3)

### Phase 4: PDF Export
- PDF 생성 라이브러리 통합
- Document 도메인 연계 (매핑 테이블)
- 서명 포함 PDF 생성

### Phase 5: 고급 기능
- 필드 검증 강화 (정규식, 범위 등)
- 템플릿 미리보기
- 개별 답변 기반 통계/검색
