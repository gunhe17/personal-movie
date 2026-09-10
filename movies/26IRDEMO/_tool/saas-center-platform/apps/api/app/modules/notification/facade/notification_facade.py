from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..notification.models import Notification
from ..notification.events import NotificationAtomic
from ..notification.repository import NotificationRepository
from ..notification.schemas import (
    NotificationSummary,
    NotificationListResponse,
    UnreadCountResponse,
)
from ..notification.services.create_notification import CreateNotificationService
from ..notification.services.list_notifications import ListNotificationsService
from ..notification.services.list_notifications_for_recipient import (
    ListNotificationsForRecipientService,
)
from ..notification.services.get_unread_count import GetUnreadCountService
from ..notification.services.get_unread_count_for_recipient import (
    GetUnreadCountForRecipientService,
)
from ..notification.services.mark_as_read import MarkAsReadService
from ..notification.services.mark_as_read_for_recipient import (
    MarkAsReadForRecipientService,
)
from ..notification.services.mark_all_as_read import MarkAllAsReadService
from ..notification.services.mark_all_as_read_for_recipient import (
    MarkAllAsReadForRecipientService,
)
from ..notification_setting.repository import NotificationSettingRepository
from ..notification_setting.services import (
    FindEffectiveSettingService,
    AggregateEffectiveSettingsBulkService,
    AggregateSettingsByAccountsService,
    ListSettingsService,
    UpsertSettingService,
    DeleteSettingService,
)
from ..push_token.repository import PushTokenRepository
from ..push_token.services import (
    FindPushTokenService,
    RegisterTokenService,
    UnregisterTokenService,
)


class NotificationFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def notify(
        self,
        center_id: str,
        recipient_id: str,
        category: str,
        event_type: str,
        title: str,
        body: str,
        priority: str = "normal",
        data: dict | None = None,
        event_ref: str | None = None,
    ) -> tuple[NotificationAtomic | None, str | None]:
        # event_ref 중복이면 None 반환(생성 안 됨)
        repo = self._uow.repo(NotificationRepository)
        service = CreateNotificationService(repo)
        atomic, notification = await service.execute(
            center_id=center_id,
            recipient_id=recipient_id,
            category=category,
            event_type=event_type,
            title=title,
            body=body,
            priority=priority,
            data=data,
            event_ref=event_ref,
        )
        return atomic, notification.id if notification else None

    async def notify_bulk(
        self,
        center_id: str,
        recipient_ids: list[str],
        category: str,
        event_type: str,
        title: str,
        body: str,
        priority: str = "normal",
        data: dict | None = None,
        event_ref_prefix: str | None = None,
    ) -> tuple[list[NotificationAtomic], dict[str, str]]:
        repo = self._uow.repo(NotificationRepository)
        service = CreateNotificationService(repo)
        atomics: list[NotificationAtomic] = []
        created_map: dict[str, str] = {}

        for recipient_id in recipient_ids:
            event_ref = (
                f"{event_ref_prefix}:{recipient_id}" if event_ref_prefix else None
            )
            atomic, notification = await service.execute(
                center_id=center_id,
                recipient_id=recipient_id,
                category=category,
                event_type=event_type,
                title=title,
                body=body,
                priority=priority,
                data=data,
                event_ref=event_ref,
            )
            if atomic is not None and notification:
                atomics.append(atomic)
                created_map[recipient_id] = notification.id

        return atomics, created_map

    async def find_effective_setting(
        self,
        account_id: str,
        category: str,
        center_id: str | None = None,
        event_type: str | None = None,
    ):
        repo = self._uow.repo(NotificationSettingRepository)
        service = FindEffectiveSettingService(repo)
        return await service.execute(
            center_id=center_id,
            account_id=account_id,
            category=category,
            event_type=event_type,
        )

    async def aggregate_effective_settings_bulk(
        self,
        center_id: str,
        account_ids: list[str],
        category: str,
        event_type: str | None = None,
    ):
        repo = self._uow.repo(NotificationSettingRepository)
        service = AggregateEffectiveSettingsBulkService(repo)
        return await service.execute(
            center_id=center_id,
            account_ids=account_ids,
            category=category,
            event_type=event_type,
        )

    async def aggregate_settings_by_accounts(
        self,
        center_id: str,
        account_ids: list[str],
        category: str,
    ):
        repo = self._uow.repo(NotificationSettingRepository)
        service = AggregateSettingsByAccountsService(repo)
        return await service.execute(
            center_id=center_id,
            account_ids=account_ids,
            category=category,
        )

    async def list_with_response(
        self,
        center_id: str,
        recipient_id: str,
        *,
        category: str | None = None,
        is_read: bool | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
        sort: str = "desc",
    ) -> NotificationListResponse:
        repo = self._uow.repo(NotificationRepository)
        service = ListNotificationsService(repo)
        items, page_meta = await service.execute(
            center_id=center_id,
            recipient_id=recipient_id,
            category=category,
            is_read=is_read,
            search=search,
            page=page,
            size=size,
            sort=sort,
        )

        return NotificationListResponse(
            items=[NotificationSummary.model_validate(item) for item in items],
            **page_meta,
        )

    async def get_unread_count_with_response(
        self,
        center_id: str,
        recipient_id: str,
    ) -> UnreadCountResponse:
        repo = self._uow.repo(NotificationRepository)
        service = GetUnreadCountService(repo)
        count = await service.execute(
            center_id=center_id,
            recipient_id=recipient_id,
        )
        return UnreadCountResponse(count=count)

    async def mark_as_read(
        self,
        notification_id: str,
        center_id: str,
        recipient_id: str,
    ) -> tuple[NotificationAtomic, Notification]:
        repo = self._uow.repo(NotificationRepository)
        service = MarkAsReadService(repo)
        return await service.execute(
            notification_id=notification_id,
            center_id=center_id,
            recipient_id=recipient_id,
        )

    # #
    # 내담자 앱 — 센터를 가로지르는 단일 인박스 (recipient_id가 곧 G2 게이트)

    async def list_for_recipient_with_response(
        self,
        recipient_id: str,
        *,
        category: str | None = None,
        is_read: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> NotificationListResponse:
        repo = self._uow.repo(NotificationRepository)
        service = ListNotificationsForRecipientService(repo)
        items, page_meta = await service.execute(
            recipient_id=recipient_id,
            category=category,
            is_read=is_read,
            page=page,
            size=size,
        )
        return NotificationListResponse(
            items=[NotificationSummary.model_validate(item) for item in items],
            **page_meta,
        )

    async def get_unread_count_for_recipient_with_response(
        self,
        recipient_id: str,
    ) -> UnreadCountResponse:
        repo = self._uow.repo(NotificationRepository)
        service = GetUnreadCountForRecipientService(repo)
        count = await service.execute(recipient_id=recipient_id)
        return UnreadCountResponse(count=count)

    async def mark_as_read_for_recipient(
        self,
        notification_id: str,
        recipient_id: str,
    ) -> tuple[NotificationAtomic, Notification]:
        repo = self._uow.repo(NotificationRepository)
        service = MarkAsReadForRecipientService(repo)
        return await service.execute(
            notification_id=notification_id,
            recipient_id=recipient_id,
        )

    async def mark_all_as_read_for_recipient(
        self,
        recipient_id: str,
    ) -> tuple[list[NotificationAtomic], int]:
        repo = self._uow.repo(NotificationRepository)
        service = MarkAllAsReadForRecipientService(repo)
        return await service.execute(recipient_id=recipient_id)

    async def mark_all_as_read(
        self,
        center_id: str,
        recipient_id: str,
    ) -> tuple[list[NotificationAtomic], int]:
        repo = self._uow.repo(NotificationRepository)
        service = MarkAllAsReadService(repo)
        return await service.execute(
            center_id=center_id,
            recipient_id=recipient_id,
        )

    async def list_settings(self, account_id: str, center_id: str | None = None):
        repo = self._uow.repo(NotificationSettingRepository)
        service = ListSettingsService(repo)
        return await service.execute(account_id=account_id, center_id=center_id)

    async def upsert_setting(
        self,
        account_id: str,
        category: str,
        channel_in_app: bool,
        channel_push: bool,
        channel_alarmtalk: bool,
        center_id: str | None = None,
        event_type: str | None = None,
    ):
        repo = self._uow.repo(NotificationSettingRepository)
        service = UpsertSettingService(repo)
        return await service.execute(
            center_id=center_id,
            account_id=account_id,
            category=category,
            channel_in_app=channel_in_app,
            channel_push=channel_push,
            channel_alarmtalk=channel_alarmtalk,
            event_type=event_type,
        )

    async def delete_setting(
        self,
        setting_id: str,
        center_id: str,
        account_id: str,
    ):
        repo = self._uow.repo(NotificationSettingRepository)
        service = DeleteSettingService(repo)
        return await service.execute(setting_id, center_id, account_id)

    async def register_push_token(
        self,
        account_id: str,
        token: str,
        center_id: str | None = None,
        device_info: str | None = None,
        platform: str = "web",
    ):
        repo = self._uow.repo(PushTokenRepository)
        service = RegisterTokenService(repo)
        return await service.execute(
            center_id=center_id,
            account_id=account_id,
            token=token,
            device_info=device_info,
            platform=platform,
        )

    async def unregister_push_token(
        self,
        account_id: str,
        token: str,
        center_id: str | None = None,  # noqa: ARG002 — 직원 라우터 호환(소유 판정엔 안 쓴다)
    ) -> bool:
        repo = self._uow.repo(PushTokenRepository)
        # 토큰 소유는 account_id — center로 거르면 타 센터에서 해제 시 조용히 실패했다
        existing = await FindPushTokenService(repo).execute(token, account_id=account_id)
        if not existing:
            return False

        service = UnregisterTokenService(repo)
        return await service.execute(token=token)
