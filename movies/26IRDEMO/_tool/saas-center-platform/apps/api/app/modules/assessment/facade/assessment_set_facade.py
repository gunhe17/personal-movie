from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..assessment.repository import AssessmentRepository
from ..assessment.services import GetAssessmentsByIdsService
from ..assessment_set.events import AssessmentSetAtomic
from ..assessment_set.models import AssessmentSet
from ..assessment_set.repository import AssessmentSetRepository
from ..assessment_set.schemas import (
    AssessmentSetCreate,
    AssessmentSetUpdate,
    AssessmentSetResponse,
    AssessmentSetSummary,
    AssessmentSetListResponse,
    AssessmentSummary,
)
from ..assessment_set.services import (
    CreateAssessmentSetService,
    GetAssessmentSetService,
    ListAssessmentSetsService,
    ListSetsByIdsService,
    UpdateAssessmentSetService,
    DeleteAssessmentSetService,
)


class AssessmentSetFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_assessment_set_summaries_by_ids(
        self, set_ids: list[str]
    ) -> dict[str, str]:
        if not set_ids:
            return {}
        repo = self._uow.repo(AssessmentSetRepository)
        sets = await ListSetsByIdsService(repo).execute(set_ids)
        return {s.id: s.name for s in sets}

    async def create_set(
        self,
        center_id: str,
        name: str,
        assessment_ids: list[str],
        description: str | None = None,
        center_member_ids: list[str] | None = None,
        center_member_summary: list[dict] | None = None,
    ) -> tuple["AssessmentSetAtomic", AssessmentSet]:
        data = AssessmentSetCreate(
            name=name,
            assessment_ids=assessment_ids,
            description=description,
            center_member_ids=center_member_ids,
        )
        assessment_summary = await self._build_assessment_summary(data.assessment_ids)

        repo = self._uow.repo(AssessmentSetRepository)
        service = CreateAssessmentSetService(repo)
        return await service.execute(
            center_id=center_id,
            name=data.name,
            description=data.description,
            assessment_summary=assessment_summary,
            center_member_summary=center_member_summary,
        )

    async def update_set(
        self,
        center_id: str,
        set_id: str,
        name: str | None = None,
        description: str | None = None,
        assessment_ids: list[str] | None = None,
        center_member_ids: list[str] | None = None,
        center_member_summary: list[dict] | None = None,
        changed: dict | None = None,
    ) -> tuple["AssessmentSetAtomic", AssessmentSet]:
        data = AssessmentSetUpdate(
            name=name,
            description=description,
            assessment_ids=assessment_ids,
            center_member_ids=center_member_ids,
        )

        assessment_summary = None
        if data.assessment_ids is not None:
            assessment_summary = await self._build_assessment_summary(
                data.assessment_ids
            )

        if data.center_member_ids is not None and center_member_summary is None:
            center_member_summary = []

        repo = self._uow.repo(AssessmentSetRepository)
        service = UpdateAssessmentSetService(repo)
        return await service.execute(
            center_id=center_id,
            set_id=set_id,
            changed=changed
            if changed is not None
            else data.model_dump(mode="json", exclude_unset=True),
            assessment_summary=assessment_summary,
            center_member_summary=center_member_summary,
            # 미전달 필드는 None으로 재구성되므로 exclude_none(omit) — repo unset 기본값 적용.
            **data.model_dump(
                exclude_none=True, exclude={"assessment_ids", "center_member_ids"}
            ),
        )

    async def list_sets_with_response(
        self,
        center_id: str,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        assessment_type: str | None = None,
    ) -> AssessmentSetListResponse:
        repo = self._uow.repo(AssessmentSetRepository)
        service = ListAssessmentSetsService(repo)

        sets, page_meta = await service.execute(
            center_id,
            page=page,
            size=size,
            search=search,
            assessment_type=assessment_type,
        )
        total = page_meta["total"]
        pages = page_meta["pages"]

        if not sets:
            return AssessmentSetListResponse(
                items=[],
                total=0,
                page=page,
                size=size,
                pages=0,
            )

        all_assessment_ids: set[str] = set()
        for assessment_set in sets:
            for summary in assessment_set.assessment_summary:
                all_assessment_ids.add(summary["id"])

        assessment_repo = self._uow.repo(AssessmentRepository)
        get_assessments_service = GetAssessmentsByIdsService(assessment_repo)
        assessments = await get_assessments_service.execute(list(all_assessment_ids))
        assessment_map = {a.id: a for a in assessments}

        items = []
        for assessment_set in sets:
            assessment_summaries = []
            for summary in assessment_set.assessment_summary:
                assessment = assessment_map.get(summary["id"])
                if not assessment:
                    continue

                assessment_summaries.append(
                    AssessmentSummary(
                        id=assessment.id,
                        code=assessment.code,
                        kor_name=assessment.kor_name,
                        eng_name=assessment.eng_name,
                        assessment_type=assessment.assessment_type,
                        duration=assessment.duration,
                        supports_online=assessment.supports_online,
                    )
                )

            items.append(
                AssessmentSetSummary(
                    id=assessment_set.id,
                    name=assessment_set.name,
                    description=assessment_set.description,
                    assessments=assessment_summaries,
                    created_at=assessment_set.created_at,
                )
            )

        return AssessmentSetListResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_set_with_response(
        self,
        center_id: str,
        set_id: str,
    ) -> AssessmentSetResponse:
        repo = self._uow.repo(AssessmentSetRepository)
        service = GetAssessmentSetService(repo)
        assessment_set = await service.execute(center_id, set_id)

        return AssessmentSetResponse.model_validate(assessment_set)

    async def delete_set(
        self,
        center_id: str,
        set_id: str,
    ) -> tuple[AssessmentSetAtomic, dict]:
        repo = self._uow.repo(AssessmentSetRepository)
        service = DeleteAssessmentSetService(repo)
        atomic, _ = await service.execute(center_id, set_id)

        return atomic, {"message": "검사 세트가 삭제되었습니다"}

    async def _build_assessment_summary(
        self,
        assessment_ids: list[str],
    ) -> list[dict]:
        assessment_repo = self._uow.repo(AssessmentRepository)
        get_assessments_service = GetAssessmentsByIdsService(assessment_repo)
        assessments = await get_assessments_service.execute(assessment_ids)
        assessment_map = {a.id: a for a in assessments}

        summary = []
        for assessment_id in assessment_ids:
            assessment = assessment_map.get(assessment_id)
            if not assessment:
                continue
            summary.append(
                {
                    "id": assessment.id,
                    "code": assessment.code,
                    "kor_name": assessment.kor_name,
                    "eng_name": assessment.eng_name,
                    "assessment_type": assessment.assessment_type,
                    "duration": assessment.duration,
                }
            )
        return summary
