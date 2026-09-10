from ..events import FormSendAtomic
from ..models import FormSend
from ..repository import FormSendRepository


class CreateFormSendService:
    def __init__(self, repo: FormSendRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        form_template_id: str,
        recipients: list[dict],
        channel: str,
    ) -> tuple[FormSendAtomic, FormSend]:
        # return
        form_send = await self.repo.add(
            center_id=center_id,
            form_template_id=form_template_id,
            recipients=recipients,
            channel=channel,
        )
        return FormSendAtomic.created(form_send=form_send)
