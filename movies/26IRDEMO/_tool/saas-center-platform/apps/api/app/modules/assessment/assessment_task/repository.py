from sqlalchemy import case, func, select, update as sql_update

from .models import TaskStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AssessmentTask


class AssessmentTaskRepository(PostgresRepository[AssessmentTask]):
    model = AssessmentTask

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        assessment_id: uuid_str,
        execution_method: str = "onsite",
        process: dict | None = None,
        status: str = "pending",
    ) -> AssessmentTask:
        return await super().add(
            AssessmentTask(
                center_id=center_id,
                case_id=case_id,
                assessment_id=assessment_id,
                execution_method=execution_method,
                process=process if process is not None else {},
                status=status,
            )
        )

    @typecheck
    async def update_task(
        self,
        task_id: uuid_str,
        *,
        status: str = unset,
        process: dict = unset,
        completed_at: utc_dt | None = unset,
        report_payload: dict | None = unset,
        report_document_id: str | None = unset,
        opinion: str | None = unset,
        is_report_visible_to_guardian: bool = unset,
    ) -> AssessmentTask | None:
        return await self.update_fields(
            task_id,
            status=status,
            process=process,
            completed_at=completed_at,
            report_payload=report_payload,
            report_document_id=report_document_id,
            opinion=opinion,
            is_report_visible_to_guardian=is_report_visible_to_guardian,
        )

    @typecheck
    async def remove_by_case(self, case_id: uuid_str) -> list[AssessmentTask]:
        # bulk soft-delete — 영향 행을 RETURNING으로 반환(per-row atomic 사실 기록)
        stmt = (
            sql_update(AssessmentTask)
            .where(
                AssessmentTask.case_id == case_id,
                AssessmentTask.deleted_at.is_(None),
            )
            .values(deleted_at=func.now())
            .returning(AssessmentTask)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    # #
    # query

    @typecheck
    async def find_by_id(self, task_id: uuid_str) -> AssessmentTask | None:
        return await self._find(where=[AssessmentTask.id == task_id])

    @typecheck
    async def get_by_id(self, task_id: uuid_str) -> AssessmentTask:
        task = await self.find_by_id(task_id=task_id)
        if task is None:
            raise EntityNotFoundException(f"AssessmentTask not found: {task_id}")
        return task

    @typecheck
    async def find_by_case_assessment(
        self,
        case_id: uuid_str,
        assessment_id: uuid_str,
    ) -> AssessmentTask | None:
        return await self._find(
            where=[
                AssessmentTask.case_id == case_id,
                AssessmentTask.assessment_id == assessment_id,
            ]
        )

    @typecheck
    async def get_by_case_assessment(
        self,
        case_id: uuid_str,
        assessment_id: uuid_str,
    ) -> AssessmentTask:
        task = await self.find_by_case_assessment(
            case_id=case_id, assessment_id=assessment_id
        )
        if task is None:
            raise EntityNotFoundException(
                f"AssessmentTask not found for case {case_id}, assessment {assessment_id}"
            )
        return task

    @typecheck
    async def list_by_ids(self, task_ids: list[str]) -> list[AssessmentTask]:
        if not task_ids:
            return []
        return await self._filter(where=[AssessmentTask.id.in_(task_ids)])

    @typecheck
    async def list_by_case(
        self,
        case_id: uuid_str,
        execution_method: str | None = None,
    ) -> list[AssessmentTask]:
        where = [AssessmentTask.case_id == case_id]
        if execution_method:
            where.append(AssessmentTask.execution_method == execution_method)
        stmt = (
            select(AssessmentTask)
            .where(AssessmentTask.deleted_at.is_(None), *where)
            .order_by(AssessmentTask.created_at, AssessmentTask.id)
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_in_center_with_filters(
        self,
        center_id: uuid_str,
        *,
        execution_method: str | None = None,
        status_list: list[str] | None = None,
        case_status: str | None = None,
    ) -> list[AssessmentTask]:
        from ..assessment_case.models import AssessmentCase

        conditions = [
            AssessmentTask.center_id == center_id,
            AssessmentTask.deleted_at.is_(None),
            AssessmentCase.deleted_at.is_(None),
        ]
        if execution_method:
            conditions.append(AssessmentTask.execution_method == execution_method)
        if status_list:
            conditions.append(AssessmentTask.status.in_(status_list))
        if case_status:
            conditions.append(AssessmentCase.status == case_status)

        stmt = (
            select(AssessmentTask)
            .join(AssessmentCase, AssessmentTask.case_id == AssessmentCase.id)
            .where(*conditions)
            .order_by(AssessmentTask.created_at.desc(), AssessmentTask.id)
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_cancelled_by_case(self, case_id: uuid_str) -> list[AssessmentTask]:
        return await self._filter(
            where=[
                AssessmentTask.case_id == case_id,
                AssessmentTask.status == TaskStatus.CANCELLED,
            ]
        )

    @typecheck
    async def aggregate_progress_by_case_ids(self, case_ids: list[str]) -> list:
        if not case_ids:
            return []
        stmt = (
            select(
                AssessmentTask.case_id,
                func.count().label("total_count"),
                func.count(
                    case(
                        (AssessmentTask.status == TaskStatus.COMPLETED, 1),
                    )
                ).label("completed_count"),
            )
            .where(
                AssessmentTask.case_id.in_(case_ids),
                AssessmentTask.deleted_at.is_(None),
            )
            .group_by(AssessmentTask.case_id)
        )
        result = await self._session.execute(stmt)
        return list(result.all())
