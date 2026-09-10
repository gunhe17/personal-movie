from app.core.type import uuid_str

from ..repository import LedgerEntryRepository


class MoveEntriesProfileService:
    def __init__(
        self,
        repo: LedgerEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        source_profile_id: uuid_str,
        target_profile_id: uuid_str,
    ) -> int:
        # 가시성 술어를 걸지 않는다 — 프로필 병합은 소유 검증을 마친 가족 단위 일괄 이동이고,
        # 작성자별로 걸러내면 남의 기록만 원본 프로필에 남아 고아가 된다.
        return await self.repo.move_all_in_profile(
            source_profile_id=source_profile_id,
            target_profile_id=target_profile_id,
        )
