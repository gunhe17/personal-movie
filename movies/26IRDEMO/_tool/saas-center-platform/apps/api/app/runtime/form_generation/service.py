"""자연어 설명 → FormSchema 초안 생성.

연구(lab-voucher step6: 자연어 → 폼 생성)를 우리 스택에 이식:
  1. LLM(AIGateway.generate_multimodal — OpenRouter) 으로 의미 명세(form_spec) 생성
     — 좌표·픽셀은 다루지 않음(의미/구성만). 출력: {form_title, sections:[{title,fields}]}
  2. normalize_spec: consent/checkbox → checkbox_group, 미지 type → text, repeat → 번호 키
     전개 (결정론 변환)
  3. flow_layout: 명세 → canonical FormSchema. seed_form_templates._flow 규약 +
     라벨 요소 — pages:[] · 값 요소 widget=필드 type · id=필드 키 · 위→아래 선형 rect.
     show_label(기본 true) 필드는 값 위에 widget='label' 요소(text=라벨)를 함께 배치 →
     빌더의 '레이블↔값' 그룹과 동일 표현(문서에 라벨 인쇄, 편집기 round-trip).
     배경 PNG/폰트/스토리지 의존 없음.

OPENROUTER_API_KEY 미설정·LLM/검증 실패 시 결정론 스켈레톤으로 폴백 → 항상 유효 스키마.
"""
from __future__ import annotations

import json
import re

from app.core.logger import get_logger
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .prompts import FORM_DRAFT_SYSTEM_PROMPT

logger = get_logger(__name__)

_MODEL = "google/gemini-2.5-flash"  # form_template 추출과 동일 — 검증된 모델

ALLOWED_TYPES = {
    "text", "textarea", "email", "phone", "number", "date", "time", "datetime",
    "select", "radio", "checkbox_group", "signature", "file", "image",
}
MAX_REPEAT = 6

# 배경 없는 서식도 종이 비율은 선언한다 — rect 가 정규화라 w/h 가 없으면
# 편집기가 캔버스 모양을 임의로 정하게 된다. A4 96dpi.
_A4_PAGE = {"no": 1, "image": None, "w": 794, "h": 1123}


def _height(ftype: str, n_options: int = 0) -> float:
    """필드 타입별 기본 높이 — seed_form_templates._height 와 동일."""
    if ftype in ("radio", "checkbox_group"):
        return round(0.035 + 0.022 * max(n_options, 2), 4)
    return {"textarea": 0.09, "signature": 0.07, "file": 0.07, "image": 0.07}.get(
        ftype, 0.05
    )


def normalize_spec(form: dict) -> dict:
    """LLM 명세를 실 계약 어휘로 정규화 (결정론). consent/checkbox→checkbox_group,
    미지 type→text, repeat>1→번호 키 전개."""
    out: dict = {"form_title": form.get("form_title", ""), "sections": []}
    for sec in form.get("sections", []):
        nsec: dict = {"title": sec.get("title", ""), "fields": []}
        for f in sec.get("fields", []):
            ftype = f.get("type", "text")
            nf = dict(f)
            if ftype == "consent":
                nf["type"] = "checkbox_group"
                nf["options"] = [
                    {"value": "agree", "label": "동의합니다", "allow_text": False}
                ]
            elif ftype == "checkbox":
                nf["type"] = "checkbox_group"
            elif ftype not in ALLOWED_TYPES:
                nf["type"] = "text"
            repeat = max(int(nf.pop("repeat", 1) or 1), 1)
            if repeat > 1:
                for i in range(1, min(repeat, MAX_REPEAT) + 1):
                    rf = dict(nf)
                    rf["key"] = f"{nf['key']}_{i}"
                    rf["label"] = f"{nf.get('label', nf['key'])} ({i})"
                    nsec["fields"].append(rf)
            else:
                nsec["fields"].append(nf)
        out["sections"].append(nsec)
    return out


_LABEL_H = 0.022  # 라벨 요소 높이
_LABEL_GAP = 0.006  # 라벨 ↔ 값 간격
_FIELD_GAP = 0.015  # 필드 ↔ 필드 간격


