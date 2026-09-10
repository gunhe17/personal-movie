from app.modules.form.value.models import FormValue
from app.modules.form.value.repository import FormValueRepository


class UpsertAnswersService:
    def __init__(self, repo: FormValueRepository):
        self.repo = repo

    async def execute(
        self,
        instance_id: str,
        center_id: str,
        values: list[dict],
    ) -> list[FormValue]:
        # return
        return await self.repo.bulk_upsert(
            instance_id=instance_id,
            center_id=center_id,
            values=values,
        )
