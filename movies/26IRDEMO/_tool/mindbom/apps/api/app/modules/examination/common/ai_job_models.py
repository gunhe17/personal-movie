"""AI 분석 작업 기록.

왜 상태가 아니라 작업(job)인가
------------------------------
examination.status에 ai_analyzing이 있었지만 그건 상태가 아니라 작업이었다:

  - 순간적이다. 같은 동기 요청 안에서 진입·탈출한다.
  - 반복된다. 재분석하면 다시 들어간다(로르샤하는 영역마다).
  - 실패한다. 그런데 되돌리는 코드가 없어 브라우저를 닫으면 영구히 갇혔다.
  - 어떤 검사에는 아예 없다. 앞으로 붙을 표준화 검사(MMPI·웩슬러 등)는
    규준표 기반이라 AI 분석 단계가 없는데, status에 있으면 억지로
    통과해야 한다(SCT가 이미 상태 머신을 우회하는 이유).

여기로 옮기면 status는 임상 워크플로(초안 → 검토 → 확정)만 담고,
분석의 진행·실패·소요시간·재시도는 이 표가 담는다.

지금까지 없던 것을 채운다: 실패 사유, 재분석 이력, 소요시간 실측
(대시보드가 "전이 타임스탬프가 없어 근사"라고 주석을 달고 있었다),
모델 버전(Examination에 단일 슬롯이라 재분석하면 덮어써졌다).
"""
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel

# 작업 상태 — examination.status와 별개다.
JOB_RUNNING = "running"
JOB_SUCCEEDED = "succeeded"
JOB_FAILED = "failed"

JOB_STATUSES = (JOB_RUNNING, JOB_SUCCEEDED, JOB_FAILED)


class AIAnalysisJob(BaseModel):
    """AI 분석 1회 실행 기록.

    Attributes:
        examination_id: 대상 검사
        module: htp | rorschach | sct
        scope: 무엇을 분석했는지. 검사 전체면 'session',
               로르샤하 영역별 채점처럼 부분이면 그 식별자를 남긴다.
        status: running | succeeded | failed
        error_message: 실패 사유(사용자에게 보여줄 수 있는 수준)
        ai_model_version: 이 실행이 쓴 모델. 재분석해도 이전 기록이 남는다.
    """

    __tablename__ = "ai_analysis_jobs"

    examination_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, comment="검사 ID"
    )
    module: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="검사 모듈: htp|rorschach|sct"
    )
    scope: Mapped[str] = mapped_column(
        String(64), nullable=False, default="session",
        comment="분석 범위: session 또는 부분 식별자(로르샤하 response id 등)",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=JOB_RUNNING,
        comment="running|succeeded|failed",
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, comment="시작 시각 (UTC)"
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, comment="종료 시각 (UTC)"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="실패 사유"
    )
    ai_model_version: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="사용한 AI 모델 버전 (SaMD 추적)"
    )

    @property
    def duration_sec(self) -> float | None:
        """소요 시간 — 끝난 작업만."""
        if self.finished_at is None:
            return None
        return (self.finished_at - self.started_at).total_seconds()
