from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.agent_query import merge_fields, normalize_limit, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..assessment.repository import AssessmentRepository
from ..assessment.services import GetAssessmentsByIdsService
from ..assessment_package.events import AssessmentPackageAtomic
from ..assessment_package.models import AssessmentPackage
from ..assessment_package.repository import AssessmentPackageRepository
from ..assessment_package.schemas import (
    AssessmentPackageCreate,
    AssessmentPackageUpdate,
    AssessmentPackageResponse,
    AssessmentPackageSummary,
    AssessmentPackageListResponse,
    AssessmentSummary,
)
from ..assessment_package.services import (
    CreateAssessmentPackageService,
    GetAssessmentPackageService,
    ListAssessmentPackagesService,
    ListAssessmentPackagesByAgentFiltersService,
    UpdateAssessmentPackageService,
    DeleteAssessmentPackageService,
)


class AssessmentPackageFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_package(
        self,
        center_id: str,
        name: str,
        assessment_ids: list[str],
        description: str | None = None,
        center_member_ids: list[str] | None = None,
        center_member_summary: list[dict] | None = None,
        package_price: int | None = None,
        is_active: bool = True,
    ) -> tuple["AssessmentPackageAtomic", AssessmentPackage]:
        data = AssessmentPackageCreate(
            name=name,
            assessment_ids=assessment_ids,
            description=description,
            center_member_ids=center_member_ids,
            package_price=package_price,
            is_active=is_active,
        )
        assessment_summary = await self._build_assessment_summary(data.assessment_ids)

        repo = self._uow.repo(AssessmentPackageRepository)
        service = CreateAssessmentPackageService(repo)
        return await service.execute(
            center_id=center_id,
            name=data.name,
            description=data.description,
            assessment_summary=assessment_summary,
            center_member_summary=center_member_summary,
            package_price=data.package_price,
            is_active=data.is_active,
        )

    async def update_package(
        self,
        center_id: str,
        package_id: str,
        name: str | None = None,
        description: str | None = None,
        assessment_ids: list[str] | None = None,
        center_member_ids: list[str] | None = None,
        center_member_summary: list[dict] | None = None,
        package_price: int | None = None,
        is_active: bool | None = None,
        changed: dict | None = None,
    ) -> tuple["AssessmentPackageAtomic", AssessmentPackage]:
        data = AssessmentPackageUpdate(
            name=name,
            description=description,
            assessment_ids=assessment_ids,
            center_member_ids=center_member_ids,
            package_price=package_price,
            is_active=is_active,
        )

        assessment_summary = None
        if data.assessment_ids is not None:
            assessment_summary = await self._build_assessment_summary(data.assessment_ids)

        if data.center_member_ids is not None and center_member_summary is None:
            center_member_summary = []

        repo = self._uow.repo(AssessmentPackageRepository)
        service = UpdateAssessmentPackageService(repo)
        return await service.execute(
            center_id=center_id,
            package_id=package_id,
            changed=changed if changed is not None else data.model_dump(mode="json", exclude_unset=True),
            assessment_summary=assessment_summary,
            center_member_summary=center_member_summary,
            # 미전달 필드는 None으로 재구성되므로 exclude_none(omit) — repo unset 기본값이 적용되게.
            # False/0 등 의미값은 None이 아니라 보존된다.
            **data.model_dump(exclude_none=True, exclude={"assessment_ids", "center_member_ids"}),
        )


    async def list_packages_with_response(
        self,
        center_id: str,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        assessment_type: str | None = None,
    ) -> AssessmentPackageListResponse:
        repo = self._uow.repo(AssessmentPackageRepository)
        service = ListAssessmentPackagesService(repo)

        packages, page_meta = await service.execute(
            center_id, page=page, size=size,
            search=search, assessment_type=assessment_type,
        )
        total = page_meta["total"]
        pages = page_meta["pages"]

        if not packages:
            return AssessmentPackageListResponse(
                items=[], total=0, page=page, size=size, pages=0,
            )

        all_assessment_ids: set[str] = set()
        for assessment_package in packages:
            for summary in assessment_package.assessment_summary:
                all_assessment_ids.add(summary["id"])

        assessment_repo = self._uow.repo(AssessmentRepository)
        get_assessments_service = GetAssessmentsByIdsService(assessment_repo)
        assessments = await get_assessments_service.execute(list(all_assessment_ids))
        assessment_map = {a.id: a for a in assessments}

        items = []
        for assessment_package in packages:
            assessment_summaries = []
            for summary in assessment_package.assessment_summary:
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
                    )
                )

            items.append(
                AssessmentPackageSummary(
                    id=assessment_package.id,
                    name=assessment_package.name,
                    description=assessment_package.description,
                    assessments=assessment_summaries,
                    package_price=assessment_package.package_price,
                    is_active=assessment_package.is_active,
                    created_at=assessment_package.created_at,
                )
            )

        return AssessmentPackageListResponse(
            items=items, total=total, page=page, size=size, pages=pages,
        )

    async def query_assessment_package(
        self,
        center_id: str,
        *,
        name: str | None = None,
        keyword: str | None = None,
        package_price_min: int | None = None,
        package_price_max: int | None = None,
        is_active: bool | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        id: str | None = None,
        ids: list[str] | None = None,
        sort: str | None = None,
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        collected = list(ids or [])
        if id:
            collected.append(id)
        merged_ids = collected or None

        repo = self._uow.repo(AssessmentPackageRepository)
        rows, total = await ListAssessmentPackagesByAgentFiltersService(repo).execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            name=name,
            keyword=keyword,
            package_price_min=package_price_min,
            package_price_max=package_price_max,
            is_active=is_active,
            date_from=coerce_date(date_from, "date_from"),
            date_to=coerce_date(date_to, "date_to"),
            ids=merged_ids,
        )

        identity = ["id"]
        default = ["id", "name", "package_price", "is_active"]
        available = {"id", "name", "package_price", "is_active", "description"}
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(rows, merged, "assessment_package" if namespaced else ""), total

    async def get_package_with_response(
        self,
        center_id: str,
        package_id: str,
    ) -> AssessmentPackageResponse:
        repo = self._uow.repo(AssessmentPackageRepository)
        service = GetAssessmentPackageService(repo)
        assessment_package = await service.execute(center_id, package_id)

        return AssessmentPackageResponse.model_validate(assessment_package)

    async def delete_package(
        self,
        center_id: str,
        package_id: str,
    ) -> tuple[AssessmentPackageAtomic, dict]:
        repo = self._uow.repo(AssessmentPackageRepository)
        service = DeleteAssessmentPackageService(repo)
        atomic, _ = await service.execute(center_id, package_id)

        return atomic, {"message": "검사 패키지가 삭제되었습니다"}

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
            summary.append({
                "id": assessment.id,
                "code": assessment.code,
                "kor_name": assessment.kor_name,
                "eng_name": assessment.eng_name,
                "assessment_type": assessment.assessment_type,
                "duration": assessment.duration,
            })
        return summary
