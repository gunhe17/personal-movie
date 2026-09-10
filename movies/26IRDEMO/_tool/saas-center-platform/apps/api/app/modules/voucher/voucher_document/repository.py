from sqlalchemy import select
from sqlalchemy.dialects.postgresql.ranges import Range

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import VoucherDocument


class VoucherDocumentRepository(PostgresRepository[VoucherDocument]):
    model = VoucherDocument

    # #
    # command

    @typecheck
    async def add(
        self,
        voucher_id: uuid_str,
        global_document_id: uuid_str,
        page_range: Range | None = None,
    ) -> VoucherDocument:
        return await super().add(
            VoucherDocument(
                voucher_id=voucher_id,
                global_document_id=global_document_id,
                page_range=page_range,
            )
        )

    @typecheck
    async def restore_pair(self, id: uuid_str, page_range: Range | None = None) -> VoucherDocument:
        # soft-deleted 링크 복원(재링크) + page_range 갱신
        rows = await self._scalars(select(VoucherDocument).where(VoucherDocument.id == id))
        record = rows[0]
        record.deleted_at = None
        record.page_range = page_range
        await self._session.flush()
        return record

    # #
    # query

    @typecheck
    async def list_by_voucher(self, voucher_id: uuid_str) -> list[VoucherDocument]:
        return await self._filter(
            where=[VoucherDocument.voucher_id == voucher_id],
            order_by="created_at",
        )


    @typecheck
    async def find_pair(
        self,
        voucher_id: uuid_str,
        global_document_id: uuid_str,
    ) -> VoucherDocument | None:
        return await self._find(
            where=[
                VoucherDocument.voucher_id == voucher_id,
                VoucherDocument.global_document_id == global_document_id,
            ]
        )

    @typecheck
    async def get_pair(
        self,
        voucher_id: uuid_str,
        global_document_id: uuid_str,
    ) -> VoucherDocument:
        link = await self.find_pair(
            voucher_id=voucher_id,
            global_document_id=global_document_id,
        )
        if link is None:
            raise EntityNotFoundException("이 사업에 연결되지 않은 자료입니다")
        return link

    @typecheck
    async def find_pair_including_deleted(
        self,
        voucher_id: uuid_str,
        global_document_id: uuid_str,
    ) -> VoucherDocument | None:
        stmt = select(VoucherDocument).where(
            VoucherDocument.voucher_id == voucher_id,
            VoucherDocument.global_document_id == global_document_id,
        )
        rows = await self._scalars(stmt)
        return rows[0] if rows else None
