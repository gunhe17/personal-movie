"""query_member — 센터 구성원 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.person.person.models import Person
from app.modules.role.role.models import Role
from app.infrastructure.persistence.agent_query import fetch


async def query_member_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 구성원은 센터 관리 조회라 무시(센터 전체)
    name: str | None = None,
    role_code: str | None = None,
    status: str | None = None,
    employment_type: str | None = None,
    memo: str | None = None,
    hire_from: str | date | None = None,
    hire_to: str | date | None = None,
    id: str | None = None,
    ids: list[str] | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "member"
    # D13 쌍 — role_name/role_code 원천은 role_id. name·role_code는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "person_id",
        "role_id",
        "name",
        "role_code",
    )
    opt_in = (
        "color",
        "profile_image_url",
        "birth",
        "gender",
    )

    sorts = {
        "latest": Member.created_at.desc(),
        "oldest": Member.created_at.asc(),
        "hire_earliest": Member.hire_date.asc(),
        "hire_latest": Member.hire_date.desc(),
    }

    # filters
    where = [
        Member.center_id == center_id,
        Member.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(Member.id.in_(collected))

    if name:
        where.append(Person.name.ilike(f"%{name}%"))
    if role_code:
        # FindRoleByCenterAndCode 동치 — center 스코프 코드로 선해소
        where.append(Role.center_id == center_id)
        where.append(Role.code == role_code.upper())
        where.append(Role.deleted_at.is_(None))
    if status:
        where.append(Member.status == status)
    if employment_type:
        where.append(Member.employment_type == employment_type)
    if memo:
        where.append(Member.memo.ilike(f"%{memo}%"))
    if hire_from:
        where.append(Member.hire_date >= coerce_date(hire_from, "hire_from"))
    if hire_to:
        where.append(Member.hire_date <= coerce_date(hire_to, "hire_to"))

    # scope
    # 센터 관리 조회 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            Member.id,
            Member.person_id,
            Member.role_id,
            Member.status,
            Member.employment_type,
            Member.memo,
            Member.hire_date,
            Member.color,
            Member.profile_image_url,
            Person.name.label("name"),
            Person.phone.label("phone"),
            Person.birth.label("birth"),
            Person.gender.label("gender"),
            Role.name.label("role_name"),
            Role.code.label("role_code"),
        )
        .outerjoin(Person, Person.id == Member.person_id)
        .outerjoin(Role, Role.id == Member.role_id)
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Member.id)
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
    "name": "query_member_handler",
    "permission": "read:member",
    "purpose": "센터 구성원(멤버)을 역할·상태·고용형태로 유연 조회한다.",
    "keywords": [
        "query member",
        "구성원 조회",
        "멤버",
        "직원",
        "상담사 목록",
        "스태프 검색",
    ],
    "boundaries": "읽기 전용 단일 엔티티 유연 조회. 센터 관리 조회라 access_level과 무관하게 센터 전체를 본다.",
    "output": "{rows: 구성원 dict 배열 (fields로 절삭). 행에 role_name(역할 표시명)·role_code 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "title": "직원/상담사 이름 (부분 매칭, 호칭 제거)",
                "description": "내담자 이름은 query_client_handler",
            },
            "role_code": {
                "type": "string",
                "title": "역할 코드",
                "enum": ["COUNSELOR", "MANAGER", "STAFF"],
                "description": "'상담사/선생님'→COUNSELOR, '관리자/원장'→MANAGER, '직원'→STAFF",
            },
            "status": {
                "type": "string",
                "title": "상태",
                "enum": ["active", "inactive"],
                "description": "'재직 중'→active, '퇴사/비활성'→inactive",
            },
            "employment_type": {
                "type": "string",
                "title": "고용형태",
                "enum": ["FULLTIME", "CONTRACT", "FREELANCER"],
                "description": "'정규직'→FULLTIME, '계약직'→CONTRACT, '프리랜서'→FREELANCER",
            },
            "memo": {"type": "string", "title": "메모 검색"},
            "hire_from": {"type": "string", "format": "date", "title": "입사일 시작"},
            "hire_to": {"type": "string", "format": "date", "title": "입사일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "단건 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "ID 목록",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest", "hire_earliest", "hire_latest"],
                "description": "'최신순'→latest, '오래된 순'→oldest, '입사 오래된순'→hire_earliest, '입사 최근순'→hire_latest",
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
