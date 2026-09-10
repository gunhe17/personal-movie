"""AI 분석 작업 기록 — 실패가 남는가.

예전에는 분석이 실패하면 아무 데도 기록되지 않았다. examination.status는
ai_analyzing인 채로 남고(되돌리는 코드가 없었다), 사용자는 스낵바 한 줄을
볼 뿐이었으며, 브라우저를 닫으면 그 검사는 영구히 갇혔다.

여기서는 job이 시작·성공·실패를 남기는지, 그리고 실패해도 검사 상태를
건드리지 않는지 확인한다.
"""
from datetime import datetime, timedelta

import pytest

from app.modules.examination.common.ai_job_models import (
    JOB_FAILED,
    JOB_RUNNING,
    JOB_STATUSES,
    JOB_SUCCEEDED,
    AIAnalysisJob,
)
from app.modules.examination.common.ai_job_service import AIAnalysisJobService


class FakeRepo:
    """flush/create만 흉내내는 최소 리포지토리."""

    def __init__(self):
        self.rows: list[AIAnalysisJob] = []

    async def create(self, data: dict) -> AIAnalysisJob:
        job = AIAnalysisJob(**data)
        job.id = f"job-{len(self.rows)}"
        self.rows.append(job)
        return job

    async def flush(self) -> None:
        pass


class FakeUow:
    def __init__(self):
        self._repo = FakeRepo()

    def repo(self, _cls):
        return self._repo


class FakeSession:
    """실패 기록 전용 세션 흉내 — commit된 것만 남긴다.

    바깥 트랜잭션의 롤백과 무관해야 하므로, 커밋되지 않은 add는 보관소에
    들어가지 않는다.
    """

    def __init__(self, store: list[AIAnalysisJob]):
        self._store = store
        self._pending: list[AIAnalysisJob] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    def add(self, row):
        self._pending.append(row)

    async def commit(self):
        self._store.extend(self._pending)
        self._pending = []


class FakeSessionFactory:
    def __init__(self):
        self.committed: list[AIAnalysisJob] = []

    def __call__(self):
        return FakeSession(self.committed)


@pytest.fixture
def durable():
    """롤백을 견디는 저장소 — 여기 남은 것만 실제로 DB에 남는다."""
    return FakeSessionFactory()


@pytest.fixture
def uow():
    return FakeUow()


@pytest.fixture
def svc(uow, durable):
    return AIAnalysisJobService(uow, session_factory=durable)


class TestJobLifecycle:
    async def test_start_records_running(self, svc):
        job = await svc.start("exam-1", "htp")

        assert job.status == JOB_RUNNING
        assert job.examination_id == "exam-1"
        assert job.module == "htp"
        assert job.scope == "session"
        assert job.started_at is not None
        assert job.finished_at is None

    async def test_succeed_records_model_version(self, svc):
        job = await svc.start("exam-1", "sct")
        await svc.succeed(job, model_version="mock-v1")

        assert job.status == JOB_SUCCEEDED
        assert job.finished_at is not None
        assert job.ai_model_version == "mock-v1"

    async def test_fail_records_reason(self, svc):
        job = await svc.start("exam-1", "htp")
        await svc.fail(job, "TimeoutError: AI 서버 응답 없음")

        assert job.status == JOB_FAILED
        assert job.finished_at is not None
        assert "TimeoutError" in job.error_message

    async def test_error_message_is_truncated(self, svc):
        """스택이 통째로 들어와도 컬럼을 넘기지 않는다."""
        job = await svc.start("exam-1", "htp")
        await svc.fail(job, "x" * 5000)

        assert len(job.error_message) <= 2000

    async def test_scope_distinguishes_partial_analysis(self, svc):
        """로르샤하는 영역마다 채점하므로 scope로 구분된다."""
        a = await svc.start("exam-1", "rorschach", scope="region-1")
        b = await svc.start("exam-1", "rorschach", scope="region-2")

        assert a.scope != b.scope
        assert a.examination_id == b.examination_id


class TestTrackContextManager:
    async def test_success_path(self, svc):
        async with svc.track("exam-1", "htp") as handle:
            handle.model_version = "v2"

        assert handle.job.status == JOB_SUCCEEDED
        assert handle.job.ai_model_version == "v2"

    async def test_failure_is_recorded_and_reraised(self, svc):
        """실패해도 기록은 남고, 예외는 그대로 올라간다."""

        with pytest.raises(RuntimeError, match="AI 서버 다운"):
            async with svc.track("exam-1", "htp") as handle:
                raise RuntimeError("AI 서버 다운")

        assert handle.job.status == JOB_FAILED
        assert "AI 서버 다운" in handle.job.error_message
        assert handle.job.finished_at is not None


