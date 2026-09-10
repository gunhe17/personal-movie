from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class GetInstanceService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        instance_id: str,
        center_id: str,
    ) -> Form:
        # return
        return await self.repo.get_in_center(
            instance_id=instance_id,
            center_id=center_id,
        )
