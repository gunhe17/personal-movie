"""query_assessment_participant — 검사 케이스 참여자 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from sqlalchemy import select
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_assessment_participant_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 참여 관계는 case 스코프가 상위에서 강제
    case_id: str | None = None,
    case_ids: list[str] | None = None,
    participant_id: str | None = None,
    role: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "assessment_participant"
    # D13 쌍 — participant_name 원천 id + 표시명은 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "participant_id",
        "participant_name",
    )
    opt_in = ("participant_type",)

    collected_case_ids = list(case_ids or [])
    if case_id:
        collected_case_ids.append(case_id)
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
    AssistantMember = aliased(Member)
    AssistantPerson = aliased(Person)
    participant_name = func.coalesce(Client.name, AssistantPerson.name)

    # filters — 검사 참여자는 is_active 없음, unassigned_at IS NULL 이 활성 동치
    where = [
        AssessmentCaseParticipant.center_id == center_id,
        AssessmentCaseParticipant.deleted_at.is_(None),
        AssessmentCaseParticipant.unassigned_at.is_(None),
    ]
    if collected_case_ids:
        where.append(AssessmentCaseParticipant.case_id.in_(collected_case_ids))
    if collected_participant_ids:
        where.append(
            AssessmentCaseParticipant.participant_id.in_(collected_participant_ids)
        )
    if role:
        where.append(AssessmentCaseParticipant.participant_type == role)

    # project
    stmt = (
        select(
            AssessmentCaseParticipant.id,
            AssessmentCaseParticipant.participant_id,
            AssessmentCaseParticipant.case_id,
            AssessmentCaseParticipant.participant_type,
            AssessmentCase.case_code.label("case_code"),
            participant_name.label("participant_name"),
        )
        .outerjoin(
            AssessmentCase,
            AssessmentCase.id == AssessmentCaseParticipant.case_id,
        )
        .outerjoin(Client, Client.id == AssessmentCaseParticipant.participant_id)
        .outerjoin(
            AssistantMember,
            AssistantMember.id == AssessmentCaseParticipant.participant_id,
        )
        .outerjoin(AssistantPerson, AssistantPerson.id == AssistantMember.person_id)
        .where(*where)
        .order_by(
            AssessmentCaseParticipant.assigned_at.desc(),
            AssessmentCaseParticipant.id,
        )
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
    "name": "query_assessment_participant_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 케이스와 수검자(내담자)의 연결을 조회한다 — 검사케이스↔내담자 양방향 고리.",
    "keywords": [
        "query assessment participant",
        "검사 참여자",
        "수검자",
        "검사 대상",
        "내담자 검사",
    ],
    "boundaries": "검사케이스↔내담자 연결 전용. '내담자가 받은 검사케이스'는 participant_id(내담자 UUID)로, "
    "'검사의 수검자'는 case_id로 조회 후 결과의 case_id/participant_id를 다음 query에 넘긴다.",
    "output": "{rows: [{case_id, case_code, participant_id, participant_name, role}], aggregate: {count, exact}}. 행에 case_code·participant_name 동반. "
    "반환된 case_id를 query_assessment_case_handler(case_ids)·query_assessment_session_handler(case_ids)에 넘겨 잇는다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "검사 케이스 UUID (→수검자)",
            },
            "case_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "검사 케이스 UUID 목록",
            },
            "participant_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 UUID (→받은 검사케이스)",
                "description": "내담자가 받은 검사케이스를 찾을 때",
            },
            "role": {"type": "string", "title": "참여 유형"},
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
