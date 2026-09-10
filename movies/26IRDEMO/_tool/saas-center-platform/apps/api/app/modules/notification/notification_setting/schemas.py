from pydantic import BaseModel, Field

from ..notification.schemas import NotificationCategory


class NotificationSettingResponse(BaseModel):
    id: str
    center_id: str
    account_id: str
    category: NotificationCategory
    event_type: str | None = None
    channel_in_app: bool
    channel_push: bool
    channel_alarmtalk: bool

    model_config = {"from_attributes": True}


class NotificationSettingUpsert(BaseModel):
    # 알림 설정 생성/수정 (Upsert)
    #
    # category + 채널별 활성화 여부를 설정합니다.
    # 동일한 (center_id, account_id, category) 조합이 이미 존재하면 수정,
    # 없으면 새로 생성합니다.

    category: NotificationCategory = Field(
        description="알림 대분류 (assessment, counseling, system)",
    )
    event_type: str | None = Field(
        default=None,
        description="이벤트 세부 타입 (NULL = 카테고리 전체 설정)",
    )
    channel_in_app: bool = Field(
        default=True,
        description="인앱 알림 활성화",
    )
    channel_push: bool = Field(
        default=False,
        description="웹 푸시 활성화",
    )
    channel_alarmtalk: bool = Field(
        default=False,
        description="카카오 알림톡 활성화",
    )


class NotificationSettingListResponse(BaseModel):
    items: list[NotificationSettingResponse]
