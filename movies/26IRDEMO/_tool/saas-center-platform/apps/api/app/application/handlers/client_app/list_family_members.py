from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppFamilyMemberItem
from app.modules.family.facade import FamilyFacade
from app.modules.person.facade import PersonFacade


async def list_family_members_handler(
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> list[AppFamilyMemberItem]:
    async with uow:
        family_facade = FamilyFacade(uow)
        family_id = await family_facade.find_family_id(person_id=person_id)
        if family_id is None:
            return []

        members = await family_facade.list_members(family_id=family_id)
        persons = await PersonFacade(uow).get_persons_by_ids(
            [m.person_id for m in members]
        )
        return [
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
