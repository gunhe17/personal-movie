from fastapi import UploadFile

from app.behavior.action.center import resolve_access
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.facade.profile_facade import ProfileFacade
from app.modules.upload.image.handlers import upload_image_handler
from app.modules.upload.image.schemas import ImageCategory, ImageUploadResponse


async def _target_center_id(
    uow: UnitOfWork, category: ImageCategory, entity_id: str
) -> str:
    # client-profile 은 entity_id 가 client_id → 소유 center 로 해석. 그 외는 entity_id 가 center_id.
    if category == ImageCategory.CLIENT_PROFILE:
        return await ProfileFacade(uow).get_center_id(client_id=entity_id)
    return entity_id


async def upload_image_app_handler(
    *,
    file: UploadFile,
    category: ImageCategory,
    entity_id: str,
    person_id: str,
    uow: UnitOfWork,
) -> ImageUploadResponse:
    target_center_id = await _target_center_id(uow, category, entity_id)
    # 호출자가 대상 center 의 멤버인지 검증 (비멤버 403) — 타 센터 namespace 쓰기 차단
    await resolve_access(uow.session, target_center_id, person_id)

    # storage (DB write 없음 — 트랜잭션 밖)
    return await upload_image_handler(file, category, entity_id)


TOOL = {
    "name": "upload_image_app_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "센터 멤버가 로고·룸 썸네일·프로필 등 특정 대상에 붙일 이미지 파일을 스토리지에 업로드하고 공개 URL을 발급한다.",
    "keywords": [
        "upload image app",
        "이미지 업로드",
        "사진 올리기",
        "로고 등록",
        "프로필 사진 변경",
        "썸네일 업로드",
        "이미지 첨부",
        "파일 올리기",
        "사진 등록",
        "그림 업로드",
    ],
    "boundaries": "이미지를 스토리지에 '올리는' 전용 도구다. 이미 올라간 이미지를 지우려면 delete_image_app_handler를 쓴다. category 로 어디에 쓸 이미지인지를 지정하며, 업로드 전에 호출자가 대상 센터의 멤버인지 검증해 타 센터 영역에 이미지를 쓰는 것을 차단한다(비멤버 403). 텍스트·문서 업로드가 아니라 이미지 전용이다.",
    "output": "업로드된 이미지의 공개 URL과 저장 경로 (ImageUploadResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "title": "이미지 파일",
                "description": "업로드할 실제 이미지 바이너리 파일(예: PNG·JPG). multipart 폼으로 전송되는 파일 자체.",
            },
            "category": {
                "type": "string",
                "enum": [
                    "center-logo",
                    "center-image",
                    "room-thumbnail",
                    "profile",
                    "client-profile",
                    "member-profile",
                    "notice",
                ],
                "title": "이미지 용도",
                "description": "이 이미지가 쓰일 용도. center-logo(센터 로고)·center-image(센터 사진)·room-thumbnail(룸 썸네일)·profile·client-profile(고객 프로필)·member-profile(직원 프로필)·notice(공지 첨부) 중 하나.",
            },
            "entity_id": {
                "type": "string",
                "format": "uuid",
                "title": "연결 대상",
                "description": "이미지를 붙일 대상의 고유 식별 번호. client-profile 이면 고객 id(소유 센터로 해석됨), 그 외에는 센터 id.",
            },
            "person_id": {
                "type": "string",
                "format": "uuid",
                "title": "사용자",
                "description": "업로드를 요청하는 사람의 고유 식별 번호. 대상 센터의 멤버 권한 검증에 쓰인다.",
            },
        },
        "required": ["file", "category", "entity_id", "person_id"],
    },
}
