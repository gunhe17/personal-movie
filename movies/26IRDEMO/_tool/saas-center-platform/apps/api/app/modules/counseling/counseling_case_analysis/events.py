from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingCaseAnalysis


@dataclass(frozen=True, kw_only=True)
class CaseAnalysisAtomic:
    _act: str
    analysis: CounselingCaseAnalysis
    # LLM 과금 귀속 멤버 — 분석 행에 저장하지 않는 요청 문맥이라 payload로 반응에 전달
    _member_id: uuid_str | None = None
    # 분석 범위(최근 N회기) — 같은 이유로 요청 문맥이라 컬럼이 아니라 payload로 흐른다
    _session_take: int | None = None

    @classmethod
    def started(
        cls,
        *,
        analysis: CounselingCaseAnalysis,
        member_id: uuid_str | None,
        session_take: int | None = None,
    ) -> tuple["CaseAnalysisAtomic", CounselingCaseAnalysis]:
        return (
            cls(
                _act="created",
                analysis=analysis,
                _member_id=member_id,
                _session_take=session_take,
            ),
            analysis,
        )

    @classmethod
    def completed(
        cls, *, analysis: CounselingCaseAnalysis
    ) -> tuple["CaseAnalysisAtomic", CounselingCaseAnalysis]:
        return cls(_act="completed", analysis=analysis), analysis

    @classmethod
    def failed(
        cls, *, analysis: CounselingCaseAnalysis
    ) -> tuple["CaseAnalysisAtomic", CounselingCaseAnalysis]:
        return cls(_act="failed", analysis=analysis), analysis

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "case_analysis"

    def act_entity_id(self) -> uuid_str:
        return self.analysis.id

    def payload(self) -> dict:
        return {
            "data": {
                "id": self.analysis.id,
                "counseling_case_id": self.analysis.counseling_case_id,
                "status": self.analysis.status,
                "member_id": self._member_id,
                "session_take": self._session_take,
            }
        }
