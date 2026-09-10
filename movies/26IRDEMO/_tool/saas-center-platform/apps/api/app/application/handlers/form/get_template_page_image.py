# CORS 회피용 서버 프록시 — 서식 원본 PNG 를 그대로 흘린다.
# 서식 스키마의 pages[].image 는 storage 경로라 브라우저가 직접 못 읽는다.
# 접근 권한은 템플릿 조회와 같다(그 센터가 볼 수 있는 서식이면 그 이미지도 볼 수 있다).
from fastapi.responses import StreamingResponse

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.form.facade.form_template_facade import FormTemplateFacade


async def get_template_page_image_handler(
    center_id: str,
    template_id: str,
    page_no: int,
    uow: UnitOfWork,
) -> StreamingResponse:
    template = await FormTemplateFacade(uow).get_template(
        template_id=template_id, center_id=center_id
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
