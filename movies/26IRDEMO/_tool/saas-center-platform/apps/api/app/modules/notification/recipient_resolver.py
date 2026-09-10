"""알림 수신자 조회 유틸리티

Member ID → account_id 체인으로 수신자 정보를 해석합니다.
알림 생성 시 recipient_id(account_id)를 조회합니다.

모듈 간 의존성 규칙:
- Member/PersonClient(cross-module read 표면)를 통한 접근 (facade·repository 직접 import 금지)
"""
from dataclasses import dataclass

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RecipientInfo:
    account_id: str
    person_name: str | None
    phone: str | None = None


async def resolve_recipients_by_member_ids(
    uow: UnitOfWork,
    member_ids: list[str],
) -> list[RecipientInfo]:
    if not member_ids:
        return []

    from app.modules.center.client import MemberClient
    from app.modules.person.client import PersonClient

    members = await MemberClient(uow).list_by_ids(member_ids)

    if not members:
        return []

    persons = await PersonClient(uow).list_by_ids([m.person_id for m in members])
    person_map = {p.id: p for p in persons}

    recipients: list[RecipientInfo] = []
    for member in members:
        person = person_map.get(member.person_id)
        if not person:
            logger.warning(f"Person not found for member {member.id}")
            continue

        recipients.append(RecipientInfo(
            account_id=person.account_id,
            person_name=person.name,
            phone=person.phone,
        ))

    return recipients


async def resolve_guardian_recipients_by_client_id(
    uow: UnitOfWork,
    center_id: str,
    client_id: str,
) -> list[RecipientInfo]:
    """
    내담자(client_id) → 앱을 쓰는 보호자 계정 목록

    center_links의 person_id는 코드를 입력한 한 명뿐이라 그걸 쓰면 나중에
    합류한 가족은 영영 알림을 못 받는다 — family_id로 갈아타 구성원 전원을 편다.
    """
    from app.modules.center_link.facade import CenterLinkFacade
    from app.modules.family.facade import FamilyFacade
    from app.modules.person.facade import PersonFacade

    links = await CenterLinkFacade(uow).list_links_by_client(
        center_id=center_id, client_id=client_id
    )
    family_ids = {link.family_id for link in links if link.status == "active"}
    if not family_ids:
        return []

    family_facade = FamilyFacade(uow)
    person_ids: set[str] = set()
    for family_id in family_ids:
        members = await family_facade.list_members(family_id=family_id)
        person_ids.update(member.person_id for member in members)

    if not person_ids:
        return []

    person_map = await PersonFacade(uow).get_persons_by_ids(list(person_ids))

    return [
        RecipientInfo(
            account_id=person.account_id,
            person_name=person.name,
            phone=person.phone,
        )
        for person in person_map.values()
        if person.account_id
    ]


