# 확정 상담 일지 → 제출 서류(바우처에 걸린 양식) 필드값 변환. 요청형 LLM 1콜.
# DB 쓰기는 하지 않는다 — 변환 결과만 돌려주고 적재(파생 기록 + 양식 인스턴스)는
# application handler 소유다(guardian_share 와 같은 규칙).
#
# 양식을 '설계'하는 기존 AI 초안(form/template/router.py /draft · runtime/form_generation)과
# 다른 물건이다. 저쪽은 빈 양식의 필드를 만들고, 이쪽은 이미 있는 양식의 칸을 일지로 채운다.
import json
import logging
import re

from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

logger = logging.getLogger(__name__)

# ProductionAIConfig(ai_lab) 조회 키 — 제출처 양식은 기관마다 어휘가 달라 따로 튜닝된다
CONFIG_STEP = "note_derive_form"
DEFAULT_MODEL = "gpt-4o"

_FIELD_LIMIT = 4000

SYSTEM_PROMPT = """당신은 상담센터의 행정 담당자입니다. 상담사가 쓴 확정 상담 일지를
바우처 제출 서류(양식)의 각 칸으로 옮깁니다.

## 원칙
- 일지에 있는 말만 옮긴다. 일지에 근거가 없는 칸은 값을 만들지 말고 생략한다.
- 진단 표기·검사 점수(예: K-CBCL T 68, F93.8 R/O)는 제출 서류에 옮기지 않는다.
- 요약하되 다시 쓰지 않는다 — 일지의 문장을 그대로 살리는 쪽을 택한다.
- select/radio 칸은 주어진 선택지 value 중 하나를 정확히 그대로 쓴다.
- date 는 YYYY-MM-DD, number 는 숫자만 쓴다.

## 출력
{"values": {"<필드키>": "<값>", ...}} 형식의 JSON만 출력한다. 설명 문장을 덧붙이지 않는다."""


class DeriveSubmissionFormService:
    def __init__(self, *, ai: AIFacade):
        self._ai = ai

    async def execute(
        self,
        *,
        center_id: str,
        session_id: str,
        member_id: str | None,
        note_content: dict,
        note_summary: str | None,
        client_name: str,
        session_number: int | None,
        session_date: str | None,
        template_name: str,
        schema_fields: dict,
    ) -> tuple[dict, str | None]:
        """(필드값 dict, llm_call_id) 를 돌려준다."""
        config = await self._ai.resolve_config(CONFIG_STEP, module="counseling")
        config = {**config, "model_name": config.get("model_name") or DEFAULT_MODEL}
        system_prompt = config.get("system_prompt") or SYSTEM_PROMPT

        ctx = AICallContext(
            center_id=center_id,
            source_type="counseling",
            source_id=session_id,
            purpose=AIPurpose.COUNSELING_NOTE_DERIVE,
            pipeline_step=CONFIG_STEP,
            member_id=member_id or None,
        )
        result = await self._ai.generate_json(
            ctx,
            system_prompt,
            _build_user_prompt(
                note_content=note_content,
                note_summary=note_summary,
                client_name=client_name,
                session_number=session_number,
                session_date=session_date,
                template_name=template_name,
                schema_fields=schema_fields,
            ),
            resolved_config=config,
        )
        if not result.content:
            raise ValueError("제출 서류 초안 응답이 비었습니다.")

        return _parse_values(result.content, schema_fields), result.llm_call_id


def _build_user_prompt(
    *,
    note_content: dict,
    note_summary: str | None,
    client_name: str,
    session_number: int | None,
    session_date: str | None,
    template_name: str,
    schema_fields: dict,
) -> str:
    head = [f"- 내담자: {client_name}", f"- 양식: {template_name}"]
    if session_number:
        head.append(f"- 회기: {session_number}회기")
    if session_date:
        head.append(f"- 회기 일자: {session_date}")

    sections = [
        ("상담 목표", note_content.get("main_topic")),
        ("진행 내용", note_content.get("progress")),
        ("다음 상담 내용", note_content.get("next_goal")),
        ("개입 방법", note_content.get("intervention")),
        ("종합 소견", note_summary),
    ]
    body = "\n\n".join(
        f"--- {label} ---\n{(value or '').strip()[:_FIELD_LIMIT]}"
        for label, value in sections
        if value and str(value).strip()
    )

    # 개인 메모(private_notes)는 재료에 넣지 않는다 — 제출처가 읽을 문서다
    return (
        "아래 상담 일지를 이 양식의 칸으로 옮겨주세요.\n\n"
        + "\n".join(head)
        + "\n\n--- 양식 필드 ---\n"
        + _describe_fields(schema_fields)
        + "\n\n--- 상담 일지 ---\n"
        + body
        + '\n\n{"values": {...}} 형식의 JSON만 출력해주세요.'
    )


def _describe_fields(schema_fields: dict) -> str:
    lines = []
    for key, field in schema_fields.items():
        desc = f"- {key} ({field.get('type')}): {field.get('label') or key}"
        options = field.get("options") or []
        if options:
            desc += " / 선택지: " + ", ".join(
                str(o.get("value")) for o in options if o.get("value")
            )
        if field.get("required"):
            desc += " [필수]"
        lines.append(desc)
    return "\n".join(lines)


def _parse_values(raw: str, schema_fields: dict) -> dict:
    text = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("제출 서류 초안 JSON 파싱 실패")
        parsed = json.loads(match.group())

    values = parsed.get("values") if isinstance(parsed.get("values"), dict) else parsed

    # 스키마에 없는 키는 버린다 — 모델이 지어낸 칸이 양식에 끼어들지 않게 한다
    cleaned: dict = {}
    for key, value in values.items():
        if key not in schema_fields:
            logger.warning("스키마에 없는 필드를 버린다: %s", key)
            continue
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        cleaned[key] = value.strip() if isinstance(value, str) else value
    if not cleaned:
        raise ValueError("제출 서류 초안 내용이 비었습니다.")
    return cleaned
