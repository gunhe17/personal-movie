from sqlalchemy import select, update

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AssessmentSendResult


class AssessmentSendResultRepository(PostgresRepository[AssessmentSendResult]):
    model = AssessmentSendResult

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        verification_code: str,
        recipients: list,
        channel: str = "alarmtalk",
        expires_at: utc_dt | None = None,
    ) -> AssessmentSendResult:
        return await super().add(
            AssessmentSendResult(
                center_id=center_id,
                case_id=case_id,
                verification_code=verification_code,
                recipients=recipients,
                channel=channel,
                expires_at=expires_at,
            )
        )

    @typecheck
    async def revoke_active_results(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> int:
        now = utc_now()
        stmt = (
            update(AssessmentSendResult)
            .where(
                AssessmentSendResult.center_id == center_id,
                AssessmentSendResult.case_id == case_id,
                AssessmentSendResult.revoked_at.is_(None),
                AssessmentSendResult.deleted_at.is_(None),
            )
            .values(revoked_at=now, updated_at=now)
        )
        result = await self._session.execute(stmt)
        return result.rowcount

    @typecheck
    async def increment_failed_attempts(self, send_result_id: uuid_str) -> int:
        stmt = (
            update(AssessmentSendResult)
            .where(
                AssessmentSendResult.id == send_result_id,
                AssessmentSendResult.deleted_at.is_(None),
            )
            .values(
                failed_attempts=AssessmentSendResult.failed_attempts + 1,
                updated_at=utc_now(),
            )
            .returning(AssessmentSendResult.failed_attempts)
        )
        result = await self._session.execute(stmt)
        row = result.fetchone()
        return row[0] if row else 0

    # #
    # query

    @typecheck
    async def find_in_center_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        send_result_id: uuid_str,
    ) -> AssessmentSendResult | None:
        return await self._find(
            where=[
                AssessmentSendResult.center_id == center_id,
                AssessmentSendResult.case_id == case_id,
                AssessmentSendResult.id == send_result_id,
            ]
        )

    @typecheck
    async def get_in_center_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        send_result_id: uuid_str,
    ) -> AssessmentSendResult:
        send_result = await self.find_in_center_case(
            center_id=center_id,
            case_id=case_id,
            send_result_id=send_result_id,
        )
        if send_result is None:
            raise EntityNotFoundException(f"AssessmentSendResult not found: {send_result_id}")
        return send_result

    @typecheck
    async def list_by_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> list[AssessmentSendResult]:
        return await self._filter(
            where=[
                AssessmentSendResult.center_id == center_id,
                AssessmentSendResult.case_id == case_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_active_by_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> list[AssessmentSendResult]:
        now = utc_now()
        return await self._filter(
            where=[
                AssessmentSendResult.center_id == center_id,
                AssessmentSendResult.case_id == case_id,
                AssessmentSendResult.revoked_at.is_(None),
                (
                    AssessmentSendResult.expires_at.is_(None)
                    | (AssessmentSendResult.expires_at > now)
                ),
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_active_case_id_set(self, case_ids: list[str]) -> set[str]:
        if not case_ids:
            return set()
        now = utc_now()
        stmt = select(AssessmentSendResult.case_id).where(
            AssessmentSendResult.case_id.in_(case_ids),
            AssessmentSendResult.revoked_at.is_(None),
            (
                AssessmentSendResult.expires_at.is_(None)
                | (AssessmentSendResult.expires_at > now)
            ),
            AssessmentSendResult.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return {row for row in result.scalars().all()}

    @typecheck
    async def list_by_center_with_page(self, center_id: str, *, page: int = 1, size: int = 20):
        return await self._page(
            where=[self.model.center_id == center_id],
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def find_by_id_public(self, send_result_id: uuid_str) -> AssessmentSendResult | None:
        return await self._find(where=[AssessmentSendResult.id == send_result_id])

    @typecheck
    async def get_by_id_public(self, send_result_id: uuid_str) -> AssessmentSendResult:
        send_result = await self.find_by_id_public(send_result_id=send_result_id)
        if send_result is None:
            raise EntityNotFoundException(f"AssessmentSendResult not found: {send_result_id}")
        return send_result
