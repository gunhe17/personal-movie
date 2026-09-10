from .models import CenterApplication, CenterApplicationStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository



class CenterApplicationRepository(PostgresRepository[CenterApplication]):
    model = CenterApplication

    # #
    # command

    @typecheck
    async def add(
        self,
        created_by: uuid_str,
        name: str,
        status: str,
        phone: str | None = None,
        address: dict | None = None,
        description: str | None = None,
        business_registration_number: str | None = None,
        representative_name: str | None = None,
    ) -> CenterApplication:
        return await super().add(
            CenterApplication(
                created_by=created_by,
                name=name,
                status=status,
                phone=phone,
                address=address,
                description=description,
                business_registration_number=business_registration_number,
                representative_name=representative_name,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: str = unset,
        reviewed_at: utc_dt | None = unset,
        reviewed_by: uuid_str | None = unset,
        reviewed_reason: str | None = unset,
        center_id: uuid_str | None = unset,
    ) -> CenterApplication | None:
        return await self.update_fields(
            id,
            status=status,
            reviewed_at=reviewed_at,
            reviewed_by=reviewed_by,
            reviewed_reason=reviewed_reason,
            center_id=center_id,
        )

    # #
    # query

    @typecheck
    async def get_by_account(
        self,
        id: uuid_str,
        account_id: uuid_str,
    ) -> CenterApplication:
        application = await self._find(
            where=[
                CenterApplication.id == id,
                CenterApplication.created_by == account_id,
            ]
        )
        if application is None:
            raise EntityNotFoundException(f"CenterApplication not found: {id}")
        return application

    @typecheck
    async def find_pending_by_account(self, account_id: uuid_str) -> CenterApplication | None:
        return await self._find(
            where=[
                CenterApplication.created_by == account_id,
                CenterApplication.status == CenterApplicationStatus.PENDING,
            ]
        )

    @typecheck
    async def exists_pending_by_account(self, account_id: uuid_str) -> bool:
        application = await self.find_pending_by_account(account_id=account_id)
        return application is not None

    @typecheck
    async def list_pending(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CenterApplication]:
        return await self._filter(
            where=[CenterApplication.status == CenterApplicationStatus.PENDING],
            order_by="created_at",
            limit=limit,
            offset=skip,
        )

    @typecheck
    async def count_pending(self) -> int:
        return await self._count(where=[CenterApplication.status == CenterApplicationStatus.PENDING])

    @typecheck
    async def list_with_filter(
        self,
        status: str | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CenterApplication]:
        where = [CenterApplication.status == status] if status else None
        return await self._filter(where=where, limit=limit, offset=skip)

    @typecheck
    async def count_with_filter(self, status: str | None = None) -> int:
        where = [CenterApplication.status == status] if status else None
        return await self._count(where=where)

    @typecheck
    async def list_by_account(
        self,
        account_id: uuid_str,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CenterApplication]:
        return await self._filter(
            where=[CenterApplication.created_by == account_id],
            order_by="created_at",
            descending=True,
            limit=limit,
            offset=skip,
        )
