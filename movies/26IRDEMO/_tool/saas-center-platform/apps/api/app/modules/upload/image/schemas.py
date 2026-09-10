from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class ImageCategory(str, Enum):
    CENTER_LOGO = "center-logo"
    CENTER_IMAGE = "center-image"
    ROOM_THUMBNAIL = "room-thumbnail"
    PROFILE = "profile"
    CLIENT_PROFILE = "client-profile"
    MEMBER_PROFILE = "member-profile"
    PROFILE_AVATAR = "profile-avatar"
    NOTICE = "notice"


class ImageUploadResponse(BaseModel):
    url: str = Field(..., description="업로드된 이미지 URL")
    path: str = Field(..., description="스토리지 내 파일 경로")
    size: int = Field(..., description="파일 크기 (bytes)")
    content_type: str = Field(..., description="MIME 타입")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "url": "https://bucket.s3.ap-northeast-2.amazonaws.com/centers/uuid/logo.png",
                "path": "centers/uuid/logo.png",
                "size": 102400,
                "content_type": "image/png"
            }
        }
    )


class ImageDeleteResponse(BaseModel):
    message: str = "이미지가 삭제되었습니다"
    path: str
