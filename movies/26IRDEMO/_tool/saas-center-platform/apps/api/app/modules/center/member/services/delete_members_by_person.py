from ..events import MemberAtomic
from ..repository import MemberRepository


class DeleteMembersByPersonService:
    def __init__(
        self,
        repo: MemberRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
    ) -> tuple[list[MemberAtomic], int]:
        # load
        members = await self.repo.list_by_person(person_id=person_id)

        # delete (회원탈퇴 — 전 센터 멤버십 소프트 삭제)
        atomics: list[MemberAtomic] = []
        for member in members:
            removed = await self.repo.remove_by_id(id=member.id)
            if removed:
                atomic, _ = MemberAtomic.deleted(member=removed)
                atomics.append(atomic)

        # return
        return atomics, len(members)
