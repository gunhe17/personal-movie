"""query_assessment_case — 검사 케이스 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_assessment_case_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    case_code: str | None = None,
    status: str | None = None,
    tags: list[str] | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    counselor_id: str | None = None,
    client_id: str | None = None,
    client_ids: list[str] | None = None,
    completed_from: str | date | None = None,
    completed_to: str | date | None = None,
    is_final_report_required: bool | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "assessment_case"
    identity = (
        "id",
        "case_code",
        "counselor_id",
    )
    opt_in = (
        "institution_summary",
        "center_id",
    )
    sorts = {
        "latest": AssessmentCase.created_at.desc(),
        "oldest": AssessmentCase.created_at.asc(),
        "completed_latest": AssessmentCase.completed_at.desc(),
        "completed_earliest": AssessmentCase.completed_at.asc(),
    }
    scope_notice = (
        "본인이 담당하거나 참여 검사자로 배정된 케이스만 조회됩니다 — 다른 검사자가 단독 담당한 "
        "케이스는 결과에 없습니다. 그대로 사용자에게 알리세요."
    )
    out_of_scope = (
        "요청한 대상은 내 조회 권한 범위 밖입니다 — 본인이 담당하거나 참여 검사자로 배정된 "
        "데이터만 조회됩니다. 그대로 사용자에게 알리세요."
    )

    def accessible_case_ids(member_id: str):
        """열람 범위 = 주담당 + **활성** 참여 검사자 (unassigned_at IS NULL).

        AssessmentCaseFacade.list_accessible_case_ids 동치 —
        list_case_ids_by_assistant는 unassigned를 거르지 않는다(과거 참여 포함).
        """
        AssistantParticipant = aliased(AssessmentCaseParticipant)
        return (
            select(AssessmentCase.id)
            .where(
                AssessmentCase.center_id == center_id,
                AssessmentCase.counselor_id == member_id,
                AssessmentCase.deleted_at.is_(None),
            )
            .union(
                select(AssistantParticipant.case_id).where(
                    AssistantParticipant.center_id == center_id,
                    AssistantParticipant.participant_id == member_id,
                    AssistantParticipant.participant_type == "assistant",
                    AssistantParticipant.deleted_at.is_(None),
                )
            )
        )

    # filters
    where = [
        AssessmentCase.center_id == center_id,
        AssessmentCase.deleted_at.is_(None),
    ]

    if case_code:
        where.append(AssessmentCase.case_code.ilike(f"%{case_code}%"))
    if status:
        where.append(AssessmentCase.status == status)
    if tags:
        where.append(AssessmentCase.tags.op("&&")(tags))
    if counselor_id:
        where.append(AssessmentCase.counselor_id == counselor_id)
    if is_final_report_required is not None:
        where.append(AssessmentCase.is_final_report_required.is_(is_final_report_required))
    if date_from:
        where.append(
            func.date(AssessmentCase.created_at) >= coerce_date(date_from, "date_from")
        )
    if date_to:
        where.append(
            func.date(AssessmentCase.created_at) <= coerce_date(date_to, "date_to")
        )
    if completed_from:
        where.append(AssessmentCase.completed_at.isnot(None))
        where.append(
            func.date(AssessmentCase.completed_at)
            >= coerce_date(completed_from, "completed_from")
        )
    if completed_to:
        where.append(AssessmentCase.completed_at.isnot(None))
        where.append(
            func.date(AssessmentCase.completed_at)
            <= coerce_date(completed_to, "completed_to")
        )

    all_client_ids = [*(client_ids or []), *([client_id] if client_id else [])]
    if all_client_ids:
        ClientParticipant = aliased(AssessmentCaseParticipant)
        where.append(
            AssessmentCase.id.in_(
                select(ClientParticipant.case_id).where(
                    ClientParticipant.center_id == center_id,
                    ClientParticipant.participant_id.in_(all_client_ids),
                    ClientParticipant.participant_type == "client",
                    ClientParticipant.unassigned_at.is_(None),
                    ClientParticipant.deleted_at.is_(None),
                )
            )
        )

    # scope
    notice = None
    if owner_scope is not None:
        where.append(AssessmentCase.id.in_(accessible_case_ids(owner_scope)))
        if counselor_id and counselor_id != owner_scope:
            notice = scope_notice

    # project
    # client_name — 활성 참여 내담자 이름을 ', '로 연결 (구 denorm 컬럼 대체)
    client_name = func.nullif(
        func.array_to_string(
            func.array_remove(
                func.array_agg(aggregate_order_by(Client.name, Client.id)),
                None,
            ),
            ", ",
        ),
        "",
    )

    stmt = (
        select(
            AssessmentCase.id,
            AssessmentCase.case_code,
            AssessmentCase.center_id,
            AssessmentCase.counselor_id,
            AssessmentCase.status,
            AssessmentCase.tags,
            AssessmentCase.is_final_report_required,
            AssessmentCase.assessment_summary,
            AssessmentCase.set_summary,
            AssessmentCase.institution_summary,
            AssessmentCase.created_at.label("registered_at"),
            Person.name.label("counselor_name"),
            client_name.label("client_name"),
        )
        .outerjoin(Member, Member.id == AssessmentCase.counselor_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .outerjoin(
            AssessmentCaseParticipant,
            (AssessmentCaseParticipant.case_id == AssessmentCase.id)
            & (AssessmentCaseParticipant.participant_type == "client")
            & AssessmentCaseParticipant.unassigned_at.is_(None)
            & AssessmentCaseParticipant.deleted_at.is_(None),
        )
        .outerjoin(Client, Client.id == AssessmentCaseParticipant.participant_id)
        .where(*where)
        .group_by(AssessmentCase.id, Person.name)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), AssessmentCase.id)
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
        limit=limit,
    )

    envelope = {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }
    if owner_scope is not None and count == 0:
        # 필터로 빈 것과 구분 — 접근 가능 케이스 자체가 0일 때만 out_of_scope
        has_accessible = await uow.session.scalar(
            select(func.count()).select_from(
                accessible_case_ids(owner_scope).subquery()
            )
        )
        if not has_accessible:
            envelope["notice"] = out_of_scope
        elif notice:
            envelope["notice"] = notice
    elif notice:
        envelope["notice"] = notice
    return envelope


TOOL = {
    "name": "query_assessment_case_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 케이스를 상태·기간·태그·케이스코드로 유연 조회한다.",
    "keywords": [
        "query assessment case",
        "검사 케이스",
        "검사 접수",
        "케이스 조회",
        "assessment case",
        "검사 상태",
    ],
    "boundaries": "읽기 전용 검사 케이스 조회. 내담자 필터는 client_id(이름은 query_client로 id 확인). 역할·관계 상세는 query_assessment_participant_handler.",
    "output": "{rows: 검사 케이스 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_code": {"type": "string", "title": "케이스 코드 검색"},
            "status": {
                "type": "string",
                "title": "상태",
                "enum": ["pending", "processing", "completed", "cancelled"],
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "title": "태그 필터",
            },
            "date_from": {"type": "string", "format": "date", "title": "접수 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "접수 종료일"},
            "counselor_id": {
                "type": "string",
                "format": "uuid",
                "title": "담당 검사자 UUID",
                "description": "이름은 query_member_handler로 id 확인 후",
            },
            "client_id": {
                "type": "string",
                "title": "내담자 id",
                "description": "이 내담자가 참여한 건으로 필터. 이름은 query_client로 id 확인 후 넘긴다.",
            },
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 id 목록",
                "description": "여러 내담자 참여 건 필터.",
            },
            "completed_from": {
                "type": "string",
                "format": "date",
                "title": "완료일 시작",
            },
            "completed_to": {
                "type": "string",
                "format": "date",
                "title": "완료일 종료",
            },
            "is_final_report_required": {
                "type": "boolean",
                "title": "종합보고서 필요 여부",
            },
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest", "completed_earliest", "completed_latest"],
                "title": "정렬",
                "description": "'최신순/최근'→latest(기본), '오래된 순'→oldest, '완료 이른순'→completed_earliest, '완료 최근순'→completed_latest",
            },
            "limit": {"type": "integer", "title": "최대 개수"},
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
