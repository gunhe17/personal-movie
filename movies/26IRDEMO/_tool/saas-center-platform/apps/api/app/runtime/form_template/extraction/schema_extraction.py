"""서식 PNG → FormSchema(fields + elements) 추출 — 멀티모달 OCR.

Protocol 로 추상화해 워커는 구현을 주입받는다(테스트/e2e 는 결정적 fake 주입).
기본 구현 LLMFormSchemaExtractor 는 AIGateway.generate_multimodal 호출로
fields/elements 를 추정한다(quota 체크·사용량 기록은 게이트웨이 소유). pages 는
워커가 렌더 산출 PNG 로 권위 있게 조립하므로 추출기는 fields/elements 만 책임진다.
"""
from __future__ import annotations

import base64
import json
from typing import Any, Protocol

from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext


_DEFAULT_MODEL = "google/gemini-2.5-flash"

_SYSTEM_PROMPT = """\
너는 한국 정부 서식 스캔 이미지를 분석해 온라인 작성용 FormSchema 를 만드는 도구다.
이미지에서 (1) 수집해야 할 의미 필드(fields)와 (2) 각 입력칸의 정규화 좌표 위젯
(elements)을 추정해 JSON 으로만 답하라. 설명/markdown 없이 JSON 객체만 출력한다.

규칙:
- fields: { "<semantic_key>": { "type": "...", "label": "...", "required": bool,
  "options"?: [{"value","label","allow_text"?}] } }
  type 은 text/textarea/email/phone/number/date/time/datetime/select/radio/
  checkbox_group/signature/file/image 중 하나(이 목록 밖 값 금지 — checkbox·consent 는
  checkbox_group 으로). checkbox_group·radio 는 options 를 반드시 함께 낸다.
- elements: [ { "id":"e1", "page":1, "rect":[x,y,w,h], "z":1, "widget":"...",
  "field_refs":["<key>"], "option"?:"...", "slot"?:int } ]
  rect 는 0~1 정규화 좌표(이미지 좌상단 기준). 한 위젯이 여러 칸이면 element 를
  나누고 slot 으로 구분한다. 장식(제목/구분선)은 field_refs:[] 로 둔다.
- 출력 형태: { "fields": {...}, "elements": [...] }
"""


class FormSchemaExtractor(Protocol):
    """서식 PNG → {fields, elements} 추출기."""

    async def extract(
        self,
        *,
        png_bytes: bytes,
        page_w: int,
        page_h: int,
        extraction_id: str,
    ) -> dict[str, Any]:
        """{"fields": {...}, "elements": [...]} 반환."""
        ...


class LLMFormSchemaExtractor:
    def __init__(
        self,
        *,
        ai_gateway: AIFacade,
        model: str = _DEFAULT_MODEL,
    ):
        self._ai_gateway = ai_gateway
        self._model = model

    async def extract(
        self,
        *,
        png_bytes: bytes,
        page_w: int,
        page_h: int,
        extraction_id: str,
    ) -> dict[str, Any]:
        data_url = (
            "data:image/png;base64,"
            + base64.b64encode(png_bytes).decode("ascii")
        )
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"이미지 크기: {page_w}x{page_h}px. "
                            "이 서식의 FormSchema(fields, elements)를 JSON 으로 출력하라."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]

        result = await self._ai_gateway.generate_multimodal(
            AICallContext(
                center_id="",
                source_type="form_extraction",
                source_id=extraction_id,
                purpose="form_extract_schema",
            ),
            model=self._model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=16000,
        )

        if not result.ok or not result.content:
            raise RuntimeError(
                f"FormSchema 추출 LLM 호출 실패: {result.error or 'empty'}"
            )

        return _parse_fields_elements(result.content)


def _parse_fields_elements(content: str) -> dict[str, Any]:
    """LLM 출력 문자열 → {fields, elements}. 코드펜스/잡음 방어."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"FormSchema JSON 파싱 실패: {e}") from e

    return {
        "fields": normalize_field_types(data.get("fields") or {}),
        "elements": data.get("elements") or [],
    }


# FormSchema 계약이 받는 타입 — 여기 없는 값이 오면 아래에서 계약 어휘로 접는다.
ALLOWED_FIELD_TYPES = {
    "text", "textarea", "email", "phone", "number", "date", "time", "datetime",
    "select", "radio", "checkbox_group", "signature", "file", "image",
}


def normalize_field_types(fields: dict[str, Any]) -> dict[str, Any]:
    """LLM 타입 어휘 → 계약 어휘 (결정론). checkbox·consent→checkbox_group, 미지→text.

    form_generation.normalize_spec 과 같은 규칙이지만 자료구조가 달라(sections/fields
    리스트 vs fields 딕셔너리) 함수를 공유하지 않는다. 규칙이 바뀌면 두 곳을 함께 고친다.
    모델이 규칙을 어겨도 통과시키는 방어 — 프롬프트(예방)와 짝이다.
    """
    out: dict[str, Any] = {}
    for key, f in (fields or {}).items():
        if not isinstance(f, dict):
            continue
        nf = dict(f)
        ftype = nf.get("type", "text")
        if ftype == "consent":
            nf["type"] = "checkbox_group"
            nf.setdefault(
                "options", [{"value": "agree", "label": "동의합니다", "allow_text": False}]
            )
        elif ftype == "checkbox":
            nf["type"] = "checkbox_group"
        elif ftype not in ALLOWED_FIELD_TYPES:
            nf["type"] = "text"
        # checkbox_group·radio 는 options 가 계약 필수 — 없으면 라벨 하나로 세운다
        if nf["type"] in ("checkbox_group", "radio") and not nf.get("options"):
            nf["options"] = [
                {"value": key, "label": nf.get("label") or key, "allow_text": False}
            ]
        out[key] = nf
    return out
