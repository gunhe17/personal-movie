from app.core.type import utc_dt, uuid_str

from ..repository import LedgerEntryRepository


class CountEntriesByDateService:
    def __init__(
        self,
        repo: LedgerEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        person_id: uuid_str,
        *,
        shared_profile_ids: list[str],
        private_profile_ids: list[str],
        occurred_from: utc_dt,
        occurred_to: utc_dt,
    ) -> dict[str, int]:
        # load
        rows = await self.repo.aggregate_counts_by_date(
            person_id=person_id,
            shared_profile_ids=shared_profile_ids,
            private_profile_ids=private_profile_ids,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

        # return
        return {day: count for day, count in rows}
