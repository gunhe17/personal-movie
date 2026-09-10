from app.core.datetime_utils import utc_now
from app.core.exceptions import PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppFamilyInvitationResponse
from app.modules.family.facade import FamilyFacade

OWNER_ROLE = "owner"


async def issue_family_invitation_handler(
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> AppFamilyInvitationResponse:
    now = utc_now()

    async with uow:
        family_facade = FamilyFacade(uow)
        membership = await family_facade.find_membership(person_id=person_id)
        if membership is None or membership.role != OWNER_ROLE:
            raise PermissionDeniedException("가족 초대는 관리자만 보낼 수 있습니다")

        invitation = await family_facade.issue_invitation(
            family_id=membership.family_id,
            invited_by_person_id=person_id,
            now=now,
        )
        return AppFamilyInvitationResponse.model_validate(invitation)
