# 상담 일지 → 보호자·본인용 공유문 변환 (요청형 LLM 1콜).
# DB 쓰기는 하지 않는다 — 변환 결과만 돌려주고 적재는 application handler 소유.
import json
import logging
import re

from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext

from .prompts import CONFIG_STEP_BY_AUDIENCE, SYSTEM_PROMPT_BY_AUDIENCE
from .schemas import GuardianShareDraft, GuardianShareSource

logger = logging.getLogger(__name__)

CONTENT_KEYS = ("text",)

# 기본 요약 모델(gpt-4o-mini)로는 임상어 번역·삭제 규칙이 절반쯤 흘렀다 — 프롬프트 앞뒤는
# 지키고 중간 규칙을 무시하는 양상(2026-08-28 실측). 같은 프롬프트로 모델만 올리니 해소돼
# 이 단계는 기본값을 올려 잡는다. ai_lab ProductionAIConfig 가 있으면 그쪽이 이긴다.
DEFAULT_MODEL = "gpt-4o"

# 원문 필드가 길어도 회기 하나분이라 상한은 넉넉하다. 상한 자체는 프롬프트 폭주 방지용.
_FIELD_LIMIT = 4000


class GenerateGuardianShareService:
    def __init__(self, *, ai: AIFacade):
        self._ai = ai

    async def execute(
        self,
        source: GuardianShareSource,
        *,
        center_id: str,
        session_id: str,
        member_id: str | None = None,
    ) -> GuardianShareDraft:
        # 톤별 config 슬롯 — 한 슬롯을 공유하면 운영자가 프롬프트를 고칠 때 두 톤이 뭉개진다
        # (보호자용으로 튜닝한 문구가 성인 본인에게도 나감)
        step = CONFIG_STEP_BY_AUDIENCE.get(
            source.audience, CONFIG_STEP_BY_AUDIENCE["guardian"]
        )
        config = await self._ai.resolve_config(step, module="counseling")
        config = {**config, "model_name": config.get("model_name") or DEFAULT_MODEL}
        system_prompt = config.get("system_prompt") or SYSTEM_PROMPT_BY_AUDIENCE.get(
            source.audience, SYSTEM_PROMPT_BY_AUDIENCE["guardian"]
        )

        ctx = AICallContext(
            center_id=center_id,
            source_type="counseling",
            source_id=session_id,
            purpose=AIPurpose.COUNSELING_GUARDIAN_SHARE,
            pipeline_step=step,
            member_id=member_id or None,
        )
        result = await self._ai.generate_json(
            ctx,
            system_prompt,
            _build_user_prompt(source),
            resolved_config=config,
        )
        if not result.content:
            raise ValueError("공유문 생성 응답이 비었습니다.")

        return GuardianShareDraft(
            content=_parse_content(result.content),
            audience=source.audience,
            llm_call_id=result.llm_call_id,
        )


def _build_user_prompt(source: GuardianShareSource) -> str:
    lines = [
        f"- 내담자: {source.client_name}",
        f"- 회기: {source.session_label}",
    ]
    if source.program_name:
        lines.append(f"- 프로그램: {source.program_name}")
    if source.audience == "guardian" and source.client_age is not None:
        lines.append(f"- 내담자 나이: 만 {source.client_age}세")

    sections = [
        ("상담 목표", source.main_topic),
        ("진행 내용", source.progress),
        ("다음 상담 내용", source.next_goal),
        ("종합 소견", source.summary),
    ]
    body = "\n\n".join(
        f"--- {label} ---\n{(value or '').strip()[:_FIELD_LIMIT]}"
        for label, value in sections
        if value and value.strip()
    )

    # 원문에 없는 대목은 "쓰지 마라"를 그 자리에서 명시한다 — 다섯 칸 시절엔 코드가 비웠지만
    # 한 편의 글에는 1:1 대응 칸이 없어 사후 판정이 불가능하다
    absent = []
    if not (source.next_goal or "").strip():
        absent.append("이 일지에는 다음 상담 계획이 없다. 다음 시간에 대한 언급을 쓰지 마라.")

    return (
        "다음은 상담사가 임상 기록용으로 작성한 상담 일지입니다.\n\n"
        + "\n".join(lines)
        + "\n\n"
        + body
        + ("\n\n" + "\n".join(absent) if absent else "")
        + "\n\n위 일지를 지침에 따라 전달문으로 옮겨주세요."
    )


def _parse_content(raw: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("공유문 JSON 파싱 실패")
        parsed = json.loads(match.group())

    # 키 화이트리스트 — 모델이 덧붙인 키(진단 소견 등)가 앱까지 새지 않게 여기서 막는다
    content: dict = {}
    for key in CONTENT_KEYS:
        value = parsed.get(key)
        if isinstance(value, list):
            value = " ".join(str(v) for v in value if v)
        content[key] = value.strip() if isinstance(value, str) and value.strip() else None
    if not any(content.values()):
        raise ValueError("공유문 내용이 비었습니다.")
    return content
