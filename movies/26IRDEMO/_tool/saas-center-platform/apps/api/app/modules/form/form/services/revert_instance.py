from ..events import FormAtomic
from ..models import FormStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class RevertInstanceService:
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

        if instance.status != FormStatus.SUBMITTED:
            raise InvalidOperationException(
                f"Cannot revert instance with status '{instance.status}'. "
                "Only submitted instances can be reverted."
            )

        # return
        reverted = await self.repo.update_in_center(
            instance_id=instance_id,
            center_id=center_id,
            status=FormStatus.DRAFT,
            submitted_at=None,
        )
        return FormAtomic.reverted(form=reverted)
