"""AI 분석 작업 기록 서비스.

분석을 감싸서 시작·성공·실패를 남긴다. 예전에는 examination.status를
ai_analyzing으로 바꿔 두고 실패하면 되돌리는 코드가 없어 그대로 갇혔는데,
여기서는 실패해도 job에 사유가 남고 검사 상태는 건드리지 않는다.
"""
import logging
from contextlib import asynccontextmanager

from app.core.database import AsyncSessionLocal
from app.core.datetime_utils import utc_now
from app.modules.examination.common.ai_job_models import (
    JOB_FAILED,
    JOB_RUNNING,
    JOB_SUCCEEDED,
    AIAnalysisJob,
)
from app.modules.examination.common.ai_job_repository import AIAnalysisJobRepository

logger = logging.getLogger(__name__)


class AIAnalysisJobService:
    """
    session_factory는 **실패 기록 전용**이다(_persist_failure 주석 참고).
    성공 경로는 이 값을 건드리지 않으므로 기존 호출부는 그대로 둔다.
    """

    def __init__(self, uow, *, session_factory=None):
        self._uow = uow
        self._session_factory = session_factory or AsyncSessionLocal

    def _repo(self) -> AIAnalysisJobRepository:
        return self._uow.repo(AIAnalysisJobRepository)

    async def start(
        self, examination_id: str, module: str, *, scope: str = "session"
    ) -> AIAnalysisJob:
        return await self._repo().create({
            "examination_id": examination_id,
            "module": module,
            "scope": scope,
            "status": JOB_RUNNING,
            "started_at": utc_now(),
        })

    async def succeed(self, job: AIAnalysisJob, *, model_version: str | None = None) -> None:
        job.status = JOB_SUCCEEDED
        job.finished_at = utc_now()
        job.ai_model_version = model_version
        await self._repo().flush()

    async def fail(self, job: AIAnalysisJob, error: str) -> None:
        job.status = JOB_FAILED
        job.finished_at = utc_now()
        # 사용자에게 그대로 보일 수 있으므로 너무 긴 스택은 잘라 둔다.
        job.error_message = error[:2000]
        await self._repo().flush()
        await self._persist_failure(job)

    async def _persist_failure(self, job: AIAnalysisJob) -> None:
        """실패 기록을 **바깥 트랜잭션과 무관하게** 남긴다.

        왜 별도 세션인가
        ----------------
        fail()의 호출부는 예외를 그대로 올려보내고, 핸들러의 `async with uow`가
        그 예외를 받아 rollback한다(UnitOfWork.__aexit__). 그래서 같은 세션에
        flush한 실패 사유는 **적자마자 함께 지워졌다** — 실측하니 40건의 job이
        전부 succeeded였고 failed는 0건이었다. "AI가 언제 왜 실패했는가"는
        SaMD 추적 항목인데 통째로 비어 있던 셈이다.

        같은 세션에서 commit해 버리면 안 된다. 그 시점의 세션에는 저장된 탐지
        결과·삭제된 해석처럼 **중간까지만 진행된 분석**이 함께 담겨 있어서,
        commit하면 반쪽짜리 분석 결과가 확정된다. 롤백은 그대로 두고 실패
        기록만 따로 빼내는 게 맞다.

        왜 원본 job을 update하지 않고 새 행을 넣는가
        --------------------------------------------
        start()의 create()가 이미 flush했으므로 바깥 트랜잭션이 그 id의
        INSERT를 잡고 있다(아직 미커밋). 여기서 같은 id를 쓰면 별도 세션이
        그 행 잠금을 기다리다 멈춘다 — 바깥은 이 await가 끝나야 롤백하므로
        서로를 기다리는 교착이 된다. 그래서 새 id로 넣는다. 원본 running
        행은 어차피 롤백으로 사라지므로 중복도 남지 않는다.

        기록 자체가 실패해도 원래 예외를 가리지 않는다 — 로그만 남기고 삼킨다.
        """
        try:
            async with self._session_factory() as session:
                session.add(AIAnalysisJob(
                    examination_id=job.examination_id,
                    module=job.module,
                    scope=job.scope,
                    status=JOB_FAILED,
                    started_at=job.started_at,
                    finished_at=job.finished_at,
                    error_message=job.error_message,
                    ai_model_version=job.ai_model_version,
                ))
                await session.commit()
        except Exception:
            logger.exception(
                "AI 분석 실패 기록 저장 실패 — exam_id=%s module=%s scope=%s",
                job.examination_id, job.module, job.scope,
            )

    @asynccontextmanager
    async def track(
        self, examination_id: str, module: str, *, scope: str = "session"
    ):
        """분석 구간을 감싼다.

            async with jobs.track(exam_id, "htp") as job:
                ...분석...
                job.model_version = "v1.2"   # 선택

        예외가 나면 job을 failed로 기록하고 그대로 올려보낸다. 상위(UoW)가
        롤백해도 실패 기록은 남는다 — fail()이 별도 세션에 따로 쓴다
        (_persist_failure 주석).
        """
        job = await self.start(examination_id, module, scope=scope)
        holder = _JobHandle(job)
        try:
            yield holder
        except Exception as exc:
            await self.fail(job, f"{type(exc).__name__}: {exc}")
            logger.warning(
                "AI 분석 실패 — exam_id=%s module=%s scope=%s",
                examination_id, module, scope, exc_info=True,
            )
            raise
        else:
            await self.succeed(job, model_version=holder.model_version)


class _JobHandle:
    """분석 중 모델 버전을 넘겨받기 위한 얇은 핸들."""

    def __init__(self, job: AIAnalysisJob):
        self.job = job
        self.model_version: str | None = None
