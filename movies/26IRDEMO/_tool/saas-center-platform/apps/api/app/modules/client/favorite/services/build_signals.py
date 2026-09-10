from datetime import datetime

from app.core.datetime_utils import utc_now
from ..schemas import ClientSignal


class BuildClientSignalsService:
    def execute(
        self,
        *,
        today_sessions: dict[str, object] | None = None,
        unlogged_sessions: dict[str, object] | None = None,
        unshared_assessments: dict[str, object] | None = None,
    ) -> dict[str, ClientSignal]:
        signals: dict[str, ClientSignal] = {}

        # 1순위: 오늘 회기
        if today_sessions:
            for client_id, payload in today_sessions.items():
                if client_id in signals:
                    continue
                start = getattr(payload, "start", None)
                signals[client_id] = ClientSignal(
                    type="session_today",
                    icon_name="time-outline",
                    detail=f"오늘 {self._format_time(start)} 상담",
                    action="지난 일지를 검토해 주세요",
                )

        # 2순위: 일지 미작성
        if unlogged_sessions:
            for client_id, payload in unlogged_sessions.items():
                if client_id in signals:
                    continue
                completed_at = getattr(payload, "completed_at", None)
                signals[client_id] = ClientSignal(
                    type="log_missing",
                    icon_name="document-text-outline",
                    detail=f"{self._format_relative_date(completed_at)} 상담",
                    action="일지를 작성해 주세요",
                )

        # 3순위: 검사 결과 미공유
        if unshared_assessments:
            for client_id, payload in unshared_assessments.items():
                if client_id in signals:
                    continue
                completed_at = getattr(payload, "completed_at", None)
                signals[client_id] = ClientSignal(
                    type="assessment_result_ready",
                    icon_name="analytics-outline",
                    detail=f"{self._format_relative_date(completed_at)} 검사 완료",
                    action="결과를 공유해 주세요",
                )

        return signals

    @staticmethod
    def _format_time(dt: datetime | None) -> str:
        if dt is None:
            return ""
        # DB는 UTC naive로 저장 — 표시용 KST 변환
        kst_hour = (dt.hour + 9) % 24
        return f"{kst_hour:02d}:{dt.minute:02d}"

    @staticmethod
    def _format_relative_date(dt: datetime | None) -> str:
        if dt is None:
            return ""
        now = utc_now()
        delta_days = (now.date() - dt.date()).days
        if delta_days <= 0:
            return "오늘"
        if delta_days == 1:
            return "어제"
        if delta_days < 7:
            return f"{delta_days}일 전"
        return f"{dt.year}.{dt.month:02d}.{dt.day:02d}"
