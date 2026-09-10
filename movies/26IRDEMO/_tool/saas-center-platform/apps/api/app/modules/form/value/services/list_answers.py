from app.modules.form.value.models import FormValue
from app.modules.form.value.repository import FormValueRepository


class ListAnswersService:
    def __init__(self, repo: FormValueRepository):
        self.repo = repo

    async def execute(self, instance_id: str) -> list[FormValue]:
        # return
        return await self.repo.list_by_instance(instance_id=instance_id)
