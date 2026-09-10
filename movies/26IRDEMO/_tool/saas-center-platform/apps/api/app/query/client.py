"""query_client — 내담자 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal_column, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.client.client_relation.models import ClientRelation
from app.modules.client.profile.models import Client
from app.modules.client.profile.schemas import ClientRole, ClientStatus, Gender
from app.modules.client.sibling_relation.models import SiblingRelation
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CaseParticipantType,
    CounselingCaseParticipant,
)
from app.infrastructure.persistence.agent_query import fetch


async def query_client_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    name: str | None = None,
    code: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    address: str | None = None,
    memo: str | None = None,
    role: str | None = None,
    status: str | None = None,
    gender: str | None = None,
    birth_date: str | date | None = None,
    ids: list[str] | None = None,
    limit: int | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "client"
    identity = (
        "id",
        "name",
        "code",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "updated_at",
        "children_names",
        "sibling_names",
    )
    sorts = {
        "latest": Client.created_at.desc(),
        "oldest": Client.created_at.asc(),
    }

    def assigned_client_ids(member_id: str):
        """담당 내담자 = 상담+검사 담당 케이스의 **전 참여 내담자**(활성 무관·과거 포함).

        _resolve_assigned_client_ids(list_clients.py) 동치 — 열람 케이스 스코프와 달리
        is_active를 보지 않는다(비대칭이 의도).
        """
        CounselorParticipant = aliased(CounselingCaseParticipant)
        ClientParticipant = aliased(CounselingCaseParticipant)
        AssistantParticipant = aliased(AssessmentCaseParticipant)
        AssessmentClientParticipant = aliased(AssessmentCaseParticipant)

        counseling_cases = select(CounselingCase.id).where(
            CounselingCase.center_id == center_id,
            CounselingCase.counselor_id == member_id,
            CounselingCase.deleted_at.is_(None),
        ).union(
            select(CounselorParticipant.counseling_case_id).where(
                CounselorParticipant.center_id == center_id,
                CounselorParticipant.participant_id == member_id,
                CounselorParticipant.participant_type == CaseParticipantType.COUNSELOR.value,
                CounselorParticipant.deleted_at.is_(None),
            )
        )
        assessment_cases = select(AssessmentCase.id).where(
            AssessmentCase.center_id == center_id,
            AssessmentCase.counselor_id == member_id,
            AssessmentCase.deleted_at.is_(None),
        ).union(
            select(AssistantParticipant.case_id).where(
                AssistantParticipant.center_id == center_id,
                AssistantParticipant.participant_id == member_id,
                AssistantParticipant.participant_type == "assistant",
                AssistantParticipant.deleted_at.is_(None),
            )
        )
        return select(ClientParticipant.participant_id).where(
            ClientParticipant.counseling_case_id.in_(counseling_cases),
            ClientParticipant.participant_type == CaseParticipantType.CLIENT.value,
            ClientParticipant.deleted_at.is_(None),
        ).union(
            select(AssessmentClientParticipant.participant_id).where(
                AssessmentClientParticipant.case_id.in_(assessment_cases),
                AssessmentClientParticipant.participant_type == "client",
                AssessmentClientParticipant.deleted_at.is_(None),
            )
        )

    def relation_names(relation_type: str):
        """{relation_type} 관계 상대 이름 배열 — 바깥 Client 행마다 상관 서브쿼리."""
        Relation, RelatedClient = aliased(ClientRelation), aliased(Client)
        return (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(aggregate_order_by(RelatedClient.name, RelatedClient.id)), None
                    ),
                    # array_agg는 행 0이면 NULL — 구 구현 동치로 빈 배열을 만든다
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(Relation)
            .join(RelatedClient, RelatedClient.id == Relation.related_client_id)
            .where(
                Relation.client_id == Client.id,
                Relation.center_id == Client.center_id,
                Relation.relation_type == relation_type,
                Relation.deleted_at.is_(None),
                RelatedClient.deleted_at.is_(None),
            )
            .correlate(Client)
            .scalar_subquery()
        )

    def sibling_names():
        Sibling, SiblingClient = aliased(SiblingRelation), aliased(Client)
        return (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(aggregate_order_by(SiblingClient.name, SiblingClient.id)), None
                    ),
                    # array_agg는 행 0이면 NULL — 구 구현 동치로 빈 배열을 만든다
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(Sibling)
            .join(SiblingClient, SiblingClient.id == Sibling.sibling_id)
            .where(
                Sibling.client_id == Client.id,
                Sibling.center_id == Client.center_id,
                Sibling.deleted_at.is_(None),
                SiblingClient.deleted_at.is_(None),
            )
            .correlate(Client)
            .scalar_subquery()
        )

    # filters
    where = [
        Client.center_id == center_id,
        Client.deleted_at.is_(None),
    ]

    if ids:
        where.append(Client.id.in_(ids))
    if name:
        where.append(Client.name.like(f"%{name}%"))
    if code:
        where.append(Client.code == code)
    if phone:
        where.append(Client.phone == phone)
    if email:
        where.append(Client.email.ilike(f"%{email}%"))
    if address:
        where.append(Client.address.ilike(f"%{address}%"))
    if memo:
        where.append(Client.memo.ilike(f"%{memo}%"))
    if role:
        where.append(Client.role == role)
    if status:
        where.append(Client.status == status)
    if gender:
        where.append(Client.gender == gender)
    if birth_date:
        where.append(Client.birth_date == coerce_date(birth_date, "birth_date"))
    if date_from:
        where.append(Client.created_at >= datetime.combine(coerce_date(date_from, "date_from"), time.min))
    if date_to:
        where.append(Client.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    if owner_scope is not None:
        where.append(Client.id.in_(assigned_client_ids(owner_scope)))

    # project
    stmt = (
        select(
            Client.id,
            Client.name,
            Client.code,
            Client.role,
            Client.status,
            Client.phone,
            Client.email,
            Client.address,
            Client.gender,
            Client.birth_date,
            Client.memo,
            Client.created_at,
            Client.updated_at,
            relation_names("guardian").label("guardian_names"),
            relation_names("child").label("children_names"),
            sibling_names().label("sibling_names"),
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Client.id)
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

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_client_handler",
    "permission": "read:client",
    "purpose": "내담자를 이름·연락처·상태·성별·생년월일로 유연 조회한다.",
    "keywords": [
        "query client",
        "내담자 조회",
        "내담자 검색",
        "고객 찾기",
        "연락처",
        "내담자 목록",
    ],
    "boundaries": "읽기 전용 단일 엔티티 유연 조회. 지표·서명·출석 패턴 등 집계는 get_client_metrics_handler 등 별도 tool.",
    "output": "{rows: 내담자 dict 배열 (fields로 절삭). 행에 guardian_names(보호자 이름) 동반, fields로 children_names(보호 아동)·sibling_names(형제) 요청 가능., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "이름 검색"},
            "code": {"type": "string", "title": "내담자 코드"},
            "phone": {"type": "string", "title": "전화번호"},
            "email": {"type": "string", "title": "이메일 (부분 매칭)"},
            "address": {"type": "string", "title": "주소 키워드"},
            "memo": {"type": "string", "title": "메모 키워드"},
            "role": {
                "type": "string",
                "title": "역할",
                "enum": [r.value for r in ClientRole],
            },
            "status": {
                "type": "string",
                "title": "상태",
                "enum": [s.value for s in ClientStatus],
            },
            "gender": {
                "type": "string",
                "title": "성별",
                "enum": [g.value for g in Gender],
            },
            "birth_date": {
                "type": "string",
                "format": "date",
                "title": "생년월일",
                "description": "'5살/만 5세'→(올해-5)-01-01 추정, '2018년생'→2018-01-01",
            },
            "ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "내담자 UUID 목록 일괄 조회",
            },
            "limit": {"type": "integer", "title": "최대 개수"},
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest"],
                "description": "'최신순'→latest, '오래된 순'→oldest",
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