class TestFailureSurvivesRollback:
    """실패 기록이 바깥 트랜잭션 롤백에 삼켜지지 않는가.

    이게 깨져 있던 동안 실측 결과는 job 40건 전부 succeeded, failed 0건이었다.
    fail()이 같은 세션에 flush만 하고, 호출부가 예외를 올려보내면 UoW가
    rollback해서 방금 적은 사유까지 함께 지웠기 때문이다.
    """

    async def test_fail_writes_outside_the_uow(self, svc, durable, uow):
        job = await svc.start("exam-1", "htp")
        await svc.fail(job, "TimeoutError: AI 서버 응답 없음")

        assert len(durable.committed) == 1
        row = durable.committed[0]
        assert row.status == JOB_FAILED
        assert row.examination_id == "exam-1"
        assert row.module == "htp"
        assert row.scope == "session"
        assert "TimeoutError" in row.error_message
        assert row.started_at == job.started_at
        assert row.finished_at == job.finished_at

    async def test_durable_row_gets_its_own_id(self, svc, durable):
        """원본 id를 재사용하면 미커밋 INSERT의 행 잠금을 기다리다 교착된다."""
        job = await svc.start("exam-1", "htp")
        await svc.fail(job, "boom")

        assert durable.committed[0].id != job.id

    async def test_success_path_touches_no_extra_session(self, svc, durable):
        """성공 경로는 커넥션을 하나도 더 쓰지 않는다."""
        job = await svc.start("exam-1", "htp")
        await svc.succeed(job, model_version="v1")

        assert durable.committed == []

    async def test_track_failure_is_persisted(self, svc, durable):
        with pytest.raises(RuntimeError):
            async with svc.track("exam-1", "rorschach", scope="resp-3"):
                raise RuntimeError("AI 서버 다운")

        assert len(durable.committed) == 1
        assert durable.committed[0].scope == "resp-3"
        assert "AI 서버 다운" in durable.committed[0].error_message

    async def test_recording_failure_never_masks_the_real_error(self, uow):
        """기록 저장이 실패해도 원래 예외가 그대로 올라가야 한다."""

        def broken_factory():
            raise RuntimeError("DB 커넥션 없음")

        svc = AIAnalysisJobService(uow, session_factory=broken_factory)

        with pytest.raises(ValueError, match="원래 예외"):
            async with svc.track("exam-1", "htp"):
                raise ValueError("원래 예외")


class TestDuration:
    def test_duration_of_finished_job(self):
        job = AIAnalysisJob(
            examination_id="e", module="htp", scope="session", status=JOB_SUCCEEDED,
            started_at=datetime(2026, 8, 10, 0, 0, 0),
            finished_at=datetime(2026, 8, 10, 0, 0, 42),
        )
        assert job.duration_sec == 42.0

    def test_running_job_has_no_duration(self):
        job = AIAnalysisJob(
            examination_id="e", module="htp", scope="session", status=JOB_RUNNING,
            started_at=datetime(2026, 8, 10, 0, 0, 0),
        )
        assert job.duration_sec is None

    def test_duration_enables_real_measurement(self):
        """대시보드가 '전이 타임스탬프가 없어 근사'하던 값을 실측할 수 있다."""
        start = datetime(2026, 8, 10, 0, 0, 0)
        jobs = [
            AIAnalysisJob(
                examination_id="e", module="htp", scope="session",
                status=JOB_SUCCEEDED, started_at=start,
                finished_at=start + timedelta(seconds=s),
            )
            for s in (10, 20, 30)
        ]
        assert sum(j.duration_sec for j in jobs) / len(jobs) == 20.0


class TestStatusVocabulary:
    def test_job_statuses_are_distinct_from_exam_statuses(self):
        """작업 상태와 검사 상태는 다른 어휘다 — 섞이면 축이 다시 합쳐진다."""
        from app.modules.examination.common.state_machine import ALL_STATUSES

        assert set(JOB_STATUSES).isdisjoint(set(ALL_STATUSES))
