from datetime import date

from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import ProgramFacade
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.counseling.counseling_note_share.models import NoteShareAudience
from app.modules.counseling.counseling_note_share.schemas import (
    CounselingNoteShareResponse,
)
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingNoteFacade,
    CounselingNoteShareFacade,
    CounselingSessionFacade,
)
from app.modules.event import emit
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.schedule.facade.schedule_facade import ScheduleFacade
from app.runtime.guardian_share.schemas import GuardianShareSource
from app.runtime.guardian_share.service import GenerateGuardianShareService

# 만 나이 기준 — 미성년이면 보호자가 읽는 것으로 본다(상담사가 요청에서 뒤집을 수 있다)
ADULT_AGE = 19

# 목표+진행+다음 합산 최소 글자 수 — 이보다 얇으면 변환이 아니라 창작이 된다
MIN_SOURCE_LENGTH = 40


async def generate_guardian_share_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    client_id: str,
    center_id: str,
    counselor_id: str | None,
    author_id: str,
    audience: str | None,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingNoteShareResponse:
    # 크레딧 게이트·기간 정산은 router 의 require_quota 가 이미 통과시켰다(ai-calling.md).
    session_facade = CounselingSessionFacade(uow)
    session = await session_facade.get_session(session_id, center_id)

    # 케이스 스코프 검증(담당 상담사면 자기 케이스만) + 원문 확보 — LLM 호출 전에 끝낸다
    notes = await CounselingNoteFacade(uow).list_notes_by_session_with_response(
        session_id=session_id,
        center_id=center_id,
        counselor_id=counselor_id,
        client_id=client_id,
        viewer_member_id=author_id,
    )
    note = notes[0] if notes else None
    if note is None:
        raise InvalidOperationException(
            "공유문을 만들 상담 일지가 없습니다. 일지를 먼저 작성해주세요."
        )

    content = note.content or {}
    source_length = sum(
        len((content.get(key) or "").strip())
        for key in ("main_topic", "progress", "next_goal")
    )
    if source_length < MIN_SOURCE_LENGTH:
        # 원문이 얇으면 LLM이 빈칸을 창작으로 메운다(실측: "모래놀이 진행. 특이사항 없음."
        # 22자에서 없는 장면 3개 생성). 지어내게 두느니 상담사에게 돌려보낸다.
        raise InvalidOperationException(
            "일지 내용이 너무 짧아 공유문을 만들 수 없습니다. "
            "상담 목표·진행 내용을 조금 더 적어주세요."
        )

    client = await ClientFacade(uow).find_client_info(client_id)
    if client is None:
        raise InvalidOperationException("내담자를 찾을 수 없습니다.")

    age = _age_of(client.birth_date)
    resolved_audience = _resolve_audience(audience, age)

    case = (await CounselingCaseFacade(uow).get_cases_by_ids(
        [session.counseling_case_id]
    ))
    program_name = None
    program_id = case[0].program_id if case else None
    if program_id:
        programs = await ProgramFacade(uow).get_programs_by_ids([program_id])
        program = programs.get(program_id)
        program_name = program.name if program else None

    source = GuardianShareSource(
        client_name=client.name,
        session_label=_session_label(session.session_number),
        audience=resolved_audience,
        main_topic=content.get("main_topic"),
        progress=content.get("progress"),
        next_goal=content.get("next_goal"),
        summary=note.summary,
        program_name=program_name,
        # 나이는 보호자 톤에서만 쓴다(호칭 판단) — 본인 톤에는 넘기지 않는다
        client_age=age if resolved_audience == NoteShareAudience.GUARDIAN else None,
    )

    draft = await GenerateGuardianShareService(ai=create_ai_facade()).execute(
        source,
        center_id=center_id,
        session_id=session_id,
        member_id=author_id,
    )

    atomic, share = await CounselingNoteShareFacade(uow).upsert_ai_share(
        center_id=center_id,
        session_id=session_id,
        client_id=client_id,
        content=draft.content,
        audience=draft.audience,
        author_id=author_id,
        counseling_note_id=note.id,
        llm_call_id=draft.llm_call_id,
    )
    await emit(
        uow,
        "counseling_note_share_generated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CounselingNoteShareResponse.model_validate(share)


def _resolve_audience(requested: str | None, age: int | None) -> str:
    if requested in (NoteShareAudience.GUARDIAN, NoteShareAudience.SELF):
        return requested
    if age is not None and age >= ADULT_AGE:
        return NoteShareAudience.SELF
    return NoteShareAudience.GUARDIAN


def _age_of(birth_date: date | None) -> int | None:
    if birth_date is None:
        return None
    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def _session_label(session_number: int | None) -> str:
    return f"{session_number}회기" if session_number else "회기"


TOOL = {
    "name": "generate_guardian_share_handler",
    "permission": "write:counseling_note",
    "purpose": "상담 일지를 보호자·본인이 읽을 공유문 초안으로 AI 변환한다.",
    "keywords": [
        "guardian share",
        "보호자 공유문",
        "보호자 안내문 생성",
        "일지 공유문",
        "보호자에게 공유",
    ],
    "boundaries": "일지 → 공유문 '초안' 생성(생성만으로는 앱에 보이지 않는다 — 발행은 publish_note_share_handler). 상담사용 일지 생성은 generate_counseling_note_handler.",
    "output": "생성된 공유문 초안 (CounselingNoteShareResponse, status=draft).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "공유문을 만들 상담 회기의 UUID.",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "공유문 대상 내담자의 UUID.",
            },
            "audience": {
                "type": "string",
                "enum": ["guardian", "self"],
                "title": "읽는 사람",
                "description": "미지정 시 내담자 나이로 판단(만 19세 미만 = guardian).",
            },
        },
        "required": ["session_id", "client_id"],
    },
}
