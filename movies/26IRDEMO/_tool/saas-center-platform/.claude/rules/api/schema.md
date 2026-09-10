---
paths:
  - "apps/api/app/modules/**/schemas.py"
  - "apps/api/app/modules/**/schemas_*.py"
  - "apps/api/app/application/schemas.py"
  - "apps/api/app/application/**/schemas.py"
---

# Schema — HTTP 경계 DTO

`schemas.py`는 **HTTP 경계의 입출력 DTO**다 — pydantic `BaseModel`로 request를 검증해 받고, Model을 response로 직렬화한다. 도메인 검증·비즈니스 로직은 없다(아래·옆 레이어). Entity-free라 SQLAlchemy Model이 도메인 데이터고, 스키마는 그 경계 표현일 뿐이다. 모듈 서브모듈(`modules/**/schemas.py`)과 application 레이어(`application/schemas.py`·`application/**/schemas.py`, 크로스모듈 응답 DTO) 둘 다 같은 규약을 따른다.

루트: 주석 규약 [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) · service 흐름 [service.md](service.md) · 직렬화 위치 [facade.md](facade.md) §2 · 타입 별칭 [core/type.py](../../../apps/api/app/core/type.py).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 네이밍 | `{Noun}Create`·`{Noun}Update`·`{Noun}Response`·`{Noun}ListResponse`·`{Noun}Item`·`{Noun}Request` |
| Request | `Field` 제약(`min_length`·`ge` 등)으로 **입력 형식**만 검증. 도메인 규칙은 service/repo |
| Response | `model_config = ConfigDict(from_attributes=True)` — Model에서 `model_validate` |
| co-located | service Command/Result dataclass는 **같은 `schemas.py`** (별도 `dtos/` 금지) |
| Field desc | 필드명 재진술 제거. enum·format만 유지([router.md](router.md) §3과 동일 결) |

---

## 1. 네이밍 — 역할이 접미에

한 서브모듈 `schemas.py`에 그 엔티티의 경계 DTO를 모은다. 접미가 방향·형태를 고지한다.

| 접미 | 용도 |
|---|---|
| `{Noun}Create` | POST 본문 (생성 입력) |
| `{Noun}Update` | PATCH/PUT 본문 (부분 수정 입력) |
| `{Noun}Response` | 단건 응답 |
| `{Noun}ListResponse` | 목록 응답(보통 `items` + 페이지 메타) |
| `{Noun}Item` | 목록 항목(요약 형태, `Response`와 다른 필드셋) |
| `{Noun}Request` | 본문이 create/update가 아닌 동작 입력(검증·배치 등) |

- 타입은 공용 시맨틱 별칭([core/type.py](../../../apps/api/app/core/type.py)): id=`uuid_str`, 타임스탬프=`utc_dt`. `str`/`int`는 그대로.
- 닫힌 값집합 필드(status·type 등)는 그 모듈 models.py의 `str, Enum`을 그대로 타입으로 인용([persistence-model.md](persistence-model.md) §4) — DTO에 별도 Literal/enum 중복 정의 금지.

## 2. Request — 형식 검증만

입력 DTO는 `Field` 제약으로 **형식**을 막는다 — 도메인 규칙(중복·상태전이·권한)은 검증하지 않는다.

```python
# good: 형식 제약은 Field, 도메인은 service/repo
class WidgetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    owner_member_id: uuid_str | None = None
```

- `min_length`·`max_length`·`ge`·`le`·`pattern`은 입력 계약 — 여기 둔다.
- "이름 중복 불가"·"draft만 수정 가능" 같은 도메인 불변식은 **service `verify_*`/repo**([service.md](service.md) §4, [persistence-repository.md](persistence-repository.md) §2). 스키마가 떠안지 않는다.
- handler가 스키마를 풀어 service에 **primitive**를 넘긴다 — service는 pydantic 객체를 받지 않는다([service.md](service.md) §7).

## 3. Response — `from_attributes`

응답 스키마는 Model을 `model_validate`로 변환한다.

```python
# good: from_attributes 로 Model → Response
class WidgetResponse(BaseModel):
    id: uuid_str
    center_id: uuid_str
    name: str
    status: str
    created_at: utc_dt
    updated_at: utc_dt

    model_config = ConfigDict(from_attributes=True)
```

- `model_config = ConfigDict(from_attributes=True)` — Response 계열에 둔다(Model 속성 매핑).
- **직렬화(`model_validate`) 위치는 [facade.md](facade.md) §2가 정의** — facade `*_with_response`(자기 모듈 HTTP) 또는 facade 없는 단순 모듈의 handler. 스키마는 형태만 선언, 변환 지점은 정하지 않는다.
- 목록은 `items` + 페이지 메타(`total`/`page`/`size`/`pages`)를 한 dict에 안 섞는다 — `tuple[list, Page]`를 handler/facade가 조립([persistence-repository.md](persistence-repository.md) §3).

## 4. co-located dataclass — `dtos/` 디렉토리만 금지

service 입출력 Command/Result dataclass(`ConfirmExtractionResult`·`DuplicateCheckResult` 등)의 **유일 금지는 별도 `dtos/` 디렉토리**다([ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) 비-예외). 위치는 둘 다 허용:

- `schemas.py`에 둠 — pydantic Response와 plain dataclass 공존 가능(전자=HTTP 경계, 후자=service 반환).
- 그 dataclass를 반환하는 **service 파일에 co-located** — 대부분 정당, 통일성 영향 낮음. `schemas.py`로 뺄지는 선택.
- **캐리어는 `*Response`를 임베드하지 않는다** — Command/Result DTO가 엔티티+계산데이터를 함께 실으면 `Model`(+primitive)을 담고, Response 직렬화는 소비 레이어(application handler)가([service.md](service.md) §2.1 레이어 규칙).

## 5. 주석 · Field description

전역 규칙 [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md). 기본은 "없음".

- `Field(description=...)`가 **필드명 재진술**이면 제거 — 제약은 `ge`/`max_length` 등 validator가 이미 드러낸다.
- **enum·format**은 추론 불가라 유지(`Field(description="상태 (draft | submitted)")`) — [router.md](router.md) §3 param description과 같은 결.
- 클래스/모듈 docstring 없음.

---

## 안티패턴

- 스키마가 도메인 규칙 검증(중복·상태전이) → service `verify_*`/repo([service.md](service.md) §4)
- service가 pydantic 스키마를 인자로 받음 → handler가 primitive로 언패킹([service.md](service.md) §7)
- Response가 `items`와 페이지 메타를 한 dict에 혼합 → `tuple[list, Page]` 분리([persistence-repository.md](persistence-repository.md) §3)
- service Command/Result를 별도 `dtos/` 디렉토리에 → `schemas.py` 또는 service 파일 co-located
- `Field(description=...)`로 필드명 재진술 → 제거(enum/format만)
- 클래스/모듈 docstring·`# ====` 배너 → 삭제([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md))
