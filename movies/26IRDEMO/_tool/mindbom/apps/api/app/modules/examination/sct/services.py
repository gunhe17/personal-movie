"""SCT Services — 단일 책임 비즈니스 로직"""
from app.core.datetime_utils import to_utc_naive, utc_now
from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.infrastructure.ai.base import AIService
from app.modules.examination.common.models import Examination
from app.modules.examination.common.repository import ExaminationRepository
from app.modules.examination.common.state_machine import validate_transition
from app.modules.examination.sct.schemas import (
    SCTDomainScore,
    SCTResponseItem,
    SCTResultsData,
    SCTScoreItem,
)
from app.modules.examination.sct.stems import (
    COMPOUND_STEM_IDS,
    DOMAIN_LABELS,
    STEMS,
    STEMS_BY_ID,
)


def _verify_sct_examination(exam: Examination | None, institution_id: str) -> Examination:
    """SCT 검사 진본성 + 기관 일치 검증"""
    if not exam:
        raise EntityNotFoundException("검사를 찾을 수 없습니다.")
    if exam.institution_id != institution_id:
        raise PermissionDeniedException("해당 기관의 검사가 아닙니다.")
    if exam.exam_type != "sct":
        raise InvalidOperationException(f"SCT 검사가 아닙니다 (현재: {exam.exam_type}).")
    return exam


class SaveSCTResponsesService:
    """검사 진행 중 응답 저장 (자동 저장 + 최종 제출)"""

    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self,
        exam_id: str,
        institution_id: str,
        responses: list[SCTResponseItem],
    ) -> Examination:
        exam = _verify_sct_examination(await self.repo.get(exam_id), institution_id)

        # 첫 응답 진입 시 in_progress로 전이
        if exam.status == "created":
            validate_transition(exam.status, "in_progress")
            exam.status = "in_progress"
            exam.started_at = utc_now()

        existing = exam.result_data or {}
        existing["responses"] = [
            {
                "stemId": r.stemId,
                "answer": r.answer,
                "reason": r.reason,
                "answeredAt": (to_utc_naive(r.answeredAt) or utc_now()).isoformat(),
            }
            for r in responses
        ]
        existing["totalCount"] = len(STEMS)
        existing["completedCount"] = sum(1 for r in responses if r.answer.strip())
        exam.result_data = existing

        await self.repo.flush()
        await self.repo.refresh(exam)
        return exam


class ScoreSCTService:
    """AI 채점 트리거.

    AI 인프라(AIService.score_sct)에 위임 — Mock/Remote는 인프라 layer 결정.
    SaMD 원칙: AI는 초안만 생성, 임상가가 검토/수정/확인.
    """

    def __init__(self, repo: ExaminationRepository, ai_service: AIService):
        self.repo = repo
        self.ai_service = ai_service

    async def execute(self, exam_id: str, institution_id: str) -> Examination:
        exam = _verify_sct_examination(await self.repo.get(exam_id), institution_id)

        data = exam.result_data or {}
        responses_raw = data.get("responses", [])
        if not responses_raw:
            raise InvalidOperationException("응답이 없어 채점할 수 없습니다.")

        # AI 서버가 받는 페이로드 형태로 items 구성 (camelCase)
        responses_by_stem = {r["stemId"]: r for r in responses_raw}
        ai_items: list[dict] = []
        for stem in STEMS:
            resp = responses_by_stem.get(stem["id"])
            ai_items.append({
                "stemId": stem["id"],
                "stem": stem["stem"],
                "domain": stem["domain"],
                "domainLabel": DOMAIN_LABELS.get(stem["domain"], stem["domain"]),
                "isCompound": stem["id"] in COMPOUND_STEM_IDS,
                "answer": (resp or {}).get("answer", ""),
                "reason": (resp or {}).get("reason"),
            })

        ai_result = await self.ai_service.score_sct(ai_items, session_id=exam_id)

        # AI 응답이 이미 영역별 집계(0~6점) — 그대로 SCTDomainScore로 변환
        scores: list[SCTDomainScore] = []
        for d in ai_result.scores:
            items: list[SCTScoreItem] = []
            for it in d.items:
                # 응답이 비어있으면 0으로 강제 (AI가 잘못 채점해도 방어)
                resp = responses_by_stem.get(it.stemId)
                score = it.score
                if not resp or not resp.get("answer", "").strip():
                    score = 0
                items.append(SCTScoreItem(
                    stemId=it.stemId,
                    stem=it.stem,
                    score=score,
                    answer=it.answer if it.answer is not None else (resp or {}).get("answer"),
                    reason=it.reason if it.reason is not None else (resp or {}).get("reason"),
                ))
            scores.append(SCTDomainScore(
                domain=d.domain,
                domainLabel=d.domainLabel,
                totalScore=sum(i.score for i in items),  # 방어 적용 후 재계산
                maxScore=d.maxScore if d.maxScore else len(items) * 6,
                items=items,
            ))

        data["scores"] = [s.model_dump() for s in scores]
        if ai_result.overallSummary:
            data["overallSummary"] = ai_result.overallSummary
        exam.result_data = data
        # 재채점이면 이미 ai_draft_ready 이후일 수 있다 — 그 경우 상태는 그대로 둔다.
        # (검토중인 초안을 다시 만들 때는 재분석 전이를 명시적으로 거쳐야 한다)
        if exam.status != "ai_draft_ready":
            validate_transition(exam.status, "ai_draft_ready")
            exam.status = "ai_draft_ready"
        # SaMD 추적: AI 구현체 + 모델 버전 기록
        exam.ai_model_version = ai_result.modelVersion or type(self.ai_service).__name__

        await self.repo.flush()
        await self.repo.refresh(exam)
        return exam


