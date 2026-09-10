from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import NotificationFacade
from ..schemas import (
    NotificationSettingUpsert,
    NotificationSettingResponse,
)

async def upsert_setting_handler(
    center_id: str,
    account_id: str,
    data: NotificationSettingUpsert,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> NotificationSettingResponse:
    facade = NotificationFacade(uow)
    atomic, setting = await facade.upsert_setting(
        center_id=center_id,
        account_id=account_id,
        category=data.category.value,
        channel_in_app=data.channel_in_app,
        channel_push=data.channel_push,
        channel_alarmtalk=data.channel_alarmtalk,
        event_type=data.event_type,
    )
    await emit(
        uow,
        "notification_setting_upserted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return NotificationSettingResponse.model_validate(setting)


TOOL = {
    "name": 'upsert_setting_handler',
    "permission": None,
    "purpose": '알림 설정을 저장(없으면 생성)한다.',
    "keywords": ['알림 설정 변경', '알림 켜기 끄기', 'setting 저장'],
    "boundaries": '알림 설정 생성/수정. 조회는 list_settings_handler.',
    "output": '저장된 알림 설정 (NotificationSettingResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'category': {'$ref': '#/$defs/NotificationCategory', 'description': '알림 대분류: assessment(검사)/counseling(상담)/system(시스템)/*(전체).'},
            'event_type': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '이벤트 세부 타입(NULL이면 카테고리 전체 설정).', 'title': '이벤트 타입'},
            'channel_in_app': {'default': True, 'description': '인앱 알림 활성화 여부(기본 True).', 'title': '인앱 알림', 'type': 'boolean'},
            'channel_push': {'default': False, 'description': '웹 푸시 활성화 여부(기본 False).', 'title': '푸시 알림', 'type': 'boolean'},
            'channel_alarmtalk': {'default': False, 'description': '카카오 알림톡 활성화 여부(기본 False).', 'title': '알림톡', 'type': 'boolean'},
        },
        "$defs": {'NotificationCategory': {'enum': ['assessment', 'counseling', 'system', '*'], 'title': 'NotificationCategory', 'type': 'string'}},
        "required": ['category'],
    },
}
