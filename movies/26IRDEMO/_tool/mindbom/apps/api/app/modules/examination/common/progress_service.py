"""검사 진행(progress) 조회 — 서브모듈 데이터를 읽어 progress를 만든다.

검사 종류마다 다른 테이블을 보므로 exam_type으로 분기한다. 이는 report/facade.py
가 이미 쓰는 패턴과 같다(여러 검사를 가로지를 때 서브모듈을 조회해 모은다).

쿼리 비용은 검사당 최대 2개다:
  - HTP:       그림 목록(4행, 인덱스) + 해석 존재 여부(EXISTS)
  - 로르샤하:  세션(unique 인덱스 1행) + 채점 존재 여부(EXISTS)
  - SCT:       0개 — result_data가 examinations 같은 행에 있다

목록 응답에는 넣지 않는다. 건마다 이 조회가 붙으면 N+1이 된다.
"""
import logging

from app.modules.examination.common import progress as rules
from app.modules.examination.common.models import Examination
from app.modules.examination.common.schemas import ExamProgress
from app.modules.examination.htp.repository import (
    HTPDrawingRepository,
    HTPInterpretationRepository,
)
from app.modules.examination.rorschach.repository import (
    RorschachCardAdministrationRepository,
    RorschachRegionRepository,
    RorschachResponseRepository,
    RorschachSessionRepository,
)

logger = logging.getLogger(__name__)


class GetExamProgressService:
    """검사 하나의 진행 상황을 계산한다."""

    def __init__(self, uow):
        self._uow = uow

    async def execute(self, exam: Examination) -> ExamProgress:
        try:
            if exam.exam_type == "htp":
                return await self._htp(exam.id)
            if exam.exam_type == "rorschach":
                return await self._rorschach(exam.id)
            if exam.exam_type == "sct":
                return rules.sct_progress(exam.result_data)
        except Exception:
            # 진행 표시는 보조 정보다. 서브모듈 조회가 실패해도 상세 조회
            # 자체를 막지 않는다(빈 progress로 내려가면 프론트는 수집 단계로 본다).
            logger.warning(
                "진행 상황 계산 실패 — exam_id=%s type=%s", exam.id, exam.exam_type,
                exc_info=True,
            )
        return rules.empty_progress()

    async def _htp(self, exam_id: str) -> ExamProgress:
        drawings = await self._uow.repo(HTPDrawingRepository).list_by_examination(exam_id)
        has_interp = await self._uow.repo(
            HTPInterpretationRepository
        ).exists_by_examination(exam_id)
        return rules.htp_progress(drawings, has_interpretations=has_interp)

    async def _rorschach(self, exam_id: str) -> ExamProgress:
        session = await self._uow.repo(
            RorschachSessionRepository
        ).get_by_examination_id(exam_id)
        if session is None:
            return rules.rorschach_progress(None, has_scored_response=False)

        scored = await self._uow.repo(
            RorschachResponseRepository
        ).exists_scored_in_session(session.id)

        # 실시 완료는 카드와 반응을 봐야 알 수 있다(§14-11) — `ended_at`은
        # 완료 버튼을 눌렀다는 뜻일 뿐이다. 조각 수까지 필요해서 세 번 읽는다.
        responses = await self._uow.repo(
            RorschachResponseRepository
        ).list_by_session(session.id)
        cards = await self._uow.repo(
            RorschachCardAdministrationRepository
        ).list_by_session(session.id)
        regions = await self._uow.repo(
            RorschachRegionRepository
        ).list_by_session(session.id)

        counts: dict[str, int] = {}
        for g in regions:
            if g.response_id:
                counts[g.response_id] = counts.get(g.response_id, 0) + 1
        for r in responses:
            r.region_ids = [""] * counts.get(r.id, 0)

        return rules.rorschach_progress(
            session,
            has_scored_response=scored,
            cards=cards,
            responses=responses,
        )
