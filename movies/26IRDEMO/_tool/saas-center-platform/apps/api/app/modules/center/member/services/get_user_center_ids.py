from ..repository import MemberRepository


class GetUserCenterIdsService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, person_id: str) -> list[str]:
        # load
        members = await self.repo.list_by_person(person_id=person_id)

        # return
        return [member.center_id for member in members]
