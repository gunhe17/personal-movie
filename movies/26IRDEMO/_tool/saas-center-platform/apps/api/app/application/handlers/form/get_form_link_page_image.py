# 공개 표면(토큰 인증) — 작성 링크의 배경 서식 PNG 를 흘린다.
# <img> 는 헤더를 못 실으니 토큰을 쿼리(t)로 받는다. 토큰의 instance/center 스코프로만 접근.
from fastapi.responses import StreamingResponse

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.facade.form_template_facade import FormTemplateFacade


async def get_form_link_page_image_handler(
    instance_id: str,
    center_id: str,
    page_no: int,
    uow: UnitOfWork,
) -> StreamingResponse:
    instance = await FormFacade(uow).find_instance_by_id(instance_id)
    if instance is None or instance.center_id != center_id:
        raise EntityNotFoundException("작성 링크를 찾을 수 없습니다.")
    template = await FormTemplateFacade(uow).get_template(
        template_id=instance.template_id, center_id=center_id
    )
    pages = (template.schema or {}).get("pages") or []
    page = next((p for p in pages if int(p.get("no", 0)) == page_no), None)
    if page is None or not page.get("image"):
        raise EntityNotFoundException(f"서식 원본 이미지가 없습니다: page={page_no}")

    data = await get_storage_client().download_file(path=str(page["image"]))
    return StreamingResponse(
        iter([data]),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )
