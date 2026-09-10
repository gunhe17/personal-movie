from ..repository import LabSampleDatasetRepository


class ListFieldNoteCandidatesService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(self, candidates: list[dict]) -> list[dict]:
        # load
        ids = [c["field_note_id"] for c in candidates]
        imported = await self.repo.list_imported_field_note_ids(field_note_ids=ids)

        # return
        return [
            {**c, "already_imported": c["field_note_id"] in imported}
            for c in candidates
        ]
