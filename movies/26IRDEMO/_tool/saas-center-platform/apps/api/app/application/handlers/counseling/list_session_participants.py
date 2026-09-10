from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade import CounselingSessionFacade
from app.modules.client.facade import ClientFacade
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.counseling.counseling_session_participant.schemas import (
    SessionParticipantResponse,
)
from app.modules.counseling.counseling_session_participant.schemas import (
    ParticipantType,
)


async def list_session_participants_handler(
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
) -> list[SessionParticipantResponse]:
    session_facade = CounselingSessionFacade(uow)
    await session_facade.verify_session_readable(session_id, center_id, owner_scope)

    responses = await session_facade.list_participants_with_response(
        session_id=session_id,
        center_id=center_id,
        counselor_id=None,
    )

    client_ids = list(
        set(
            r.participant_id
            for r in responses
            if r.participant_type == ParticipantType.CLIENT.value
        )
    )
    counselor_ids = list(
        set(
            r.participant_id
            for r in responses
            if r.participant_type == ParticipantType.COUNSELOR.value
        )
    )

    client_map: dict[str, object] = {}
    if client_ids:
        clients = await ClientFacade(uow).list_clients_by_ids(client_ids)
        client_map = {c.id: c for c in clients}

    member_name_map: dict[str, str] = {}
    if counselor_ids:
        member_map = await MemberFacade(uow).get_members_by_ids(counselor_ids)
        person_map = await PersonFacade(uow).get_persons_by_ids(
            [m.person_id for m in member_map.values()]
        )
        member_name_map = {
            member_id: (
                person_map[member.person_id].name
                if member.person_id in person_map
                else "Unknown"
            )
            for member_id, member in member_map.items()
        }

    for r in responses:
        if r.participant_type == ParticipantType.CLIENT.value:
            client = client_map.get(r.participant_id)
            if client:
                r.participant_name = client.name
                r.gender = client.gender
                r.birth_date = client.birth_date
        else:
            r.participant_name = member_name_map.get(r.participant_id)

    return responses


TOOL = {
    "name": "list_session_participants_handler",
    "permission": "read:counseling",
    "purpose": "특정 상담 회기에 참여한 내담자와 상담사 목록을 이름·성별·생년월일 등과 함께 조회한다.",
    "keywords": [
        "list session participants",
        "회기 참여자",
        "세션 참석자",
        "참가자 목록",
        "회기 명단",
        "참여 내담자",
        "참여 상담사",
        "출석 대상",
        "세션 멤버",
    ],
    "boundaries": "회기(세션) 하나의 참여자 명단만 조회하는 도구로, 내담자는 이름·성별·생년월일을, 상담사는 이름을 채워 돌려준다. 케이스 전체의 회기·내담자·상담사 상세가 필요하면 get_counseling_case_detail_handler를 쓴다. owner_scope가 있으면 본인 케이스의 회기만 접근 가능하다.",
    "output": "회기 참여자 명단, 내담자·상담사 (SessionParticipantResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "참여자를 조회할 회기(세션)의 UUID.",
            },
        },
        "required": ["session_id"],
    },
}
