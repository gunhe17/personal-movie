from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingCaseAnalysis


class CounselingCaseAnalysisRepository(PostgresRepository[CounselingCaseAnalysis]):
    model = CounselingCaseAnalysis

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_case_id: uuid_str,
        triggered_by: uuid_str,
    ) -> CounselingCaseAnalysis:
        # pre-create(processing) — 완성 데이터는 워커가 update_in_place로 채움
        return await super().add(
            CounselingCaseAnalysis(
                center_id=center_id,
                counseling_case_id=counseling_case_id,
                triggered_by=triggered_by,
                status="processing",
                content={},
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        status: str = unset,
        content: dict = unset,
        session_count: int = unset,
        model_used: str | None = unset,
        input_tokens: int = unset,
        output_tokens: int = unset,
        error_message: str | None = unset,
    ) -> CounselingCaseAnalysis:
        await self.get_by_id(id)
        updated = await self.update_fields(
            id,
            status=status,
            content=content,
            session_count=session_count,
            model_used=model_used,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            error_message=error_message,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_latest_by_case(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
        completed_only: bool = False,
    ) -> CounselingCaseAnalysis | None:
        # 기본은 **상태 무관 최신 1건** — 화면이 processing/failed를 그대로 보여줘야
        # "눌렀는데 아무 일도 없다"가 사라진다(옛 completed-only는 진행 중을 숨겼다).
        where = [
            CounselingCaseAnalysis.counseling_case_id == case_id,
            CounselingCaseAnalysis.center_id == center_id,
        ]
        if completed_only:
            where.append(CounselingCaseAnalysis.status == "completed")
        return await self._find(
            where=where,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_case(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
    ) -> list[CounselingCaseAnalysis]:
        return await self._filter(
            where=[
                CounselingCaseAnalysis.counseling_case_id == case_id,
                CounselingCaseAnalysis.center_id == center_id,
                CounselingCaseAnalysis.status == "completed",
            ],
            order_by="created_at",
            descending=True,
        )