def flow_layout(norm: dict) -> dict:
    """정규화 명세 → canonical FormSchema (위→아래 선형, 다페이지).

    show_label(기본 True) 필드는 값 요소 위에 widget='label' 요소(id='{key}__label',
    text=라벨)를 함께 배치 → 빌더 parse/build 와 동일한 '레이블↔값' 그룹.
    """
    fields: dict = {}
    elements: list = []
    y, z, page = 0.04, 0, _A4_PAGE["no"]
    for sec in norm.get("sections", []):
        for f in sec.get("fields", []):
            key = f.get("key")
            if not key or key in fields:
                continue  # 키 없음·중복은 건너뜀 (id 유일성 보장)
            fd: dict = {
                "type": f["type"],
                "label": f.get("label", key),
                "required": bool(f.get("required", False)),
            }
            opts = f.get("options")
            if opts:
                fd["options"] = [
                    {
                        "value": str(o.get("value", i)),
                        "label": o.get("label", ""),
                        "allow_text": bool(o.get("allow_text", False)),
                    }
                    for i, o in enumerate(opts)
                ]
            fields[key] = fd

            show_label = bool(f.get("show_label", True))
            h = _height(f["type"], len(opts) if opts else 0)
            block_h = h + (_LABEL_H + _LABEL_GAP if show_label else 0.0)
            if y + block_h > 0.96:  # 라벨+값 블록이 페이지 초과 시 다음 페이지
                page += 1
                y = 0.04

            if show_label:  # 값 위 라벨 요소
                z += 1
                elements.append(
                    {
                        "id": f"{key}__label",
                        "page": page,
                        "rect": [0.08, round(y, 4), 0.84, _LABEL_H],
                        "z": z,
                        "widget": "label",
                        "field_refs": [key],
                        "text": fd["label"],
                    }
                )
                y += _LABEL_H + _LABEL_GAP

            z += 1
            elements.append(
                {
                    "id": key,
                    "page": page,
                    "rect": [0.08, round(y, 4), 0.84, h],
                    "z": z,
                    "widget": f["type"],
                    "field_refs": [key],
                }
            )
            y += h + _FIELD_GAP
    return {"pages": [_A4_PAGE], "fields": fields, "elements": elements}


def _parse_form_spec(raw: str) -> dict:
    t = re.sub(r"^```(?:json)?\s*", "", (raw or "").strip())
    t = re.sub(r"\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if m:
            return json.loads(m.group())
    raise ValueError("form_spec JSON 파싱 실패")


def _skeleton_draft() -> dict:
    """결정론 폴백 (LLM 미사용) — 관례적 신청서 골격."""
    form = {
        "form_title": "새 양식",
        "sections": [
            {
                "title": "기본",
                "fields": [
                    {"key": "applicant_name", "type": "text", "label": "이름", "required": True},
                    {"key": "applicant_phone", "type": "phone", "label": "연락처", "required": True},
                    {"key": "request_content", "type": "textarea", "label": "요청 내용"},
                    {"key": "written_date", "type": "date", "label": "작성일"},
                    {"key": "signature", "type": "signature", "label": "서명", "required": True},
                ],
            }
        ],
    }
    return flow_layout(normalize_spec(form))


async def generate_form_draft(
    description: str,
    *,
    ai_gateway: AIFacade | None = None,
    center_id: str = "",
) -> dict:
    """자연어 설명 → 유효한 FormSchema(dict). 실패 시 스켈레톤 폴백.

    LLM 호출은 AIGateway.generate_multimodal 경유 — quota 체크·사용량 기록 통합.
    ai_gateway=None 또는 OPENROUTER_API_KEY 미설정이면 결정론 스켈레톤 폴백.
    FORM_GENERATE_DRAFT 는 무료 purpose → 기록만, 크레딧 미차감.
    """
    if ai_gateway is None:
        return _skeleton_draft()
    try:
        result = await ai_gateway.generate_multimodal(
            AICallContext(
                center_id=center_id,
                source_type="form_generation",
                purpose=AIPurpose.FORM_GENERATE_DRAFT,
            ),
            model=_MODEL,
            messages=[
                {"role": "system", "content": FORM_DRAFT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"<request>\n{description.strip()}\n</request>\n\n"
                        "위 요청에 맞는 서식의 필드 명세를 지정된 JSON 으로 설계하라. "
                        "JSON 만 출력하라."
                    ),
                },
            ],
            response_format={"type": "json_object"},
            max_tokens=8000,
            temperature=0.4,
        )

        if not result.ok or not result.content:
            raise RuntimeError(result.error or "empty LLM response")
        form = _parse_form_spec(result.content)
        # 평면 fields 형태도 허용 (sections 미사용 시)
        if "sections" not in form and isinstance(form.get("fields"), list):
            form = {
                "form_title": form.get("form_title", ""),
                "sections": [{"title": "", "fields": form["fields"]}],
            }
        schema = flow_layout(normalize_spec(form))
        validate_form_schema(schema)  # 계약 검증 — 실패 시 폴백
        return schema
    except Exception as e:  # noqa: BLE001
        logger.warning("AI 폼 생성 실패 → 스켈레톤 폴백: %s", e)
        return _skeleton_draft()
