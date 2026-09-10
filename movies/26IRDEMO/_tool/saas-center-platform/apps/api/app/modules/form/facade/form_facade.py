from app.modules.form.form.models import FormStatus
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.value.repository import FormValueRepository
from app.modules.form.value.schemas import ValueResponse, ValuesResponse
from app.modules.form.value.services.list_answers import ListAnswersService
from app.modules.form.value.services.upsert_answers import UpsertAnswersService
from app.modules.form.form.events import FormAtomic
from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository
from app.modules.form.form.schemas import (
    FormListResponse,
    FormResponse,
    FormSummary,
)
from app.modules.form.form.services.create_instance import CreateInstanceService
from app.modules.form.form.services.delete_instance import DeleteInstanceService
from app.modules.form.form.services.get_instance import GetInstanceService
from app.modules.form.form.services.get_instances_by_ids import GetInstancesByIdsService
from app.modules.form.form.services.list_instances import ListInstancesService
from app.modules.form.form.services.revert_instance import RevertInstanceService
from app.modules.form.form.services.submit_instance import SubmitInstanceService
from app.modules.form.form.services.verify_required_fields import (
    VerifyRequiredFieldsService,
)
from app.modules.form.signature.events import SignatureAtomic
from app.modules.form.signature.models import FormSignature
from app.modules.form.signature.repository import FormSignatureRepository
from app.modules.form.signature.schemas import SignatureResponse
from app.modules.form.signature.services.create_signature import CreateSignatureService
from app.modules.form.signature.services.get_signature import GetSignatureService
from app.modules.form.signature.services.list_signatures import ListSignaturesService
from app.modules.form.template.repository import FormTemplateRepository
from app.modules.form.template.services.get_template import GetTemplateService


class FormFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_instance(
        self,
        center_id: str,
        template_id: str,
        created_by: str | None = None,
        verification_code: str | None = None,
    ) -> tuple[FormAtomic, Form]:
        template_repo = self._uow.repo(FormTemplateRepository)
        get_template = GetTemplateService(template_repo)
        await get_template.execute(template_id, center_id)

        instance_repo = self._uow.repo(FormRepository)
        service = CreateInstanceService(instance_repo)
        return await service.execute(
            center_id, template_id, created_by, verification_code
        )

    async def find_instance_by_id(self, instance_id: str) -> Form | None:
        # 게스트 링크 인증 — center 스코프 이전 단계
        instance_repo = self._uow.repo(FormRepository)
        return await instance_repo.find_by_id(instance_id)

    async def record_failed_attempt(self, instance_id: str) -> int:
        instance_repo = self._uow.repo(FormRepository)
        return await instance_repo.record_failed_attempt(instance_id)

    async def get_instances_by_ids(
        self,
        instance_ids: list[str],
        center_id: str,
    ) -> list[Form]:
        instance_repo = self._uow.repo(FormRepository)
        service = GetInstancesByIdsService(instance_repo)
        return await service.execute(instance_ids, center_id)

    async def get_instance(
        self,
        instance_id: str,
        center_id: str,
    ) -> Form:
        instance_repo = self._uow.repo(FormRepository)
        service = GetInstanceService(instance_repo)
        return await service.execute(instance_id, center_id)

    async def get_instance_with_response(
        self,
        instance_id: str,
        center_id: str,
    ) -> tuple[FormAtomic, FormResponse]:
        instance_repo = self._uow.repo(FormRepository)
        get_instance = GetInstanceService(instance_repo)
        instance = await get_instance.execute(instance_id, center_id)

        answer_repo = self._uow.repo(FormValueRepository)
        list_answers = ListAnswersService(answer_repo)
        answers = await list_answers.execute(instance_id)

        sig_repo = self._uow.repo(FormSignatureRepository)
        list_sigs = ListSignaturesService(sig_repo)
        signatures = await list_sigs.execute(instance_id)

        response = FormResponse.model_validate(instance)
        response.values = [ValueResponse.model_validate(a) for a in answers]
        response.signatures = [SignatureResponse.model_validate(s) for s in signatures]
        return response

    async def list_instances_with_response(
        self,
        center_id: str,
        status: str | None = None,
        template_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> FormListResponse:
        instance_repo = self._uow.repo(FormRepository)
        service = ListInstancesService(instance_repo)
        items, page_meta = await service.execute(
            center_id=center_id,
            status=status,
            template_id=template_id,
            page=page,
            size=size,
        )

        return FormListResponse(
            items=[FormSummary.model_validate(i) for i in items],
            total=page_meta["total"],
            page=page_meta["page"],
            size=page_meta["size"],
            pages=page_meta["pages"],
        )

    async def upsert_answers_with_response(
        self,
        center_id: str,
        instance_id: str,
        values: list[dict],
    ) -> ValuesResponse:
        instance_repo = self._uow.repo(FormRepository)
        get_instance = GetInstanceService(instance_repo)
        instance = await get_instance.execute(instance_id, center_id)

        if instance.status != FormStatus.DRAFT:
            raise InvalidOperationException(
                "Cannot modify values for submitted form. Revert to draft first."
            )

        answer_repo = self._uow.repo(FormValueRepository)
        upsert_service = UpsertAnswersService(answer_repo)
        saved = await upsert_service.execute(instance_id, center_id, values)

        return ValuesResponse(values=[ValueResponse.model_validate(a) for a in saved])

    async def submit_instance(
        self,
        center_id: str,
        instance_id: str,
        submitted_by: str | None = None,
    ) -> tuple[FormAtomic, FormResponse]:
        instance_repo = self._uow.repo(FormRepository)
        get_instance = GetInstanceService(instance_repo)
        instance = await get_instance.execute(instance_id, center_id)

        template_repo = self._uow.repo(FormTemplateRepository)
        get_template = GetTemplateService(template_repo)
        template = await get_template.execute(instance.template_id, center_id)

        answer_repo = self._uow.repo(FormValueRepository)
        list_answers = ListAnswersService(answer_repo)
        answers = await list_answers.execute(instance_id)

        sig_repo = self._uow.repo(FormSignatureRepository)
        signatures = await ListSignaturesService(sig_repo).execute(instance_id)

        VerifyRequiredFieldsService().execute(
            schema_fields=template.schema.get("fields", {}),
            answered_ids={a.field_key for a in answers},
            signed_field_ids={s.field_id for s in signatures},
        )

        submit_service = SubmitInstanceService(instance_repo)
        atomic, instance = await submit_service.execute(
            instance_id, center_id, submitted_by
        )

        all_answers = await list_answers.execute(instance_id)
        sig_repo = self._uow.repo(FormSignatureRepository)
        list_all_sigs = ListSignaturesService(sig_repo)
        all_sigs = await list_all_sigs.execute(instance_id)

        response = FormResponse.model_validate(instance)
        response.values = [ValueResponse.model_validate(a) for a in all_answers]
        response.signatures = [SignatureResponse.model_validate(s) for s in all_sigs]
        return atomic, response

    async def revert_instance(
        self,
        center_id: str,
        instance_id: str,
    ) -> tuple[FormAtomic, Form]:
        instance_repo = self._uow.repo(FormRepository)
        service = RevertInstanceService(instance_repo)
        return await service.execute(instance_id, center_id)

    async def delete_instance_with_response(
        self,
        center_id: str,
        instance_id: str,
    ) -> FormAtomic:
        instance_repo = self._uow.repo(FormRepository)
        service = DeleteInstanceService(instance_repo)
        atomic, _ = await service.execute(instance_id, center_id)
        return atomic

    async def create_signature(
        self,
        center_id: str,
        instance_id: str,
        field_id: str,
        signature_data: str,
        signer_name: str,
        signer_ip: str | None = None,
    ) -> tuple[SignatureAtomic, FormSignature]:
        instance_repo = self._uow.repo(FormRepository)
        get_instance = GetInstanceService(instance_repo)
        instance = await get_instance.execute(instance_id, center_id)

        if instance.status != FormStatus.DRAFT:
            raise InvalidOperationException(
                "Cannot add signature to submitted instance. Revert to draft first."
            )

        sig_repo = self._uow.repo(FormSignatureRepository)
        service = CreateSignatureService(sig_repo)
        return await service.execute(
            center_id=center_id,
            instance_id=instance_id,
            field_id=field_id,
            signature_data=signature_data,
            signer_name=signer_name,
            signer_ip=signer_ip,
        )

    async def get_signature_with_response(
        self,
        signature_id: str,
        center_id: str,
    ) -> SignatureResponse:
        sig_repo = self._uow.repo(FormSignatureRepository)
        service = GetSignatureService(sig_repo)
        signature = await service.execute(
            signature_id=signature_id,
            center_id=center_id,
        )
        return SignatureResponse.model_validate(signature)
