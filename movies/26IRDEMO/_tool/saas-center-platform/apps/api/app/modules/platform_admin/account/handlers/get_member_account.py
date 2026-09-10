from sqlalchemy import select, func

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.auth.account.models import Account
from app.modules.person.person.models import Person
from app.modules.person.credential.models import PersonCredential
from app.modules.center.member.models import Member
from app.modules.center.center.models import Center
from app.modules.role.role.models import Role
from app.modules.platform_admin.account.schemas import (
    AdminAccountDetailResponse,
    AdminAccountCenter,
    AdminAccountCredentialStats,
)


async def get_member_account_handler(
    account_id: str,
    uow: UnitOfWork,
) -> AdminAccountDetailResponse:
    session = uow.session

    stmt = (
        select(Account, Person)
        .outerjoin(Person, Person.account_id == Account.id)
        .where(
            Account.id == account_id,
            Account.deleted_at.is_(None),
        )
    )
    row = (await session.execute(stmt)).first()

    if not row:
        raise EntityNotFoundException(f"Account not found: {account_id}")

    account, person = row

    centers: list[AdminAccountCenter] = []
    if person:
        center_stmt = (
            select(Member, Center, Role)
            .join(Center, Member.center_id == Center.id)
            .join(Role, Member.role_id == Role.id)
            .where(
                Member.person_id == person.id,
                Member.deleted_at.is_(None),
                Center.deleted_at.is_(None),
            )
            .order_by(Member.created_at.asc())
        )
        center_rows = (await session.execute(center_stmt)).all()

        centers = [
            AdminAccountCenter(
                center_id=center.id,
                center_name=center.name,
                role_name=role.name,
                status=member.status,
            )
            for member, center, role in center_rows
        ]

    credentials_stats = AdminAccountCredentialStats()
    if person:
        stats_stmt = (
            select(
                PersonCredential.credential_type,
                PersonCredential.status,
                func.count().label("cnt"),
            )
            .where(
                PersonCredential.person_id == person.id,
                PersonCredential.deleted_at.is_(None),
            )
            .group_by(
                PersonCredential.credential_type,
                PersonCredential.status,
            )
        )
        for credential_type, status, cnt in (await session.execute(stats_stmt)).all():
            credentials_stats.total += cnt
            if status == "pending":
                credentials_stats.pending += cnt
            elif status == "verified":
                credentials_stats.verified += cnt
                if credential_type == "certification":
                    credentials_stats.verified_certifications += cnt
                elif credential_type == "education":
                    credentials_stats.verified_educations += cnt
            elif status == "rejected":
                credentials_stats.rejected += cnt
        # is_certified는 Person.is_certified 캐시 값 사용 (정책 일원화)
        credentials_stats.is_certified = bool(person.is_certified)

    return AdminAccountDetailResponse(
        id=account.id,
        email=account.email,
        name=person.name if person else None,
        phone=person.phone if person else None,
        provider=account.provider,
        is_active=account.is_active,
        is_verified=account.is_verified,
        last_login_at=account.last_login_at,
        created_at=account.created_at,
        centers=centers,
        credentials=credentials_stats,
    )


TOOL = {
    "name": "get_member_account_handler",
    "permission": None,
    "purpose": "플랫폼 사용자(상담사·회원) 계정 상세를 운영자가 조회한다.",
    "keywords": ["회원 계정 상세", "사용자 계정 조회", "상담사 계정", "member account"],
    "boundaries": "운영자 전용 — 플랫폼 사용자 계정 상세(소속 센터·자격 포함, 읽기). 운영자(어드민) 계정 관리는 get_admin_account_handler.",
    "output": "사용자 계정 상세 — 소속 센터·자격 통계 포함 (AdminAccountDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 계정",
                "description": "조회할 사용자 계정의 UUID.",
            },
        },
        "required": ["account_id"],
    },
}
