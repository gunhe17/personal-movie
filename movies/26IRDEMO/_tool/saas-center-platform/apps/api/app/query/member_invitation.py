"""query_member_invitation — 직원 초대 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import case, literal, select
from sqlalchemy.orm import aliased

from app.core.datetime_utils import coerce_date, utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member_invitation.models import MemberInvitation
from app.modules.person.person.models import Person
from app.modules.role.role.models import Role
from app.infrastructure.persistence.agent_query import fetch


async def query_member_invitation_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — read:member_invitation 게이트의 관리 조회
    status: str | None = None,
    name: str | None = None,
    email: str | None = None,
    employment_type: str | None = None,
    expires_from: str | date | None = None,
    expires_to: str | date | None = None,
    accepted_from: str | date | None = None,
    accepted_to: str | date | None = None,
    role_code: str | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "invitation"
    # D13 쌍 — role_name/role_code→role_id, invited_by_name→invited_by. role_code는 절삭 무관 동반
    identity = (
        "id",
        "name",
        "role_id",
        "invited_by",
        "role_code",
    )
    opt_in = (
        "status",
        "member_id",
    )

    sorts = {
        "latest": MemberInvitation.created_at.desc(),
        "oldest": MemberInvitation.created_at.asc(),
        "accepted_earliest": MemberInvitation.accepted_at.asc(),
        "accepted_latest": MemberInvitation.accepted_at.desc(),
        "expires_earliest": MemberInvitation.expires_at.asc(),
        "expires_latest": MemberInvitation.expires_at.desc(),
    }

    # 파생 상태 — CenterAgentFacade._compute_invitation_status 동치
    now = utc_now()
    invitation_status = case(
        (MemberInvitation.member_id.is_not(None), literal("accepted")),
        (MemberInvitation.deleted_at.is_not(None), literal("cancelled")),
        (MemberInvitation.expires_at < now, literal("expired")),
        else_=literal("pending"),
    )

    Inviter = aliased(Person)  # invited_by = account_id → Person.name

    # filters
    where = [
        MemberInvitation.center_id == center_id,
        MemberInvitation.deleted_at.is_(None),
    ]

    if status == "pending":
        where.append(MemberInvitation.member_id.is_(None))
        where.append(MemberInvitation.expires_at > now)
    elif status == "accepted":
        where.append(MemberInvitation.member_id.is_not(None))
    elif status == "expired":
        where.append(MemberInvitation.member_id.is_(None))
        where.append(MemberInvitation.expires_at <= now)

    if name:
        where.append(MemberInvitation.name.ilike(f"%{name}%"))
    if email:
        where.append(MemberInvitation.email.ilike(f"%{email}%"))
    if employment_type:
        where.append(MemberInvitation.employment_type == employment_type)
    if role_code:
        # FindRoleByCenterAndCode 동치 — center 스코프 코드로 선해소
        where.append(Role.center_id == center_id)
        where.append(Role.code == role_code.upper())
        where.append(Role.deleted_at.is_(None))
    if expires_from:
        where.append(
            MemberInvitation.expires_at
            >= datetime.combine(coerce_date(expires_from, "expires_from"), time.min)
        )
    if expires_to:
        where.append(
            MemberInvitation.expires_at
            <= datetime.combine(coerce_date(expires_to, "expires_to"), time.max)
        )
    if accepted_from:
        where.append(
            MemberInvitation.accepted_at
            >= datetime.combine(coerce_date(accepted_from, "accepted_from"), time.min)
        )
    if accepted_to:
        where.append(
            MemberInvitation.accepted_at
            <= datetime.combine(coerce_date(accepted_to, "accepted_to"), time.max)
        )

    # scope
    # 관리 조회 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            MemberInvitation.id,
            MemberInvitation.name,
            MemberInvitation.email,
            MemberInvitation.employment_type,
            MemberInvitation.role_id,
            MemberInvitation.invited_by,
            MemberInvitation.member_id,
            MemberInvitation.expires_at,
            MemberInvitation.accepted_at,
            invitation_status.label("status"),
            Role.name.label("role_name"),
            Role.code.label("role_code"),
            Inviter.name.label("invited_by_name"),
        )
        .outerjoin(Role, Role.id == MemberInvitation.role_id)
        .outerjoin(
            Inviter,
            (Inviter.account_id == MemberInvitation.invited_by)
            & Inviter.deleted_at.is_(None),
        )
        .where(*where)
        .order_by(
            sorts.get(sort or "latest", sorts["latest"]),
            MemberInvitation.id,
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
    "name": "query_member_invitation_handler",
    "permission": "read:member_invitation",
    "purpose": "직원 초대 현황을 상태·이름으로 유연 조회한다.",
    "keywords": [
        "query member invitation",
        "초대 조회",
        "직원 초대",
        "초대 현황",
        "대기 중 초대",
    ],
    "boundaries": "읽기 전용 초대 유연 조회. 초대 취소·재발송은 write 도구.",
    "output": "{rows: 초대 dict 배열 (fields로 절삭). 행에 role_code·role_name·invited_by_name(초대한 사람) 동반., aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "초대 상태",
                "description": "'대기 중'→pending, '수락됨'→accepted, '만료'→expired",
            },
            "name": {"type": "string", "title": "이름 검색"},
            "email": {"type": "string", "title": "이메일 (부분 매칭)"},
            "employment_type": {
                "type": "string",
                "title": "고용형태",
                "enum": ["FULLTIME", "CONTRACT", "FREELANCER"],
                "description": "'정규직'→FULLTIME, '계약직'→CONTRACT",
            },
            "accepted_from": {
                "type": "string",
                "format": "date",
                "title": "수락일 시작",
            },
            "accepted_to": {"type": "string", "format": "date", "title": "수락일 종료"},
            "expires_from": {
                "type": "string",
                "format": "date",
                "title": "만료일 시작",
            },
            "expires_to": {
                "type": "string",
                "format": "date",
                "title": "만료일 종료",
                "description": "'만료 임박'→expires_to 며칠 뒤",
            },
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "enum": ["COUNSELOR", "MANAGER", "STAFF"],
                "description": "초대 역할로 필터. '상담사'→COUNSELOR, '관리자/매니저'→MANAGER, '직원'→STAFF",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": [
                    "latest",
                    "oldest",
                    "accepted_earliest",
                    "accepted_latest",
                    "expires_earliest",
                    "expires_latest",
                ],
                "description": "'최신순'→latest, '오래된 순'→oldest, '수락 이른순'→accepted_earliest, '수락 최근순'→accepted_latest, '만료 임박순'→expires_earliest, '만료 여유순'→expires_latest",
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
