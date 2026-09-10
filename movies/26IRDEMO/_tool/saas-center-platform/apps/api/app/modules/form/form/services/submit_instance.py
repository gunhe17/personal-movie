from ..events import FormAtomic
from ..models import FormStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository
from app.core.datetime_utils import utc_now


class SubmitInstanceService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        instance_id: str,
        center_id: str,
        submitted_by: str | None = None,
    ) -> tuple[FormAtomic, Form]:
        # verify
        instance = await self.repo.get_in_center(
            instance_id=instance_id,
            center_id=center_id,
        )

        if instance.status != FormStatus.DRAFT:
            raise InvalidOperationException(
                f"Cannot submit form with status '{instance.status}'. "
                "Only draft forms can be submitted."
            )

        # return
        submitted = await self.repo.update_in_center(
            instance_id=instance_id,
            center_id=center_id,
            status=FormStatus.SUBMITTED,
            submitted_at=utc_now(),
            submitted_by=submitted_by,
        )
        return FormAtomic.submitted(form=submitted)
