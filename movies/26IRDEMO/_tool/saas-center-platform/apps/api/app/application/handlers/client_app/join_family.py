from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import (
    AppFamilyJoinRequest,
    AppFamilyJoinResponse,
    AppFamilyMemberItem,
)
from app.modules.family.facade import FamilyFacade
from app.modules.person.facade import PersonFacade

OWNER_ROLE = "owner"


async def join_family_handler(
    data: AppFamilyJoinRequest,
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> AppFamilyJoinResponse:
    get_rate_limiter().check_and_record(f"app_family_join:{person_id}", limit=10)

    now = utc_now()

    async with uow:
        family_facade = FamilyFacade(uow)
        invitation = await family_facade.get_valid_invitation(code=data.code, now=now)

        if invitation.invited_by_person_id == person_id:
            raise InvalidOperationException("본인이 만든 초대 코드입니다")

        membership = await family_facade.find_membership(person_id=person_id)
        if membership is not None:
            if membership.family_id == invitation.family_id:
                raise InvalidOperationException("이미 이 가족에 속해 있습니다")

            # 합류도 기존 가족을 떠나는 것이다 — leave와 같은 관리자 규칙을 적용하지 않으면
            # 관리자가 이 경로로 빠져나가 주인 없는 가족이 남는다(이양 기능이 없어 복구 불가).
            if membership.role == OWNER_ROLE:
                current_members = await family_facade.list_members(
                    family_id=membership.family_id
                )
                if len(current_members) > 1:
                    raise InvalidOperationException(
                        "관리자는 다른 가족에 합류할 수 없습니다. "
                        "먼저 기존 가족의 구성원을 내보내 주세요."
                    )

            # 남길 데이터가 있으면 조용히 버리지 않고 막는다
            # (자동 병합은 오연결 위험이 커 §7에서 금지).
            profiles = await family_facade.list_profiles(family_id=membership.family_id)
            links = await CenterLinkFacade(uow).list_links_by_family(
                family_id=membership.family_id, alive_only=True
            )
            if profiles or links:
                raise InvalidOperationException(
                    "이미 아이 프로필이나 센터 연결이 있어 합류할 수 없습니다. "
                    "먼저 정리한 뒤 다시 시도해 주세요."
                )
            await family_facade.remove_member(member_id=membership.id)

        await family_facade.add_member(
            family_id=invitation.family_id,
            person_id=person_id,
            role="member",
        )
        await family_facade.claim_invitation(
            invitation_id=invitation.id,
            person_id=person_id,
            now=now,
        )

        members = await family_facade.list_members(family_id=invitation.family_id)
        persons = await PersonFacade(uow).get_persons_by_ids(
            [m.person_id for m in members]
        )
        items = [
            AppFamilyMemberItem(
                id=member.id,
                person_id=member.person_id,
                name=persons[member.person_id].name
                if member.person_id in persons
                else None,
                role=member.role,
            )
            for member in members
        ]
        return AppFamilyJoinResponse(family_id=invitation.family_id, members=items)
