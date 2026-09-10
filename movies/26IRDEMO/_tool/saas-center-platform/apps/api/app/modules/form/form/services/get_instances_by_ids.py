from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class GetInstancesByIdsService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        instance_ids: list[str],
        center_id: str,
    ) -> list[Form]:
        # return
        return await self.repo.list_ids_in_center(
            instance_ids=instance_ids,
            center_id=center_id,
        )
