"""FormTemplate.schema JSONB 계약 (Pydantic v2)

3개 평면(plane)으로 양식을 정의한다:

- pages: 배경 이미지(스캔 서식)와 크기
- fields: DATA 평면 - 의미 키(semantic key) → 필드 정의
- elements: PRESENTATION 평면 - 정규화 좌표에 배치된 위젯

elements 는 ``field_refs`` 를 통해 fields 와 0~n:n 으로 연결된다.
(0 = heading/divider 같은 장식, n = 한 위젯이 여러 필드에 바인딩)
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


# Nested Defs


class PageDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # no 는 안정 식별자 — elements[].page 가 이걸 가리킨다. 페이지를 지워도 재번호하지 않는다
    # (구멍 허용). 표시 순서는 pages 배열 순서가 소유한다.
    no: int = Field(..., description="페이지 번호 (안정 식별자)")
    # 스캔 서식만 배경을 갖는다. AI 초안·수동 작성 서식은 배경 없이 w/h 로 종이 비율만 선언
    image: str | None = Field(default=None, description="배경 이미지 (S3 path/url)")
    w: int = Field(..., description="페이지 폭 (px)")
    h: int = Field(..., description="페이지 높이 (px)")


class OptionDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str = Field(..., description="저장 값")
    label: str = Field(..., description="표시 라벨")
    allow_text: bool = Field(
        default=False,
        description='자유 입력 허용 (예: "기타( )")',
    )


class FieldDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal[
        # 확정 14종 — docs/form/element-spec.md (checkbox 단일·consent 제외)
        "text",
        "textarea",
        "email",
        "phone",
        "number",
        "date",
        "time",
        "datetime",
        "select",
        "radio",
        "checkbox_group",
        "signature",
        "file",
        "image",
    ] = Field(..., description="필드 타입")
    label: str = Field(..., description="필드 라벨")
    required: bool = Field(default=False, description="필수 여부")
    options: list[OptionDef] | None = Field(
        default=None, description="선택지 (select/radio/checkbox_group 등)"
    )
    validation: dict[str, Any] | None = Field(
        default=None, description="추가 검증 규칙 (min/max/pattern 등)"
    )


class ElementDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="엘리먼트 ID (스키마 전체에서 고유)")
    page: int = Field(..., description="배치 페이지 번호")
    rect: list[float] = Field(
        ...,
        description="정규화 좌표 [x, y, w, h] (각 0..1)",
    )
    z: int = Field(default=0, description="z-index (겹침 순서)")
    widget: str = Field(..., description="렌더 위젯 종류")
    field_refs: list[str] = Field(
        default_factory=list,
        description="연결 필드 키 목록 (0 = 장식, n = n:n)",
    )
    text: str | None = Field(
        default=None,
        description="장식/안내 텍스트 (heading 문구 등, field_refs 없는 요소)",
    )
    option: str | None = Field(
        default=None,
        description="바인딩되는 단일 선택지 value (예: 체크박스 하나)",
    )
    slot: int | None = Field(
        default=None,
        description="위치 슬롯 (예: 주민번호 자릿수 인덱스)",
    )

    @model_validator(mode="after")
    def _validate_rect(self) -> "ElementDef":
        if len(self.rect) != 4:
            raise ValueError(
                f"element '{self.id}'.rect must have exactly 4 components [x, y, w, h], "
                f"got {len(self.rect)}"
            )
        for i, c in enumerate(self.rect):
            if not (0.0 <= c <= 1.0):
                raise ValueError(
                    f"element '{self.id}'.rect[{i}] = {c} is out of normalized range [0.0, 1.0]"
                )
        return self


# Root


class FormSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pages: list[PageDef] = Field(default_factory=list)
    fields: dict[str, FieldDef] = Field(default_factory=dict)
    elements: list[ElementDef] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_cross_refs(self) -> "FormSchema":
        # element id 유일성
        seen: set[str] = set()
        for el in self.elements:
            if el.id in seen:
                raise ValueError(f"duplicate element id: '{el.id}'")
            seen.add(el.id)

        # element.page 는 선언된 페이지를 가리켜야 한다.
        # pages 가 비면(옛 데이터·AI 초안) 검사하지 않는다 — 하위호환.
        page_nos = {p.no for p in self.pages}
        if page_nos:
            for el in self.elements:
                if el.page not in page_nos:
                    raise ValueError(
                        f"element '{el.id}'.page={el.page} is not among pages "
                        f"{sorted(page_nos)}"
                    )

        for el in self.elements:
            # field_refs 의 모든 키는 fields 에 존재해야 함
            for ref in el.field_refs:
                if ref not in self.fields:
                    raise ValueError(
                        f"element '{el.id}'.field_refs references unknown field '{ref}'"
                    )

            # option 이 지정되면, 참조 필드가 options 를 정의하고 그 value 에 포함되어야 함
            if el.option is not None:
                if not el.field_refs:
                    raise ValueError(
                        f"element '{el.id}' sets option='{el.option}' but has no field_refs"
                    )
                for ref in el.field_refs:
                    field = self.fields[ref]
                    if not field.options:
                        raise ValueError(
                            f"element '{el.id}' sets option='{el.option}' but field "
                            f"'{ref}' defines no options"
                        )
                    valid = {o.value for o in field.options}
                    if el.option not in valid:
                        raise ValueError(
                            f"element '{el.id}'.option='{el.option}' is not among field "
                            f"'{ref}' options {sorted(valid)}"
                        )
        return self


def validate_form_schema(data: dict) -> FormSchema:
    """schema dict 를 파싱+검증한다. 실패 시 pydantic ValidationError 발생."""
    return FormSchema.model_validate(data)
