"""query_case_participant — 상담 케이스 참여자 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from sqlalchemy import select
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CounselingCaseParticipant,
)
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_counseling_participant_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 참여 관계는 case 스코프가 상위에서 강제
    counseling_case_id: str | None = None,
    counseling_case_ids: list[str] | None = None,
    participant_id: str | None = None,
    role: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "participant"
    # D13 쌍 — participant_name 원천 id + 표시명은 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "participant_id",
        "participant_name",
    )
    opt_in = (
        "participant_type",
        "is_active",
        "joined_at",
        "left_at",
    )

    collected_case_ids = list(counseling_case_ids or [])
    if counseling_case_id:
        collected_case_ids.append(counseling_case_id)
    collected_participant_ids: list[str] = []
    if participant_id:
        collected_participant_ids.append(participant_id)

    # scope — 앵커(case/participant) 없이는 junction 전량 스캔 금지 (구 repo 동치)
    if not (collected_case_ids or collected_participant_ids):
        return {
            "rows": [],
            "aggregate": {
                "count": 0,
                "exact": True,
            },
        }

    # participant_id 다형(client|member) — 판별자 없이 client 우선, 잔여 member→person
    CounselorMember = aliased(Member)
    CounselorPerson = aliased(Person)
    participant_name = func.coalesce(Client.name, CounselorPerson.name)

    # filters
    where = [
        CounselingCaseParticipant.center_id == center_id,
        CounselingCaseParticipant.deleted_at.is_(None),
        CounselingCaseParticipant.is_active.is_(True),  # facade active_only=True 기본
    ]
    if collected_case_ids:
        where.append(
            CounselingCaseParticipant.counseling_case_id.in_(collected_case_ids)
        )
    if collected_participant_ids:
        where.append(
            CounselingCaseParticipant.participant_id.in_(collected_participant_ids)
        )
    if role:
        where.append(CounselingCaseParticipant.participant_type == role)

    # project
    stmt = (
        select(
            CounselingCaseParticipant.id,
            CounselingCaseParticipant.participant_id,
            CounselingCaseParticipant.counseling_case_id,
            CounselingCaseParticipant.participant_type,
            CounselingCaseParticipant.is_active,
            CounselingCaseParticipant.joined_at,
            CounselingCaseParticipant.left_at,
            CounselingCase.case_code.label("case_code"),
            participant_name.label("participant_name"),
        )
        .outerjoin(
            CounselingCase,
            CounselingCase.id == CounselingCaseParticipant.counseling_case_id,
        )
        .outerjoin(Client, Client.id == CounselingCaseParticipant.participant_id)
        .outerjoin(
            CounselorMember,
            CounselorMember.id == CounselingCaseParticipant.participant_id,
        )
        .outerjoin(CounselorPerson, CounselorPerson.id == CounselorMember.person_id)
        .where(*where)
        .order_by(CounselingCaseParticipant.joined_at.desc(), CounselingCaseParticipant.id)
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        limit=200,  # 구 facade 상한 — TOOL에 limit이 없어 모델이 못 준다
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_counseling_participant_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스와 참여자(내담자·상담사)의 연결을 조회한다 — 케이스↔내담자 양방향 고리.",
    "keywords": [
        "query counseling participant",
        "케이스 참여자",
        "내담자 케이스",
        "누가 참여",
        "참여 케이스",
    ],
    "boundaries": "케이스↔내담자 연결 전용(케이스 구성원 확인·역참조). "
    "단, 내담자의 회기는 query_counseling_session_handler(client_id)로 직행하라 — "
    "이 tool로 case_id를 거칠 필요 없다(서버가 참여 케이스 전체 조인). "
    "'케이스의 참여자 명단'을 볼 때 counseling_case_id로 조회.",
    "output": "{rows: [{counseling_case_id, case_code, participant_id, participant_name, role}], aggregate: {count, exact}}. 행에 case_code 동반. 반환된 counseling_case_id를 query_case_handler(ids)·query_counseling_session_handler(counseling_case_ids)에 넘겨 잇는다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "counseling_case_id": {
                "type": "string",
                "format": "uuid",
                "title": "케이스 UUID (→참여자)",
            },
            "counseling_case_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "케이스 UUID 목록",
            },
            "participant_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자/상담사 UUID (→참여 케이스)",
                "description": "내담자가 참여한 케이스를 찾을 때",
            },
            "role": {
                "type": "string",
                "enum": ["client", "counselor", "observer"],
                "title": "참여 역할",
            },
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
