from sqlalchemy import update

from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AssessmentSendLink


class AssessmentSendLinkRepository(PostgresRepository[AssessmentSendLink]):
    model = AssessmentSendLink

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        verification_code: str,
        recipients: list,
        assessment_ids: list[str],
        channel: str = "alarmtalk",
        expires_at: utc_dt | None = None,
    ) -> AssessmentSendLink:
        return await super().add(
            AssessmentSendLink(
                center_id=center_id,
                case_id=case_id,
                verification_code=verification_code,
                recipients=recipients,
                assessment_ids=assessment_ids,
                channel=channel,
                expires_at=expires_at,
            )
        )

    @typecheck
    async def revoke_active_links(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> int:
        now = utc_now()
        stmt = (
            update(AssessmentSendLink)
            .where(
                AssessmentSendLink.center_id == center_id,
                AssessmentSendLink.case_id == case_id,
                AssessmentSendLink.revoked_at.is_(None),
                AssessmentSendLink.deleted_at.is_(None),
            )
            .values(revoked_at=now, updated_at=now)
        )
        result = await self._session.execute(stmt)
        return result.rowcount

    @typecheck
    async def increment_failed_attempts(self, send_link_id: uuid_str) -> int:
        stmt = (
            update(AssessmentSendLink)
            .where(
                AssessmentSendLink.id == send_link_id,
                AssessmentSendLink.deleted_at.is_(None),
            )
            .values(
                failed_attempts=AssessmentSendLink.failed_attempts + 1,
                updated_at=utc_now(),
            )
            .returning(AssessmentSendLink.failed_attempts)
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
        send_link_id: uuid_str,
    ) -> AssessmentSendLink | None:
        return await self._find(
            where=[
                AssessmentSendLink.center_id == center_id,
                AssessmentSendLink.case_id == case_id,
                AssessmentSendLink.id == send_link_id,
            ]
        )

    @typecheck
    async def get_in_center_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        send_link_id: uuid_str,
    ) -> AssessmentSendLink:
        send_link = await self.find_in_center_case(
            center_id=center_id,
            case_id=case_id,
            send_link_id=send_link_id,
        )
        if send_link is None:
            raise EntityNotFoundException(f"AssessmentSendLink not found: {send_link_id}")
        return send_link

    @typecheck
    async def list_by_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> list[AssessmentSendLink]:
        return await self._filter(
            where=[
                AssessmentSendLink.center_id == center_id,
                AssessmentSendLink.case_id == case_id,
            ],
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_active_by_case(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> list[AssessmentSendLink]:
        now = utc_now()
        return await self._filter(
            where=[
                AssessmentSendLink.center_id == center_id,
                AssessmentSendLink.case_id == case_id,
                AssessmentSendLink.revoked_at.is_(None),
                (
                    AssessmentSendLink.expires_at.is_(None)
                    | (AssessmentSendLink.expires_at > now)
                ),
            ],
            order_by="created_at",
            descending=True,
        )

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
    async def find_by_id_public(self, send_link_id: uuid_str) -> AssessmentSendLink | None:
        # 공개 인증(수신자 본인)용 — center 스코프 없이 id로만 조회
        return await self._find(where=[AssessmentSendLink.id == send_link_id])

    @typecheck
    async def get_by_id_public(self, send_link_id: uuid_str) -> AssessmentSendLink:
        send_link = await self.find_by_id_public(send_link_id=send_link_id)
        if send_link is None:
            raise EntityNotFoundException(f"AssessmentSendLink not found: {send_link_id}")
        return send_link

    @typecheck
    async def find_by_verification_code(
        self,
        send_link_id: uuid_str,
        verification_code: str,
    ) -> AssessmentSendLink | None:
        return await self._find(
            where=[
                AssessmentSendLink.id == send_link_id,
                AssessmentSendLink.verification_code == verification_code,
            ]
        )
