from app.core.exceptions import InvalidOperationException
from app.behavior.action.center import resolve_access
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.upload.image.handlers import delete_image_handler
from app.modules.upload.image.schemas import ImageCategory, ImageDeleteResponse

from .upload_image_app import _target_center_id


async def delete_image_app_handler(
    *,
    path: str,
    person_id: str,
    uow: UnitOfWork,
) -> ImageDeleteResponse:
    # path = "{category}/{entity_id}/{filename}" — prefix 로 대상 center 를 해석해 소유 검증
    parts = path.split("/")
    if len(parts) < 3:
        raise InvalidOperationException("잘못된 이미지 경로입니다")
    try:
        category = ImageCategory(parts[0])
    except ValueError:
        raise InvalidOperationException("알 수 없는 이미지 카테고리입니다")
    entity_id = parts[1]

    target_center_id = await _target_center_id(uow, category, entity_id)
    # 호출자가 대상 center 의 멤버인지 검증 (비멤버 403) — 임의 객체 삭제 차단
    await resolve_access(uow.session, target_center_id, person_id)

    return await delete_image_handler(path)


TOOL = {
    "name": "delete_image_app_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "센터 멤버가 스토리지에 올라가 있는 특정 이미지 파일을 경로로 지목해 삭제한다.",
    "keywords": [
        "delete image app",
        "이미지 삭제",
        "사진 지우기",
        "로고 제거",
        "프로필 사진 삭제",
        "썸네일 삭제",
        "이미지 제거",
        "올린 사진 삭제",
        "파일 지우기",
    ],
    "boundaries": "이미 업로드된 이미지를 스토리지에서 '지우는' 전용 도구다. 새 이미지를 올리려면 upload_image_app_handler를 쓴다. 삭제 대상은 업로드 시 받은 path 로 지정하며, path 의 prefix(category/entity_id)로 대상 센터를 해석해 호출자가 그 센터의 멤버인지 검증한다(비멤버 403) — 임의 경로의 객체를 지우는 것을 차단한다.",
    "output": "삭제 결과 (ImageDeleteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "title": "이미지 경로",
                "description": "삭제할 이미지의 스토리지 경로. '{category}/{entity_id}/{filename}' 형식(예: center-logo/센터id/logo.png) — 업로드 응답으로 받은 path 를 그대로 넣는다.",
            },
            "person_id": {
                "type": "string",
                "format": "uuid",
                "title": "사용자",
                "description": "삭제를 요청하는 사람의 고유 식별 번호. path 가 가리키는 센터의 멤버 권한 검증에 쓰인다.",
            },
        },
        "required": ["path", "person_id"],
    },
}
