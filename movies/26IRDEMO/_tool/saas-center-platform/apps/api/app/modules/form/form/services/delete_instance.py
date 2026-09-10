from ..models import FormStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.form.events import FormAtomic
from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class DeleteInstanceService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        instance_id: str,
        center_id: str,
    ) -> tuple[FormAtomic, Form]:
        # verify
        instance = await self.repo.get_in_center(
            instance_id=instance_id,
            center_id=center_id,
        )

        if instance.status != FormStatus.DRAFT:
            raise InvalidOperationException(
                "Only draft instances can be deleted. "
                "Revert to draft first."
            )

        # return
        removed = await self.repo.remove_in_center(
            instance_id=instance_id,
            center_id=center_id,
        )
        return FormAtomic.deleted(form=removed)
