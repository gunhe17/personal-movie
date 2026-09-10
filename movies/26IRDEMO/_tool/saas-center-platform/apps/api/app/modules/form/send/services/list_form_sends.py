from ..models import FormSend
from ..repository import FormSendRepository


class ListFormSendsService:
    def __init__(self, repo: FormSendRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        form_template_id: str,
    ) -> list[FormSend]:
        # return
        return await self.repo.list_by_template(
            center_id=center_id,
            form_template_id=form_template_id,
        )
