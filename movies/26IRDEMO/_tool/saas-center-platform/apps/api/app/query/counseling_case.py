"""query_case — 상담 케이스 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date

from sqlalchemy import Date as SQLDate
from sqlalchemy import cast, or_, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.center.program.models import Program
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CaseParticipantType,
    CounselingCaseParticipant,
)
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_case_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    case_code: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    id: str | None = None,
    program_id: str | None = None,
    counselor_id: str | None = None,
    client_id: str | None = None,
    ids: list[str] | None = None,
    program_ids: list[str] | None = None,
    counselor_ids: list[str] | None = None,
    client_ids: list[str] | None = None,
    total_sessions_min: int | None = None,
    total_sessions_max: int | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "case"
    # D13 쌍 — counselor_name·program_name·client_names의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "case_code",
        "counselor_id",
        "program_id",
    )
    opt_in = (
        "chief_complaint",
        "memo",
    )  # select엔 있으나 기본 출력에선 빠짐 — fields로만
    sorts = {
        "latest": CounselingCase.created_at.desc(),
        "oldest": CounselingCase.created_at.asc(),
        "total_sessions_high": CounselingCase.total_sessions.desc(),
        "total_sessions_low": CounselingCase.total_sessions.asc(),
    }
    scope_notice = (
        "본인이 담당하거나 공동 상담사로 참여한 케이스만 조회됩니다 — 다른 상담사가 단독 담당한 "
        "케이스는 결과에 없습니다. 그대로 사용자에게 알리세요."
    )
    out_of_scope = (
        "요청한 대상은 내 조회 권한 범위 밖입니다 — 본인이 담당하거나 공동 상담사로 참여한 "
        "데이터만 조회됩니다. 그대로 사용자에게 알리세요."
    )

    def accessible_case_ids(member_id: str):
        """열람 범위 = 주담당 + **활성** 공동 상담사 — CounselingCaseFacade.list_accessible_case_ids 동치."""
        CounselorParticipant = aliased(CounselingCaseParticipant)  # 바깥 FROM과 자동 correlate 방지
        return select(CounselingCase.id).where(
            CounselingCase.center_id == center_id,
            CounselingCase.counselor_id == member_id,
            CounselingCase.deleted_at.is_(None),
        ).union(
            select(CounselorParticipant.counseling_case_id).where(
                CounselorParticipant.center_id == center_id,
                CounselorParticipant.participant_id == member_id,
                CounselorParticipant.participant_type == CaseParticipantType.COUNSELOR.value,
                CounselorParticipant.is_active.is_(True),
                CounselorParticipant.deleted_at.is_(None),
            )
        )

    # filters
    where = [
        CounselingCase.center_id == center_id,
        CounselingCase.deleted_at.is_(None),
    ]

    all_ids = [*(ids or []), *([id] if id else [])]
    if all_ids:
        where.append(CounselingCase.id.in_(all_ids))
    all_program_ids = [*(program_ids or []), *([program_id] if program_id else [])]
    if all_program_ids:
        where.append(CounselingCase.program_id.in_(all_program_ids))
    all_counselor_ids = [*(counselor_ids or []), *([counselor_id] if counselor_id else [])]
    if all_counselor_ids:
        where.append(CounselingCase.counselor_id.in_(all_counselor_ids))
    if case_code:
        where.append(CounselingCase.case_code == case_code)
    if status:
        where.append(CounselingCase.status == status)
    if keyword:
        where.append(
            or_(
                CounselingCase.chief_complaint.ilike(f"%{keyword}%"),
                CounselingCase.memo.ilike(f"%{keyword}%"),
            )
        )
    if total_sessions_min is not None:
        where.append(CounselingCase.total_sessions >= total_sessions_min)
    if total_sessions_max is not None:
        where.append(CounselingCase.total_sessions <= total_sessions_max)
    if date_from:
        where.append(
            cast(CounselingCase.created_at, SQLDate) >= coerce_date(date_from, "date_from")
        )
    if date_to:
        where.append(
            cast(CounselingCase.created_at, SQLDate) <= coerce_date(date_to, "date_to")
        )

    # 내담자 참여 케이스 역산 — 구 facade는 participant를 20건에서 자르고 필터로 썼다(절삭-선행)
    all_client_ids = [*(client_ids or []), *([client_id] if client_id else [])]
    if all_client_ids:
        ClientParticipant = aliased(CounselingCaseParticipant)
        where.append(
            CounselingCase.id.in_(
                select(ClientParticipant.counseling_case_id).where(
                    ClientParticipant.center_id == center_id,
                    ClientParticipant.participant_id.in_(all_client_ids),
                    ClientParticipant.participant_type
                    == CaseParticipantType.CLIENT.value,
                    ClientParticipant.deleted_at.is_(None),
                )
            )
        )

    # scope
    notice = None
    if owner_scope is not None:
        where.append(CounselingCase.id.in_(accessible_case_ids(owner_scope)))
        # 남의 담당으로 거르면 결과가 "그 상담사 전체"가 아니라 "그중 내가 참여한 것" — 오표기 방지
        if set(all_counselor_ids) - {owner_scope}:
            notice = scope_notice

    # project
    stmt = (
        select(
            CounselingCase.id,
            CounselingCase.case_code,
            CounselingCase.counselor_id,
            CounselingCase.program_id,
            CounselingCase.status,
            CounselingCase.total_sessions,
            CounselingCase.chief_complaint,
            CounselingCase.memo,
            Person.name.label("counselor_name"),
            Program.name.label("program_name"),
            func.array_remove(
                func.array_agg(aggregate_order_by(Client.name, Client.id)), None
            ).label("client_names"),
        )
        .outerjoin(Member, Member.id == CounselingCase.counselor_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .outerjoin(Program, Program.id == CounselingCase.program_id)
        .outerjoin(
            CounselingCaseParticipant,
            (CounselingCaseParticipant.counseling_case_id == CounselingCase.id)
            & (CounselingCaseParticipant.participant_type == CaseParticipantType.CLIENT.value)
            & CounselingCaseParticipant.is_active.is_(True)
            & CounselingCaseParticipant.deleted_at.is_(None),
        )
        .outerjoin(Client, Client.id == CounselingCaseParticipant.participant_id)
        .where(*where)
        .group_by(CounselingCase.id, Person.name, Program.name)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), CounselingCase.id)
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

    # 조용한 치환 금지(L2) — 스코프 밖 요청은 빈 결과에 사유를 붙인다
    if owner_scope is not None and all_ids and count == 0:
        envelope["notice"] = out_of_scope
    elif notice:
        envelope["notice"] = notice
    return envelope


TOOL = {
    "name": "query_case_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스를 담당자·프로그램·상태·기간으로 유연 조회한다.",
    "keywords": [
        "query case",
        "케이스 조회",
        "상담 케이스",
        "내담자 케이스",
        "케이스 검색",
        "상담 사례",
    ],
    "boundaries": "읽기 전용 케이스 조회. 내담자 필터는 client_id(이름은 query_client로 id 확인). 역할·관계 상세는 query_case_participant_handler.",
    "output": "{rows: 케이스 dict 배열 (fields로 절삭). 행에 counselor_name·program_name·client_names(참여 내담자) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_code": {"type": "string", "title": "케이스 코드"},
            "status": {
                "type": "string",
                "title": "상태 필터",
                "enum": ["active", "completed", "cancelled"],
                "description": "'진행 중/활성'→active, '종결/완료'→completed, '취소'→cancelled",
            },
            "keyword": {"type": "string", "title": "키워드 검색"},
            "date_from": {"type": "string", "format": "date", "title": "시작일"},
            "date_to": {"type": "string", "format": "date", "title": "종료일"},
            "id": {"type": "string", "format": "uuid", "title": "케이스 ID"},
            "program_id": {
                "type": "string",
                "format": "uuid",
                "title": "프로그램 필터",
            },
            "counselor_id": {
                "type": "string",
                "format": "uuid",
                "title": "담당 상담사 필터",
            },
            "client_id": {
                "type": "string",
                "title": "내담자 id",
                "description": "이 내담자가 참여한 건으로 필터. 이름은 query_client로 id 확인 후 넘긴다.",
            },
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "케이스 ID 복수",
            },
            "program_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "프로그램 필터 복수",
            },
            "counselor_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "담당 상담사 필터 복수",
            },
            "client_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 id 목록",
                "description": "여러 내담자 참여 건 필터.",
            },
            "total_sessions_min": {"type": "integer", "title": "총 회기 수 하한"},
            "total_sessions_max": {"type": "integer", "title": "총 회기 수 상한"},
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest", "total_sessions_high", "total_sessions_low"],
                "title": "정렬",
                "description": "'최신순/최근'→latest(기본), '회기 많은순'→total_sessions_high",
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
