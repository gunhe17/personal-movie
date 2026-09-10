from app.core.exceptions import InvalidOperationException
from ..events import ExperimentGroupAtomic
from ..models import LabExperimentGroup
from ..repository import LabExperimentGroupRepository


class CreateExperimentGroupService:
    def __init__(self, repo: LabExperimentGroupRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        experiment_type: str,
        sample_id: str,
        variants: list[dict],
        description: str | None = None,
        tags: str | None = None,
        memo: str | None = None,
        author_id: str | None = None,
    ) -> tuple[ExperimentGroupAtomic, LabExperimentGroup]:
        # verify
        total_runs = len(variants)
        if total_runs < 2:
            raise InvalidOperationException("배치 실험은 최소 2개 이상의 변형이 필요합니다.")
        if total_runs > 10:
            raise InvalidOperationException("배치 실험은 최대 10개까지 변형을 허용합니다.")

        # mutate
        group = await self.repo.add(
            name=name,
            experiment_type=experiment_type,
            sample_id=sample_id,
            total_runs=total_runs,
            status="pending",
            completed_runs=0,
            failed_runs=0,
            description=description,
            tags=tags,
            memo=memo,
            author_id=author_id,
        )

        # return
        return ExperimentGroupAtomic.created(group=group, variants=variants)
