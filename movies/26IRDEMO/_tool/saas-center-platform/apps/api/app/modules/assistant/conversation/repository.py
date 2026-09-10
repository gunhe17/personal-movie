from sqlalchemy import cast, select, update
from sqlalchemy.dialects.postgresql import JSONB

from app.core.exceptions import EntityNotFoundException
from app.core.type import typecheck, unset, utc_dt, uuid_str
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import AssistantConversation, AssistantTurn, AssistantTurnStatus


def _has_turn():
    return (
        select(AssistantTurn.id)
        .where(
            AssistantTurn.conversation_id == AssistantConversation.id,
            AssistantTurn.deleted_at.is_(None),
        )
        .exists()
    )


class AssistantConversationRepository(PostgresRepository[AssistantConversation]):
    model = AssistantConversation

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
    ) -> AssistantConversation:
        return await super().add(
            AssistantConversation(
                center_id=center_id,
                member_id=member_id,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
        *,
        title: str | None = unset,
    ) -> AssistantConversation:
        await self.get_in_center(conversation_id=conversation_id, center_id=center_id)
        updated = await self.update_fields(conversation_id, title=title)
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
    ) -> None:
        record = await self.find_in_center(
            conversation_id=conversation_id, center_id=center_id
        )
        if record is None:
            return
        await self.remove_by_id(record.id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
    ) -> AssistantConversation | None:
        return await self._find(
            where=[
                AssistantConversation.id == conversation_id,
                AssistantConversation.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
    ) -> AssistantConversation:
        record = await self.find_in_center(
            conversation_id=conversation_id, center_id=center_id
        )
        if record is None:
            raise EntityNotFoundException(f"Conversation not found: {conversation_id}")
        return record

    @typecheck
    async def list_for_member_with_page(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssistantConversation], Page]:
        # 턴 0건(생성 후 미전송) 대화는 목록에서 숨긴다
        return await self._page(
            where=[
                AssistantConversation.center_id == center_id,
                AssistantConversation.member_id == member_id,
                _has_turn(),
            ],
            page=page,
            size=size,
            order_by="updated_at",
            descending=True,
        )

    @typecheck
    async def remove_empty_all_centers(
        self,
        cutoff: utc_dt,
    ) -> int:
        # sweeper 전용 — 생성 후 전송 없이 버려진 빈 대화 정리
        from app.core.datetime_utils import utc_now

        stmt = (
            update(AssistantConversation)
            .where(
                AssistantConversation.created_at < cutoff,
                AssistantConversation.deleted_at.is_(None),
                ~_has_turn(),
            )
            .values(deleted_at=utc_now())
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0


class AssistantTurnRepository(PostgresRepository[AssistantTurn]):
    model = AssistantTurn

    # #
    # command

    @typecheck
    async def add(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
        *,
        user_message: str,
    ) -> AssistantTurn:
        return await super().add(
            AssistantTurn(
                conversation_id=conversation_id,
                center_id=center_id,
                user_message=user_message,
                events=[],
                status=AssistantTurnStatus.RUNNING,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        turn_id: uuid_str,
        center_id: uuid_str,
        *,
        status: AssistantTurnStatus = unset,
        events: list = unset,
        completion: str | None = unset,
        bookmark: dict | None = unset,
        ended_at: utc_dt | None = unset,
    ) -> AssistantTurn:
        await self.get_in_center(turn_id=turn_id, center_id=center_id)
        updated = await self.update_fields(
            turn_id,
            status=status,
            events=events,
            completion=completion,
            bookmark=bookmark,
            ended_at=ended_at,
        )
        assert updated is not None
        return updated

    @typecheck
    async def claim_paused(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
        *,
        answer_event: dict,
    ) -> AssistantTurn | None:
        # 조건부 전이 + RETURNING 원자 — 답변 append·bookmark 회수·running 전이가 한 문장.
        # 0행 = 이미 처리됨(이중 클릭) → None, 호출자가 "할 일 없음" 처리.
        # 대화당 paused는 최대 1(새 턴 시작 시 폐기 불변식) — 서브쿼리는 방어적 최신 1건
        latest_paused = (
            select(AssistantTurn.id)
            .where(
                AssistantTurn.conversation_id == conversation_id,
                AssistantTurn.center_id == center_id,
                AssistantTurn.status == AssistantTurnStatus.PAUSED.value,
                AssistantTurn.deleted_at.is_(None),
            )
            .order_by(AssistantTurn.created_at.desc())
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            update(AssistantTurn)
            .where(
                AssistantTurn.id == latest_paused,
                AssistantTurn.status == AssistantTurnStatus.PAUSED.value,
            )
            .values(
                status=AssistantTurnStatus.RUNNING.value,
                events=AssistantTurn.events.op("||")(cast([answer_event], JSONB)),
            )
            .returning(AssistantTurn)
        )
        claimed = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return claimed

    @typecheck
    async def update_paused_to_abandoned(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
    ) -> int:
        # 새 턴 시작 시 낡은 책갈피 폐기 — 답 없는 paused를 종결
        stmt = (
            update(AssistantTurn)
            .where(
                AssistantTurn.conversation_id == conversation_id,
                AssistantTurn.center_id == center_id,
                AssistantTurn.status == AssistantTurnStatus.PAUSED.value,
                AssistantTurn.deleted_at.is_(None),
            )
            .values(status=AssistantTurnStatus.ABANDONED.value, bookmark=None)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0

    @typecheck
    async def update_stale_running_to_abandoned_all_centers(
        self,
        cutoff: utc_dt,
    ) -> int:
        # sweeper 전용 — 프로세스 즉사로 남은 running 정리 (유일한 손실 창의 청소부)
        stmt = (
            update(AssistantTurn)
            .where(
                AssistantTurn.status == AssistantTurnStatus.RUNNING.value,
                AssistantTurn.updated_at < cutoff,
                AssistantTurn.deleted_at.is_(None),
            )
            .values(status=AssistantTurnStatus.ABANDONED.value)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount or 0

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        turn_id: uuid_str,
        center_id: uuid_str,
    ) -> AssistantTurn | None:
        return await self._find(
            where=[
                AssistantTurn.id == turn_id,
                AssistantTurn.center_id == center_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        turn_id: uuid_str,
        center_id: uuid_str,
    ) -> AssistantTurn:
        record = await self.find_in_center(turn_id=turn_id, center_id=center_id)
        if record is None:
            raise EntityNotFoundException(f"Turn not found: {turn_id}")
        return record

    @typecheck
    async def list_in_conversation(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
        *,
        status: AssistantTurnStatus | None = None,
    ) -> list[AssistantTurn]:
        where = [
            AssistantTurn.conversation_id == conversation_id,
            AssistantTurn.center_id == center_id,
        ]
        if status is not None:
            where.append(AssistantTurn.status == status.value)
        return await self._filter(where=where, order_by="created_at")
