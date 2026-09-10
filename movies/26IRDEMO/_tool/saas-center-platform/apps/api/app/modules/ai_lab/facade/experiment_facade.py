from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..experiment_run.models import LabExperimentRun
from ..experiment_run.repository import LabExperimentRunRepository
from ..experiment_run.services.delete_experiment_run import DeleteExperimentRunService
from ..experiment_run.services.evaluate_experiment_run import EvaluateExperimentRunService
from ..experiment_run.services.find_experiment_run import FindExperimentRunService
from ..experiment_run.services.get_experiment_run import GetExperimentRunService
from ..experiment_run.services.list_experiment_runs import ListExperimentRunsService
from ..experiment_run.services.run_stt_experiment import RunSTTExperimentService
from ..experiment_run.services.run_llm_experiment import RunLLMExperimentService
from ..experiment_run.services.run_chain_experiment import RunChainExperimentService
from ..sample_dataset.repository import LabSampleDatasetRepository
from ..sample_dataset.services.find_sample import FindSampleService


class ExperimentFacade:
    # ai = AIFacade(소비처 handler가 create_ai_facade()로 취득해 주입 — 실험 실행 메서드만 필요)
    def __init__(
        self,
        uow: UnitOfWork,
        ai=None,
    ) -> None:
        self._uow = uow
        self._ai = ai

    async def list_experiments(self, **kwargs) -> tuple[list[LabExperimentRun], Page]:
        return await ListExperimentRunsService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(**kwargs)

    async def find_experiment(self, experiment_id: str) -> LabExperimentRun | None:
        return await FindExperimentRunService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(experiment_id)

    async def delete_experiment(self, experiment_id: str) -> None:
        await DeleteExperimentRunService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(experiment_id)

    async def evaluate_experiment(
        self, experiment_id: str, quality_score: int, quality_note: str | None = None,
    ) -> LabExperimentRun | None:
        return await EvaluateExperimentRunService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(
            experiment_id,
            quality_score=quality_score,
            quality_note=quality_note,
        )

    async def aggregate_costs(
        self,
        *,
        production_summary: dict,
        date_from=None,
        date_to=None,
    ) -> dict:
        # production_summary는 크로스모듈(llm) — application handler가 주입.
        from ..experiment_run.services.aggregate_costs import AggregateCostsService

        return await AggregateCostsService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(
            production_summary=production_summary,
            date_from=date_from,
            date_to=date_to,
        )

    async def calculate_diarization_accuracy(self, experiment_id: str) -> dict:
        from ..experiment_run.services.calculate_diarization_accuracy import (
            CalculateDiarizationAccuracyService,
        )

        run = await GetExperimentRunService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(experiment_id)
        sample = None
        if run.sample_id:
            sample = await FindSampleService(
                self._uow.repo(LabSampleDatasetRepository)
            ).execute(run.sample_id)
        return CalculateDiarizationAccuracyService().execute(run, sample)

    async def generate_prompt_suggestion(self, experiment_id: str, model: str = "gpt-4o") -> dict:
        from ..experiment_run.services.generate_prompt_suggestion import (
            GeneratePromptSuggestionService,
        )

        run = await GetExperimentRunService(
            self._uow.repo(LabExperimentRunRepository)
        ).execute(experiment_id)
        sample = None
        if run.sample_id:
            sample = await FindSampleService(
                self._uow.repo(LabSampleDatasetRepository)
            ).execute(run.sample_id)
        return await GeneratePromptSuggestionService(self._ai).execute(run, sample, model=model)

    async def run_stt_experiment(self, **kwargs) -> LabExperimentRun:
        repo = self._uow.repo(LabExperimentRunRepository)
        return await RunSTTExperimentService(repo, self._ai).execute(**kwargs)

    async def run_text_diarize_eval(self, **kwargs) -> dict:
        repo = self._uow.repo(LabExperimentRunRepository)
        return await RunSTTExperimentService(repo, self._ai).run_text_diarize_eval(**kwargs)

    async def run_llm_experiment(self, **kwargs) -> LabExperimentRun:
        repo = self._uow.repo(LabExperimentRunRepository)
        return await RunLLMExperimentService(repo, self._ai).execute(**kwargs)

    async def run_chain_experiment(self, **kwargs) -> LabExperimentRun:
        repo = self._uow.repo(LabExperimentRunRepository)
        return await RunChainExperimentService(repo, self._ai).execute(**kwargs)
