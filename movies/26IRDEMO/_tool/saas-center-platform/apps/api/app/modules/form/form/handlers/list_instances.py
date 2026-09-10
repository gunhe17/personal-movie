from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormListResponse


async def list_instances_handler(
    center_id: str,
    uow: UnitOfWork,
    status: str | None = None,
    template_id: str | None = None,
    page: int = 1,
    size: int = 20,
) -> FormListResponse:
    facade = FormFacade(uow)
    response = await facade.list_instances_with_response(
        center_id=center_id,
        status=status,
        template_id=template_id,
        page=page,
        size=size,
    )
    return response


TOOL = {
    "name": "list_instances_handler",
    "permission": "read:form_instance",
    "purpose": "폼 인스턴스 목록을 상태·템플릿으로 거르고 조회한다.",
    "keywords": ["폼 목록", "인스턴스 목록", "설문 목록", "form 리스트"],
    "boundaries": "폼 인스턴스 목록(읽기). 단건은 get_instance_handler.",
    "output": "폼 인스턴스 목록 (FormListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
            },
            "template_id": {
                "type": "string",
                "format": "uuid",
                "title": "템플릿 필터",
                "description": "특정 템플릿으로 한정(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": [],
    },
}
