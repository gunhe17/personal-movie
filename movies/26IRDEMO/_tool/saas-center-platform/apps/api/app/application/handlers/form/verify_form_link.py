# 공개 표면(인증 불필요) — 보호자가 문자로 받은 4자리 코드로 서식 작성 링크를 연다.
# 통과 시 링크 스코프 토큰(aud=form_link) 발급: 계정 없이 그 인스턴스만 조회·제출.
from datetime import timedelta

from app.core.exceptions import InvalidOperationException, EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.center.facade import CenterFacade
from app.modules.form.send.schemas import FormLinkVerifyResponse

FORM_LINK_AUDIENCE = "form_link"
LINK_TOKEN_EXPIRES = timedelta(hours=2)
MAX_ATTEMPTS = 5


async def verify_form_link_handler(
    instance_id: str,
    verification_code: str,
    uow: UnitOfWork,
) -> FormLinkVerifyResponse:
    async with uow:
        form_facade = FormFacade(uow)
        instance = await form_facade.find_instance_by_id(instance_id)
        if instance is None or not instance.verification_code:
            raise EntityNotFoundException("작성 링크를 찾을 수 없습니다.")

        if instance.failed_attempts >= MAX_ATTEMPTS:
            await uow.reject(
                InvalidOperationException("인증 시도 횟수를 초과했습니다. 센터에 문의해주세요.")
            )

        if verification_code != instance.verification_code:
            # 실패도 카운트를 보존 — reject = commit + raise
            await form_facade.record_failed_attempt(instance_id)
            await uow.reject(InvalidOperationException("인증코드가 올바르지 않습니다."))

        center_id = instance.center_id
        detail = await form_facade.get_instance_with_response(instance_id, center_id)
        template = await FormTemplateFacade(uow).get_template(
            template_id=instance.template_id, center_id=center_id
        )
        center_name = (await CenterFacade(uow).get_center(center_id)).name

    access_token = get_token().create_access_token(
        data={"instance_id": instance_id, "center_id": center_id},
        audience=FORM_LINK_AUDIENCE,
        expires_delta=LINK_TOKEN_EXPIRES,
    )

    # 배경 이미지 경로는 게스트가 직접 못 읽으니(로컬은 file://, S3는 인증) 토큰을 실은
    # 게스트 프록시 URL 로 치환한다. web 이 그대로 <img src> 로 건다.
    schema = dict(template.schema or {})
    pages = []
    for pg in schema.get("pages") or []:
        pg = dict(pg)
        if pg.get("image"):
            pg["image_url"] = (
                f"/form-links/{instance_id}/pages/{pg['no']}/image?t={access_token}"
            )
        pages.append(pg)
    schema["pages"] = pages

    return FormLinkVerifyResponse(
        access_token=access_token,
        center_name=center_name,
        form_name=template.name,
        status=detail.status.value if hasattr(detail.status, "value") else detail.status,
        schema=schema,
        values=[v.model_dump() for v in detail.values],
    )
