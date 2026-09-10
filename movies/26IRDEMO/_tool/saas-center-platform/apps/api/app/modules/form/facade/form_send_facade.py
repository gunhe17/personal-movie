from app.core.config import settings
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..send.events import FormSendAtomic
from ..send.models import FormSend
from ..send.repository import FormSendRepository
from ..send.schemas import FormSendCreate
from ..send.services import (
    CreateFormSendService,
    GetFormSendService,
    ListFormSendsService,
)


class FormSendFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_form_send(
        self,
        center_id: str,
        form_template_id: str,
        data: FormSendCreate,
    ) -> tuple[FormSendAtomic, FormSend]:
        repo = self._uow.repo(FormSendRepository)
        service = CreateFormSendService(repo)
        return await service.execute(
            center_id=center_id,
            form_template_id=form_template_id,
            recipients=[r.model_dump() for r in data.recipients],
            channel=data.channel.value,
        )

    async def get_form_send(self, center_id: str, send_id: str) -> FormSend:
        repo = self._uow.repo(FormSendRepository)
        service = GetFormSendService(repo)
        return await service.execute(center_id, send_id)

    async def list_form_sends(
        self,
        center_id: str,
        form_template_id: str,
    ) -> list[FormSend]:
        repo = self._uow.repo(FormSendRepository)
        service = ListFormSendsService(repo)
        return await service.execute(center_id, form_template_id)

    @staticmethod
    def build_url(instance_id: str) -> str:
        base_url = settings.FRONTEND_URL
        return f"{base_url}/forms/fill/{instance_id}"

    @staticmethod
    def new_verification_code() -> str:
        # 4자리 숫자 — 문자 본문에 실어 URL 유출만으로 열리지 않게 한다
        import secrets
        return f"{secrets.randbelow(10000):04d}"
