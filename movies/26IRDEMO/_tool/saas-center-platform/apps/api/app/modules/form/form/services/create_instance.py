from ..models import FormStatus
from app.modules.form.form.events import FormAtomic
from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class CreateInstanceService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        template_id: str,
        created_by: str | None = None,
        verification_code: str | None = None,
    ) -> tuple[FormAtomic, Form]:
        # return
        instance = await self.repo.add(
            center_id=center_id,
            template_id=template_id,
            status=FormStatus.DRAFT,
            created_by=created_by,
            verification_code=verification_code,
        )
        return FormAtomic.created(form=instance)