class UpdateSCTScoreService:
    """임상가가 단일 문항 점수 수정"""

    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self,
        exam_id: str,
        institution_id: str,
        stem_id: int,
        new_score: int,
    ) -> Examination:
        exam = _verify_sct_examination(await self.repo.get(exam_id), institution_id)
        if stem_id not in STEMS_BY_ID:
            raise InvalidOperationException(f"존재하지 않는 문항: {stem_id}")

        data = exam.result_data or {}
        scores = data.get("scores")
        if not scores:
            raise InvalidOperationException("아직 채점되지 않은 검사입니다.")

        target_stem = STEMS_BY_ID[stem_id]
        target_domain = target_stem["domain"]

        for domain_score in scores:
            if domain_score["domain"] != target_domain:
                continue
            for item in domain_score["items"]:
                if item["stemId"] == stem_id:
                    item["score"] = new_score
                    break
            domain_score["totalScore"] = sum(it["score"] for it in domain_score["items"])
            break

        # 임상가 수정 시 under_review 상태로
        if exam.status == "ai_draft_ready":
            validate_transition(exam.status, "under_review")
            exam.status = "under_review"

        data["scores"] = scores
        exam.result_data = data

        await self.repo.flush()
        await self.repo.refresh(exam)
        return exam


class ConfirmSCTService:
    """임상가 최종 확인 (CDSS 원칙: AI 초안 → 임상가 확인)"""

    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(self, exam_id: str, institution_id: str) -> Examination:
        exam = _verify_sct_examination(await self.repo.get(exam_id), institution_id)

        if exam.status not in ("ai_draft_ready", "under_review"):
            raise InvalidOperationException(
                f"확인 가능한 상태가 아닙니다 (현재: {exam.status})."
            )
        if not (exam.result_data or {}).get("scores"):
            raise InvalidOperationException("채점되지 않은 검사는 확인할 수 없습니다.")

        # ai_draft_ready에서 곧바로 확정하는 경로는 없다 — 검토를 거친다.
        if exam.status == "ai_draft_ready":
            validate_transition(exam.status, "under_review")
            exam.status = "under_review"
        validate_transition(exam.status, "confirmed")
        exam.status = "confirmed"
        exam.completed_at = utc_now()

        await self.repo.flush()
        await self.repo.refresh(exam)
        return exam


class GetSCTResultsService:
    """SCT 결과 조회"""

    def __init__(self, repo: ExaminationRepository):
        self.repo = repo

    async def execute(
        self, exam_id: str, institution_id: str
    ) -> tuple[Examination, SCTResultsData | None]:
        exam = _verify_sct_examination(await self.repo.get(exam_id), institution_id)

        if not exam.result_data:
            return exam, None

        data = exam.result_data
        return exam, SCTResultsData(
            responses=[SCTResponseItem(**r) for r in data.get("responses", [])],
            scores=[SCTDomainScore(**s) for s in data.get("scores", [])],
            completedCount=data.get("completedCount", 0),
            totalCount=data.get("totalCount", len(STEMS)),
        )
