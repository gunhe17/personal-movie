from sqlalchemy import delete, or_

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import NotificationSetting


class NotificationSettingRepository(PostgresRepository[NotificationSetting]):
    model = NotificationSetting

    # #
    # command

    @typecheck
    async def add(
        self,
        account_id: uuid_str,
        category: str,
        channel_in_app: bool,
        channel_push: bool,
        channel_alarmtalk: bool,
        center_id: uuid_str | None = None,
        event_type: str | None = None,
    ) -> NotificationSetting:
        return await super().add(
            NotificationSetting(
                center_id=center_id,
                account_id=account_id,
                category=category,
                event_type=event_type,
                channel_in_app=channel_in_app,
                channel_push=channel_push,
                channel_alarmtalk=channel_alarmtalk,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        channel_in_app: bool = unset,
        channel_push: bool = unset,
        channel_alarmtalk: bool = unset,
    ) -> NotificationSetting | None:
        return await self.update_fields(
            id,
            channel_in_app=channel_in_app,
            channel_push=channel_push,
            channel_alarmtalk=channel_alarmtalk,
        )

    @typecheck
    async def hard_delete_by_id(self, id: uuid_str) -> bool:
        stmt = delete(NotificationSetting).where(NotificationSetting.id == id)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount > 0

    # #
    # query

    @typecheck
    async def get_owned(
        self,
        id: uuid_str,
        center_id: uuid_str,
        account_id: uuid_str,
    ) -> NotificationSetting:
        setting = await self._find(
            where=[
                NotificationSetting.id == id,
                NotificationSetting.center_id == center_id,
                NotificationSetting.account_id == account_id,
            ]
        )
        if setting is None:
            raise EntityNotFoundException(f"알림 설정을 찾을 수 없습니다: {id}")
        return setting

    @typecheck
    async def find_by_account(
        self,
        account_id: uuid_str,
        category: str,
        center_id: uuid_str | None = None,
        event_type: str | None = None,
    ) -> NotificationSetting | None:
        where = [
            NotificationSetting.center_id == center_id
            if center_id is not None
            else NotificationSetting.center_id.is_(None),
            NotificationSetting.account_id == account_id,
            NotificationSetting.category == category,
        ]
        if event_type is None:
            where.append(NotificationSetting.event_type.is_(None))
        else:
            where.append(NotificationSetting.event_type == event_type)
        return await self._find(where=where)

    @typecheck
    async def list_by_account(
        self,
        account_id: uuid_str,
        center_id: uuid_str | None = None,
    ) -> list[NotificationSetting]:
        return await self._filter(
            where=[
                NotificationSetting.center_id == center_id
                if center_id is not None
                else NotificationSetting.center_id.is_(None),
                NotificationSetting.account_id == account_id,
            ],
            order_by="category",
        )

    @typecheck
    async def aggregate_by_accounts_and_category(
        self,
        center_id: uuid_str,
        account_ids: list[str],
        category: str,
        event_type: str | None = None,
    ) -> dict[str, NotificationSetting]:
        rows = await self._list_candidate_settings(
            account_ids=account_ids,
            category=category,
            center_id=center_id,
            event_type=event_type,
            exact=True,
        )
        # 센터 행이 전역 행을 이기도록 낮은 랭크가 나중에 오게 정렬 — dict는 마지막이 이긴다
        result: dict[str, NotificationSetting] = {}
        for row in sorted(rows, key=_precedence_rank, reverse=True):
            result[row.account_id] = row
        return result

    @typecheck
    async def aggregate_effective_settings_bulk(
        self,
        center_id: uuid_str,
        account_ids: list[str],
        category: str,
        event_type: str | None = None,
    ) -> dict[str, NotificationSetting]:
        if not account_ids:
            return {}

        result_map: dict[str, NotificationSetting] = {}
        remaining_ids = list(account_ids)

        if event_type:
            event_map = await self.aggregate_by_accounts_and_category(
                center_id=center_id,
                account_ids=remaining_ids,
                category=category,
                event_type=event_type,
            )
            result_map.update(event_map)
            remaining_ids = [aid for aid in remaining_ids if aid not in result_map]

        if remaining_ids:
            category_map = await self.aggregate_by_accounts_and_category(
                center_id=center_id,
                account_ids=remaining_ids,
                category=category,
            )
            result_map.update(category_map)
            remaining_ids = [aid for aid in remaining_ids if aid not in result_map]

        if remaining_ids and category != "*":
            global_map = await self.aggregate_by_accounts_and_category(
                center_id=center_id,
                account_ids=remaining_ids,
                category="*",
            )
            result_map.update(global_map)

        return result_map

    @typecheck
    async def find_effective_setting(
        self,
        account_id: uuid_str,
        category: str,
        center_id: uuid_str | None = None,
        event_type: str | None = None,
    ) -> NotificationSetting | None:
        rows = await self._list_candidate_settings(
            account_ids=[account_id],
            category=category,
            center_id=center_id,
            event_type=event_type,
        )
        return min(rows, key=_precedence_rank, default=None)

    @typecheck
    async def _list_candidate_settings(
        self,
        account_ids: list[str],
        category: str,
        center_id: uuid_str | None = None,
        event_type: str | None = None,
        exact: bool = False,
    ) -> list[NotificationSetting]:
        if not account_ids:
            return []

        categories = [category] if (exact or category == "*") else [category, "*"]
        where = [
            NotificationSetting.account_id.in_(account_ids),
            NotificationSetting.category.in_(categories),
        ]

        if center_id is not None:
            # 전역 행(center_id IS NULL)도 후보 — 순위는 _precedence_rank가 가른다
            where.append(
                or_(
                    NotificationSetting.center_id == center_id,
                    NotificationSetting.center_id.is_(None),
                )
            )
        else:
            where.append(NotificationSetting.center_id.is_(None))

        if event_type is None:
            where.append(NotificationSetting.event_type.is_(None))
        elif exact:
            where.append(NotificationSetting.event_type == event_type)
        else:
            where.append(
                or_(
                    NotificationSetting.event_type == event_type,
                    NotificationSetting.event_type.is_(None),
                )
            )

        return await self._filter(where=where)


def _precedence_rank(setting: NotificationSetting) -> tuple[bool, bool, bool]:
    """작을수록 우선. 센터 > 전역, 구체 category > "*", 구체 event_type > NULL."""
    return (
        setting.center_id is None,
        setting.category == "*",
        setting.event_type is None,
    )
