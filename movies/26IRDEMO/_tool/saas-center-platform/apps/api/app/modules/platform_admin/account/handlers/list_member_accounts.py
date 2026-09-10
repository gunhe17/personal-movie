from sqlalchemy import select, func, or_

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.account.models import Account
from app.modules.person.person.models import Person
from app.modules.person.credential.models import PersonCredential
from app.modules.center.member.models import Member
from app.modules.center.center.models import Center
from app.modules.role.role.models import Role
from app.modules.platform_admin.account.schemas import (
    AdminAccountSummary,
    AdminAccountCenter,
    AdminAccountCredentialStats,
    AdminAccountListResponse,
)


async def list_member_accounts_handler(
    uow: UnitOfWork,
    *,
    search: str | None = None,
    is_active: bool | None = None,
    provider: str | None = None,
    has_pending_credentials: bool | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminAccountListResponse:
    session = uow.session

    # 기본 조건: soft delete 제외
    conditions = [Account.deleted_at.is_(None)]

    # 상태 필터
    if is_active is not None:
        conditions.append(Account.is_active.is_(is_active))

    # 가입 방식 필터
    if provider:
        conditions.append(Account.provider == provider)

    # 검색 (이메일 또는 이름)
    if search:
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                Account.email.ilike(search_pattern),
                Person.name.ilike(search_pattern),
            )
        )

    # 검증 대기 필터: pending credential이 있는 account만
    # PersonCredential은 person_id 기반이라 Person JOIN 필수
    needs_credential_filter = has_pending_credentials is True
    needs_person_join = bool(search) or needs_credential_filter

    if needs_credential_filter:
        pending_account_subq = (
            select(Person.account_id)
            .join(PersonCredential, PersonCredential.person_id == Person.id)
            .where(
                PersonCredential.status == "pending",
                PersonCredential.deleted_at.is_(None),
                Person.account_id.is_not(None),
            )
            .distinct()
        )
        conditions.append(Account.id.in_(pending_account_subq))

    # count
    if needs_person_join:
        count_stmt = (
            select(func.count(func.distinct(Account.id)))
            .select_from(Account)
            .outerjoin(Person, Person.account_id == Account.id)
            .where(*conditions)
        )
    else:
        count_stmt = select(func.count()).select_from(Account).where(*conditions)
    total = (await session.execute(count_stmt)).scalar_one()

    # 페이징
    offset = (page - 1) * size

    # 메인 쿼리: Account + Person LEFT JOIN
    stmt = (
        select(Account, Person)
        .outerjoin(Person, Person.account_id == Account.id)
        .where(*conditions)
        .order_by(Account.created_at.desc())
        .offset(offset)
        .limit(size)
    )

    rows = (await session.execute(stmt)).all()

    # 소속 센터 정보 조회 (배치)
    account_ids = [account.id for account, _ in rows]
    centers_map: dict[str, list[AdminAccountCenter]] = {aid: [] for aid in account_ids}

    if account_ids:
        # Person ID 매핑
        person_ids = [person.id for _, person in rows if person]
        person_account_map = {
            person.id: account.id for account, person in rows if person
        }

        if person_ids:
            center_stmt = (
                select(Member.person_id, Center.id, Center.name, Role.name)
                .join(Center, Member.center_id == Center.id)
                .join(Role, Member.role_id == Role.id)
                .where(
                    Member.person_id.in_(person_ids),
                    Member.deleted_at.is_(None),
                    Center.deleted_at.is_(None),
                )
            )
            center_rows = (await session.execute(center_stmt)).all()

            for person_id, center_id, center_name, role_name in center_rows:
                account_id = person_account_map.get(person_id)
                if account_id and account_id in centers_map:
                    centers_map[account_id].append(
                        AdminAccountCenter(
                            center_id=center_id,
                            center_name=center_name,
                            role_name=role_name,
                            status="active",
                        )
                    )

    # 자격 검증 통계 일괄 집계 (status별 카운트)
    credentials_map: dict[str, AdminAccountCredentialStats] = {
        aid: AdminAccountCredentialStats() for aid in account_ids
    }
    if account_ids:
        person_ids = [person.id for _, person in rows if person]
        person_account_map = {
            person.id: account.id for account, person in rows if person
        }
        if person_ids:
            # credential_type × status 조합으로 집계 → is_certified 판정도 동시에
            stats_stmt = (
                select(
                    PersonCredential.person_id,
                    PersonCredential.credential_type,
                    PersonCredential.status,
                    func.count().label("cnt"),
                )
                .where(
                    PersonCredential.person_id.in_(person_ids),
                    PersonCredential.deleted_at.is_(None),
                )
                .group_by(
                    PersonCredential.person_id,
                    PersonCredential.credential_type,
                    PersonCredential.status,
                )
            )
            stats_rows = (await session.execute(stats_stmt)).all()
            for person_id, credential_type, status, cnt in stats_rows:
                account_id = person_account_map.get(person_id)
                if not account_id or account_id not in credentials_map:
                    continue
                stats = credentials_map[account_id]
                stats.total += cnt
                if status == "pending":
                    stats.pending += cnt
                elif status == "verified":
                    stats.verified += cnt
                    if credential_type == "certification":
                        stats.verified_certifications += cnt
                    elif credential_type == "education":
                        stats.verified_educations += cnt
                elif status == "rejected":
                    stats.rejected += cnt

            # is_certified는 Person.is_certified 캐시 값 사용 (정책 일원화)
            for _, person in rows:
                if not person:
                    continue
                account_id = person_account_map.get(person.id)
                if not account_id or account_id not in credentials_map:
                    continue
                credentials_map[account_id].is_certified = bool(person.is_certified)

    items = [
        AdminAccountSummary(
            id=account.id,
            email=account.email,
            name=person.name if person else None,
            phone=person.phone if person else None,
            provider=account.provider,
            is_active=account.is_active,
            is_verified=account.is_verified,
            last_login_at=account.last_login_at,
            created_at=account.created_at,
            centers=centers_map.get(account.id, []),
            credentials=credentials_map.get(account.id, AdminAccountCredentialStats()),
        )
        for account, person in rows
    ]

    return AdminAccountListResponse.build(
        items=items,
        total=total,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_member_accounts_handler",
    "permission": None,
    "purpose": "플랫폼 사용자(상담사·회원) 계정 목록을 운영자가 조회한다.",
    "keywords": [
        "회원 계정 목록",
        "사용자 계정 조회",
        "상담사 목록",
        "member accounts",
    ],
    "boundaries": "운영자 전용 — 플랫폼 사용자 계정 목록(읽기). 단건은 get_member_account_handler. 운영자 계정 목록은 list_member_accounts_handler.",
    "output": "사용자 계정 목록 (AdminAccountListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "이름·이메일 검색어(선택).",
            },
            "is_active": {
                "type": "boolean",
                "title": "활성 여부 필터",
                "description": "활성 계정만/비활성만 필터(선택).",
            },
            "provider": {
                "type": "string",
                "title": "가입 경로 필터",
                "description": "소셜 로그인 제공자 필터(선택).",
            },
            "has_pending_credentials": {
                "type": "boolean",
                "title": "검증 대기 자격 보유",
                "description": "검증 대기 자격이 있는 계정만 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
