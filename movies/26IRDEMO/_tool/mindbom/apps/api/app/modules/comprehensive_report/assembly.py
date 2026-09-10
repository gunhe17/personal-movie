"""검사 결과 교차 취합 — HTP/Rorschach/SCT를 하나의 정규화 입력으로 결합

이 서비스만 htp/sct/rorschach 모듈 경계를 넘는다. 정규화 전용이며
per-exam 상태를 절대 mutate하지 않는다. 누락/부분 결과를 허용한다.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime

from app.core.unit_of_work import UnitOfWork
from app.modules.comprehensive_report.constants import EXAM_TYPE_LABELS
from app.modules.examination.common.models import Examination
from app.modules.examination.common.repository import ExaminationRepository

logger = logging.getLogger(__name__)


@dataclass
class ExamAssembly:
    """검사 1건의 정규화 결과"""
    exam_id: str
    exam_type: str
    label: str
    exam_date: datetime | None = None
    summary_text: str = ""       # test_results 블록용 사람이 읽는 텍스트
    signals: dict = field(default_factory=dict)  # 규칙 기반 AI용 정규화 데이터
    is_deleted: bool = False


class CombinedAssemblyService:
    """링크된 검사들을 순서대로 정규화."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    @property
    def _exam_repo(self) -> ExaminationRepository:
        return self._uow.repo(ExaminationRepository)

    async def execute(self, exam_ids: list[str]) -> list[ExamAssembly]:
        results: list[ExamAssembly] = []
        for exam_id in exam_ids:
            exam = await self._exam_repo.get(exam_id, include_deleted=True)
            if exam is None:
                results.append(
                    ExamAssembly(
                        exam_id=exam_id, exam_type="unknown", label="알 수 없음",
                        summary_text="원본 검사를 찾을 수 없습니다.", is_deleted=True,
                    )
                )
                continue

            label = EXAM_TYPE_LABELS.get(exam.exam_type, exam.exam_type)
            is_deleted = exam.deleted_at is not None
            try:
                if exam.exam_type == "htp":
                    summary_text, signals = await self._assemble_htp(exam)
                elif exam.exam_type == "sct":
                    summary_text, signals = self._assemble_sct(exam)
                elif exam.exam_type == "rorschach":
                    summary_text, signals = await self._assemble_rorschach(exam)
                else:
                    summary_text, signals = "결과 없음", {}
            except Exception:  # 부분 결과/누락 방어 — 취합 실패가 보고서 생성을 막지 않음
                logger.warning("검사 취합 실패 (exam=%s type=%s)", exam_id, exam.exam_type, exc_info=True)
                summary_text, signals = "결과를 불러오지 못했습니다.", {}

            if is_deleted:
                summary_text = "(원본 검사 삭제됨) " + summary_text

            results.append(
                ExamAssembly(
                    exam_id=exam_id,
                    exam_type=exam.exam_type,
                    label=label,
                    exam_date=exam.started_at or exam.created_at,
                    summary_text=summary_text,
                    signals=signals,
                    is_deleted=is_deleted,
                )
            )
        return results

    # ── HTP ──
    async def _assemble_htp(self, exam: Examination) -> tuple[str, dict]:
        from app.modules.examination.htp.repository import HTPInterpretationRepository

        interp_repo = self._uow.repo(HTPInterpretationRepository)
        interps = await interp_repo.list_by_examination(exam.id)
        important = [i for i in interps if i.is_important]

        by_category: dict[str, list[str]] = {}
        for i in important:
            by_category.setdefault(i.main_category, []).append(i.sentence)

        if not interps:
            return "HTP 해석 결과 없음", {"important_count": 0, "by_category": {}}

        lines: list[str] = []
        for cat, sentences in by_category.items():
            lines.append(f"[{cat}]")
            for s in sentences:
                lines.append(f"  · {s}")
        summary_text = (
            f"총 {len(interps)}개 해석 중 중요 소견 {len(important)}건.\n"
            + ("\n".join(lines) if lines else "표시된 중요 소견 없음.")
        )
        signals = {
            "important_count": len(important),
            "by_category": {k: len(v) for k, v in by_category.items()},
        }
        return summary_text, signals

    # ── SCT ──
    def _assemble_sct(self, exam: Examination) -> tuple[str, dict]:
        from app.modules.examination.sct.schemas import SCTResultsData

        raw = exam.result_data
        if not raw:
            return "SCT 채점 결과 없음", {"domains": []}

        try:
            data = SCTResultsData.model_validate(raw)
        except Exception:
            return "SCT 결과 형식 오류", {"domains": []}

        domain_lines: list[str] = []
        domains: list[dict] = []
        for d in data.scores:
            ratio = (d.totalScore / d.maxScore) if d.maxScore else 0.0
            domain_lines.append(f"  · {d.domainLabel}: {d.totalScore}/{d.maxScore}")
            domains.append({
                "domain": d.domain,
                "label": d.domainLabel,
                "total": d.totalScore,
                "max": d.maxScore,
                "ratio": round(ratio, 3),
            })
        summary_text = (
            f"완료 {data.completedCount}/{data.totalCount} 문항. 영역별 점수:\n"
            + ("\n".join(domain_lines) if domain_lines else "채점 영역 없음.")
        )
        return summary_text, {"domains": domains}

    # ── Rorschach ──
    async def _assemble_rorschach(self, exam: Examination) -> tuple[str, dict]:
        from app.modules.examination.rorschach.repository import (
            RorschachRegionRepository,
            RorschachResponseRepository,
            RorschachSessionRepository,
        )

        session_repo = self._uow.repo(RorschachSessionRepository)
        region_repo = self._uow.repo(RorschachRegionRepository)
        response_repo = self._uow.repo(RorschachResponseRepository)

        session = await session_repo.get_by_examination_id(exam.id)
        if session is None:
            return "로르샤하 세션 없음", {"response_count": 0, "coded_count": 0}

        # R은 **정식 반응 수**다(§7). region을 순회하면 조각 N개인 반응이
        # N번 세어져 R이 부풀고, 영역 0개인 반응은 아예 빠진다.
        # 이 값은 remote.py를 타고 AI 소견 입력으로 들어간다 — 틀리면 해석이 틀린다.
        responses = await response_repo.list_formal_by_session(session.id)
        regions = await region_repo.list_by_session(session.id)

        response_count = len(responses)
        coded_count = sum(
            1 for r in responses if getattr(r, "final_coding_json", None)
        )

        summary_text = (
            f"총 반응(R) {response_count}개, 채점 확정 {coded_count}개.\n"
            f"카드 영역 {len(regions)}개 지정됨."
        )
        signals = {"response_count": response_count, "coded_count": coded_count}
        return summary_text, signals
