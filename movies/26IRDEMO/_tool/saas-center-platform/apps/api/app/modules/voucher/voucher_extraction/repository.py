from sqlalchemy import func, or_, select, update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import VoucherExtraction, VoucherExtractionStatus


class VoucherExtractionRepository(PostgresRepository[VoucherExtraction]):
    model = VoucherExtraction

    # #
    # command

    @typecheck
    async def add(
        self,
        source_document_ids: list,
        artifact_document_ids: list,
        completed: dict | None = None,
        status: VoucherExtractionStatus = VoucherExtractionStatus.PROCESSING,
        started_at: utc_dt | None = None,
        progress: dict | None = None,
    ) -> VoucherExtraction:
        return await super().add(
            VoucherExtraction(
                source_document_ids=source_document_ids,
                artifact_document_ids=artifact_document_ids,
                completed=completed,
                status=status,
                started_at=started_at,
                progress=progress,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: str = unset,
        started_at: utc_dt | None = unset,
        completed: dict | None = unset,
        completed_at: utc_dt | None = unset,
        failed: str | None = unset,
        failed_at: utc_dt | None = unset,
        artifact_document_ids: list = unset,
        progress: dict | None = unset,
    ) -> VoucherExtraction:
        await self.get_active(id=id)
        updated = await self.update_fields(
            id,
            status=status,
            started_at=started_at,
            completed=completed,
            completed_at=completed_at,
            failed=failed,
            failed_at=failed_at,
            artifact_document_ids=artifact_document_ids,
            progress=progress,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_by_id_all_states(self, id: uuid_str) -> VoucherExtraction | None:
        rows = await self._scalars(
            select(VoucherExtraction).where(VoucherExtraction.id == id)
        )
        return rows[0] if rows else None

    @typecheck
    async def get_active(self, id: uuid_str) -> VoucherExtraction:
        extraction = await self.find_by_id_all_states(id=id)
        if extraction is None or extraction.deleted_at is not None:
            raise EntityNotFoundException(f"추출 작업을 찾을 수 없습니다: {id}")
        return extraction

    @typecheck
    async def find_for_update(self, id: uuid_str) -> VoucherExtraction | None:
        stmt = (
            select(VoucherExtraction)
            .where(VoucherExtraction.id == id)
            .with_for_update()
        )
        rows = await self._scalars(stmt)
        return rows[0] if rows else None

    @typecheck
    async def get_for_update(self, id: uuid_str) -> VoucherExtraction:
        extraction = await self.find_for_update(id=id)
        if extraction is None or extraction.deleted_at is not None:
            raise EntityNotFoundException(f"추출 작업을 찾을 수 없습니다: {id}")
        return extraction


    @typecheck
    async def claim_stage(
        self,
        id: uuid_str,
        *,
        stage: str,
        now_iso: str,
        stale_iso: str,
    ) -> bool:
        # 스테이지 실행권 선점 — 조건부 UPDATE 한 문장이라 동시 요청 중 하나만 참을 받는다.
        # progress.stage 가 아직 그 단계이고, 아무도 안 잡았거나 잡은 지 stale_iso 보다
        # 오래됐을 때만 claimed_at 을 찍는다(죽은 클레임 자동 회수).
        stmt = (
            sql_update(VoucherExtraction)
            .where(
                VoucherExtraction.id == id,
                VoucherExtraction.deleted_at.is_(None),
                VoucherExtraction.progress["stage"].astext == stage,
                or_(
                    VoucherExtraction.progress["claimed_at"].astext.is_(None),
                    VoucherExtraction.progress["claimed_at"].astext < stale_iso,
                ),
            )
            .values(
                progress=VoucherExtraction.progress.op("||")(
                    func.jsonb_build_object("claimed_at", now_iso)
                )
            )
        )
        result = await self._session.execute(stmt)
        return (result.rowcount or 0) > 0

    @typecheck
    async def pause_if_processing(self, id: uuid_str) -> bool:
        # 중단 = status 를 직접 paused 로. progress 안 표식은 안 쓴다 — 전진이 progress 를
        # 통째로 다시 쓰며 표식을 지워 중단이 유실됐다(실측 2026-08-31). status 는 전진이
        # 건드리지 않으므로 실행자가 다음 청크 경계에서 확실히 본다.
        stmt = (
            sql_update(VoucherExtraction)
            .where(
                VoucherExtraction.id == id,
                VoucherExtraction.deleted_at.is_(None),
                VoucherExtraction.status == VoucherExtractionStatus.PROCESSING,
            )
            .values(status=VoucherExtractionStatus.PAUSED, updated_at=func.now())
        )
        result = await self._session.execute(stmt)
        return (result.rowcount or 0) > 0

    @typecheck
    async def clear_stop(self, id: uuid_str) -> None:
        # 재개 — processing 복귀 + 죽은 실행권 제거(멈춘 실행자가 반납 못 했을 수 있음)
        stmt = (
            sql_update(VoucherExtraction)
            .where(VoucherExtraction.id == id, VoucherExtraction.deleted_at.is_(None))
            .values(
                progress=VoucherExtraction.progress.op("-")("claimed_at"),
                status=VoucherExtractionStatus.PROCESSING,
                updated_at=func.now(),
            )
        )
        await self._session.execute(stmt)

    @typecheck
    async def release_stage(self, id: uuid_str, *, stage: str) -> None:
        # 실행권 반납 — 아직 같은 단계일 때만. 이미 다음 단계로 넘어갔다면 그 단계를
        # 집은 쪽의 클레임이므로 건드리지 않는다.
        stmt = (
            sql_update(VoucherExtraction)
            .where(
                VoucherExtraction.id == id,
                VoucherExtraction.deleted_at.is_(None),
                VoucherExtraction.progress["stage"].astext == stage,
            )
            .values(progress=VoucherExtraction.progress.op("-")("claimed_at"))
        )
        await self._session.execute(stmt)

    @typecheck
    async def list_stuck_processing(self, *, stale_before: utc_dt) -> list[VoucherExtraction]:
        # 안전망 대상 — 조회-트리거가 한동안 안 온 processing 건. stale_before로 활발히
        # 전진 중(방금 갱신)인 건은 제외해 조회-트리거와의 이중 전진 경합을 피한다.
        return await self._filter(
            where=[
                VoucherExtraction.status == VoucherExtractionStatus.PROCESSING,
                VoucherExtraction.updated_at < stale_before,
            ]
        )

    @typecheck
    async def list_paginated_with_page(
        self,
        status: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[VoucherExtraction], Page]:
        where = []
        if status:
            where.append(VoucherExtraction.status == status)
        return await self._page(
            where=where,
            page=page,
            size=size,
            order_by="created_at",
            descending=True,
        )
