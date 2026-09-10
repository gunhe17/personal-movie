"""Remote AI Service — AI 서버 연동

1) POST {AI_SERVICE_URL}/detect       — 객체 탐지 (multipart/form-data)
2) POST {INTERPRETATION_URL}/htp/result — 해석 (JSON)
"""
import asyncio
import json
import logging
import re
import struct
import zlib

import httpx

from app.core.exceptions import ExternalServiceException
from app.modules.examination.rorschach.completion import card_label
from app.infrastructure.ai.base import (
    AIService,
    HTPAnalysisObject,
    HTPAnalysisResult,
    HTPBatchDetectionResult,
    HTPInterpretationResult,
    ReportPerExamSummary,
    ReportSummaryResult,
    RorschachScoringResult,
    SCTScoringResult,
)

logger = logging.getLogger(__name__)

# 우리 시스템 category → AI 서버 필드명
_CATEGORY_TO_FIELD = {"house": "house", "tree": "tree", "man": "boy", "woman": "girl"}
# AI 서버 한글 카테고리 → 우리 시스템 category
_KOREAN_TO_ENG = {"집": "house", "나무": "tree", "남자사람": "man", "여자사람": "woman"}

ALL_CATEGORIES = {"house", "tree", "man", "woman"}


def _make_blank_png(width: int = 800, height: int = 800) -> bytes:
    """800x800 white PNG — 미업로드 카테고리용 placeholder"""

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        c = chunk_type + data
        crc = struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack(">I", len(data)) + c + crc

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_row = b"\x00" + b"\xff\xff\xff" * width
    idat = zlib.compress(raw_row * height)

    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", idat)
        + _chunk(b"IEND", b"")
    )


BLANK_PLACEHOLDER_PNG = _make_blank_png()


# === 룰베이스 채점 헬퍼 (AI 서버 미연동 시 폴백) ===

_SCT_NEGATIVE_KEYWORDS = (
    "싫", "싫어", "미워", "짜증", "우울", "외로", "힘들", "괴롭",
    "나쁘", "죽", "화나", "절망", "무서", "두렵", "불안", "걱정",
)
_SCT_POSITIVE_KEYWORDS = (
    "좋", "행복", "사랑", "감사", "기쁘", "즐거", "편안", "뿌듯",
    "자랑", "자신", "희망", "꿈", "성공",
)


def _rule_score_sct_item(answer: str, reason: str | None) -> int:
    """SCT 단일 문항 룰베이스 점수 (0~6): 키워드 기반.

    0=긍정/안정, 3=중립, 6=강한 갈등/부정.
    """
    text = ((answer or "") + " " + (reason or "")).strip()
    if not text:
        return 0
    neg = sum(1 for kw in _SCT_NEGATIVE_KEYWORDS if kw in text)
    pos = sum(1 for kw in _SCT_POSITIVE_KEYWORDS if kw in text)
    if neg > pos and neg > 0:
        return 6
    if neg > 0 and pos == 0:
        return 3
    if pos > 0:
        return 0
    return 3  # 중립


def _rule_score_sct_aggregated(items: list[dict], *, session_id: str | None) -> 'SCTScoringResult':
    """SCT 룰베이스 채점 — AI 서버 응답과 동일한 영역별 집계 구조로 반환."""
    from datetime import datetime, timezone
    from app.infrastructure.ai.base import SCTDomainScored, SCTScoredItem, SCTScoringResult

    by_domain: dict[str, list[dict]] = {}
    domain_label: dict[str, str] = {}
    for it in items:
        d = it.get("domain", "")
        by_domain.setdefault(d, []).append(it)
        if "domainLabel" in it:
            domain_label[d] = it["domainLabel"]

    domain_scored: list[SCTDomainScored] = []
    for d, ditems in by_domain.items():
        scored_items: list[SCTScoredItem] = []
        for it in ditems:
            score = _rule_score_sct_item(it.get("answer", ""), it.get("reason"))
            scored_items.append(SCTScoredItem(
                stemId=it["stemId"],
                stem=it.get("stem", ""),
                score=score,
                answer=it.get("answer"),
                reason=it.get("reason"),
                rationale="rule-based 임시 채점",
            ))
        total = sum(i.score for i in scored_items)
        domain_scored.append(SCTDomainScored(
            domain=d,
            domainLabel=domain_label.get(d, d),
            totalScore=total,
            maxScore=len(scored_items) * 6,
            items=scored_items,
        ))

    return SCTScoringResult(
        sessionId=session_id,
        scoredAt=datetime.now(timezone.utc).isoformat(),
        modelVersion="rule-based-fallback",
        scores=domain_scored,
        overallSummary="(룰베이스 채점) AI 서버 미연동 상태로 임시 채점된 결과입니다.",
    )


def _parse_rorschach_result(
    result: dict,
    card_no: int,
    response_no: int,
    area_code: str,
) -> 'RorschachScoringResult':
    """AI 서버 /jobs/score 응답 (camelCase) → RorschachScoringResult (snake_case).

    응답 구조:
        result.responses[0].coding = { location, dq, determinants, fq, pair,
                                       contents, popular, zScore, specialScores }
        result.responses[0].cleanedText / responsePhase / scoringTrace ... (참고용)
    단일 batch 라 responses[0] 만 사용.
    """
    responses = result.get("responses") or []
    if not responses:
        # 빈 결과는 **채점이 아니다**. 예전에는 여기서 룰베이스 목업을 지어
        # 돌려줬는데, 그러면 AI가 아무것도 못 낸 반응이 그럴듯한 부호를 달고
        # 임상가의 검토 대상이 됐다. 못 했으면 못 했다고 한다.
        raise ExternalServiceException(
            f"AI 채점 서버가 카드 {card_no} 반응 {response_no}에 대한 결과를 "
            "반환하지 않았습니다. 잠시 후 다시 시도해 주세요."
        )

    r0 = responses[0]
    coding = r0.get("coding") or {}
    z_score_str = coding.get("zScore")  # "ZW"|"ZA"|"ZD"|"ZS"|None — 우리 모델은 float|None
    # ZW/ZA/ZD/ZS 라벨은 우리 모델의 단순 float 와 의미가 다름 — 라벨 기반이라 None 으로 두고 reasoning 에 박음
    cleaned = r0.get("cleanedText") or ""
    response_phase = r0.get("responsePhase") or ""
    reasoning_parts: list[str] = []
    if response_phase:
        reasoning_parts.append(f"발화: {response_phase[:80]}")
    if cleaned:
        reasoning_parts.append(f"핵심: {cleaned[:80]}")
    if z_score_str:
        reasoning_parts.append(f"Z={z_score_str}")
    reasoning = " | ".join(reasoning_parts) or "AI 채점 완료"

    return RorschachScoringResult(
        location=coding.get("location"),  # coarse 6값 그대로
        dev_quality=coding.get("dq"),
        determinants=list(coding.get("determinants") or []),
        form_quality=coding.get("fq"),
        content=list(coding.get("contents") or []),
        popular=bool(coding.get("popular", False)),
        pair=bool(coding.get("pair", False)),
        z_score=None,  # AI 는 라벨 (ZW/ZA/...), 우리 모델은 float — 호환 위해 None
        special_scores=list(coding.get("specialScores") or []),
        confidence=0.85,  # AI 서버는 confidence 미반환 → 고정값
        reasoning=reasoning,
    )


_EXAM_TYPE_LABELS = {
    "htp": "HTP(집-나무-사람)",
    "rorschach": "로르샤하",
    "sct": "문장완성검사(SCT)",
}


def _rule_summarize_report(
    client: dict | None, exams: list[dict]
) -> ReportSummaryResult:
    """룰베이스 통합 요약 — AI 서버 미연동 시 폴백.

    입력 소견(findings)을 그대로 조합해 결정론적으로 검사별/종합 해석을 만든다.
    LLM이 아니므로 문장 생성은 하지 않고, 수집된 소견을 임상가 검토용으로 정리만 한다.
    """
    per_exam: list[ReportPerExamSummary] = []
    all_findings: list[str] = []

    for e in exams:
        etype = e.get("exam_type", "")
        label = _EXAM_TYPE_LABELS.get(etype, etype)
        findings = [f for f in (e.get("findings") or []) if f]
        if findings:
            # 룰 폴백: 검사당 소견들을 한 줄로 합침(LLM 아님 → 요약 대신 나열)
            clinical = f"[{label}] " + " / ".join(findings)
            plain = f"{label} 검사에서 살펴볼 점이 있었어요: " + ", ".join(findings) \
                + " — 자세한 의미는 선생님과 함께 확인해요."
        else:
            clinical = f"[{label}] 유의미한 특이 소견이 확인되지 않음."
            plain = f"{label} 검사에서는 특별히 두드러진 점은 없었어요."
        per_exam.append(
            ReportPerExamSummary(
                exam_id=e.get("exam_id", ""), exam_type=etype,
                clinical=clinical, plain=plain,
            )
        )
        all_findings.extend(findings)

    name = (client or {}).get("name") or "내담자"
    types = ", ".join(
        _EXAM_TYPE_LABELS.get(e.get("exam_type", ""), e.get("exam_type", ""))
        for e in exams
    )
    if all_findings:
        comprehensive = (
            f"{name} — {types} 종합: " + "; ".join(all_findings[:4])
            + " (AI 초안, 임상가 검토 필요)"
        )
        plain_summary = (
            f"{name}님, 검사에서 몇 가지 살펴볼 점이 나타났어요. "
            "정답은 아니니 담당 선생님과 함께 편하게 이야기 나눠 주세요."
        )
    else:
        comprehensive = f"{name} — {types}에서 유의미한 공통 소견 없음. 임상가 검토 필요."
        plain_summary = f"{name}님, 특별히 두드러진 점은 없었어요. 선생님과 함께 확인해 보세요."

    return ReportSummaryResult(
        per_exam=per_exam,
        comprehensive=comprehensive,
        plain_summary=plain_summary,
        key_findings=all_findings[:5],
        model_version="mock-report-v1",
    )


_REPORT_SYSTEM_PROMPT = (
    "너는 투사적 심리검사(HTP·로르샤하·SCT) 결과를 종합하는 임상심리 보조 AI다. "
    "CDSS 원칙을 지킨다: 확정 진단을 내리지 말고 '시사된다/경향이 보인다' 식 초안을 제공한다. "
    "입력으로 내담자 정보(client)와 검사별 소견(exams[].findings)이 주어진다. "
    "모든 해석은 '임상적 해석 한 줄(clinical)'과 '피검사자가 이해할 쉬운 번역 한 줄(plain)'의 쌍으로 작성하라. "
    "각 값은 반드시 한 문장(한 줄)으로만 작성한다. "
    "clinical: 임상 용어 허용, 한 문장. "
    "plain: 같은 내용을 피검사자 본인이 이해하도록 따뜻한 존댓말 한 문장으로 번역 — "
    "전문 수치(R, X+%, Lambda, es 등)·낙인·단정 표현 금지. "
    "(1) per_exam: 검사별로 소견 전체를 종합한 clinical 한 줄 + plain 한 줄 (검사당 각 1문장). "
    "(2) comprehensive: 전체 검사 종합의 임상적 해석 한 줄. "
    "(3) plain_summary: 전체 종합의 피검사자용 쉬운 번역 한 줄(끝에 '선생님과 함께 이야기 나누라' 안내 포함). "
    "반드시 아래 JSON만 응답한다(마크다운·설명 금지): "
    '{"per_exam":[{"exam_id":str,"exam_type":str,"clinical":str,"plain":str}],'
    '"comprehensive":str,"plain_summary":str,"key_findings":[str]}'
)


def _llm_summarize_report(
    client: dict | None,
    exams: list[dict],
    *,
    api_key: str,
    base_url: str,
    model: str,
    timeout: float,
) -> ReportSummaryResult:
    """OpenAI 호환 LLM(OpenRouter 경유 Gemini Flash 등)으로 통합 요약 (동기 SDK).

    provider 설정 시 실패는 예외로 그대로 올린다(룰 폴백으로 조용히 격하하지 않음 —
    임상가가 AI 결과로 오인하지 않도록).
    """
    from openai import OpenAI

    oai = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)
    user = json.dumps({"client": client, "exams": exams}, ensure_ascii=False)
    logger.info("LLM 통합 요약 호출: model=%s (%d exams)", model, len(exams))
    completion = oai.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _REPORT_SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    raw = completion.choices[0].message.content or "{}"
    match = re.search(r"\{.*\}", raw, re.DOTALL)  # 펜스/여백 방어
    data = json.loads(match.group(0) if match else raw)
    return ReportSummaryResult(**data, model_version=model)


def _rule_compose_comprehensive_draft(payload: dict) -> 'ComprehensiveDraftResult':
    """종합보고서 룰베이스 초안 — 검사 signals를 문장으로 조합.

    AI 서버 미연동 시 결정론적 mock. 종합 소견(comprehensive_opinion)과
    제언(recommendations) 두 섹션만 생성한다. CDSS: 임상가 검토용 초안.
    """
    from app.infrastructure.ai.base import (
        ComprehensiveDraftResult,
        ComprehensiveDraftSection,
    )

    client = payload.get("client", {}) or {}
    exams = payload.get("exams", []) or []
    name = client.get("name") or "내담자"

    findings: list[str] = []       # 종합 소견 문장
    concern_domains: list[str] = []  # 제언 근거

    _TYPE_LABEL = {"htp": "HTP", "sct": "SCT", "rorschach": "로르샤하"}
    for ex in exams:
        etype = ex.get("exam_type", "")
        sig = ex.get("signals", {}) or {}
        label = _TYPE_LABEL.get(etype, etype)

        if etype == "htp":
            by_cat = sig.get("by_category", {}) or {}
            important = sig.get("important_count", 0)
            if important:
                cats = ", ".join(f"{k}({v}건)" for k, v in by_cat.items())
                findings.append(
                    f"{label} 검사에서 중요 소견 {important}건이 관찰됨"
                    + (f" — 주요 영역: {cats}." if cats else ".")
                )
                concern_domains.extend(by_cat.keys())
            else:
                findings.append(f"{label} 검사에서 특기할 중요 소견은 관찰되지 않음.")

        elif etype == "sct":
            domains = sig.get("domains", []) or []
            high = [d for d in domains if d.get("ratio", 0) >= 0.5]
            if high:
                names = ", ".join(d.get("label", d.get("domain", "")) for d in high)
                findings.append(
                    f"{label} 검사상 {names} 영역에서 상대적으로 높은 갈등 수준이 시사됨."
                )
                concern_domains.extend(d.get("label", d.get("domain", "")) for d in high)
            elif domains:
                findings.append(f"{label} 검사상 영역별 갈등 수준은 대체로 안정적 범위로 나타남.")

        elif etype == "rorschach":
            rc = sig.get("response_count", 0)
            findings.append(
                f"{label} 검사에서 총 {rc}개의 반응이 산출됨 (구조적 해석은 임상가 검토 필요)."
            )

    if not findings:
        findings.append("실시된 검사들에서 통합적으로 검토할 주요 소견을 확인해주세요.")

    opinion_body = (
        f"{name}의 투사적 심리검사 결과를 종합하면 다음과 같다.\n\n"
        + "\n".join(f"· {s}" for s in findings)
        + "\n\n※ 본 소견은 AI가 생성한 초안이며, 최종 해석은 임상가의 검토·확정이 필요합니다."
    )

    if concern_domains:
        uniq = list(dict.fromkeys(concern_domains))
        rec_body = (
            "· 다음 영역에 대한 추가적 탐색 및 개입을 고려할 수 있음: "
            + ", ".join(uniq) + ".\n"
            "· 검사 결과는 현재 상태의 단면이므로, 면담 및 발달력과 통합하여 해석할 것을 권함."
        )
    else:
        rec_body = (
            "· 현재 검사 결과상 즉각적 개입이 요구되는 영역은 두드러지지 않으나, "
            "정기적 관찰을 권함.\n"
            "· 검사 결과는 면담 및 발달력과 통합하여 해석할 것을 권함."
        )

    return ComprehensiveDraftResult(
        sections=[
            ComprehensiveDraftSection(
                key="comprehensive_opinion", title="종합 소견", body=opinion_body
            ),
            ComprehensiveDraftSection(
                key="recommendations", title="제언", body=rec_body
            ),
        ],
        model_version="rule-based-fallback",
    )


class RemoteAIService(AIService):
    """AI 서버 연동 구현체

    SCT/Rorschach 채점 엔드포인트가 비어있으면 룰베이스 임시 채점으로 폴백.
    AI팀이 엔드포인트 제공 시 config에서 URL만 채우면 자동 전환.
    """

    def __init__(
        self,
        base_url: str,
        interpretation_url: str = "",
        sct_score_url: str = "",
        rorschach_score_url: str = "",
        report_summarize_url: str = "",
        report_api_key: str = "",
        report_base_url: str = "",
        report_model: str = "",
        comprehensive_url: str = "",
        timeout: float = 120.0,
    ):
        self._base_url = base_url.rstrip("/")
        self._interpretation_url = interpretation_url.rstrip("/") if interpretation_url else "http://interpretation.api.imomtae.com"
        self._sct_score_url = sct_score_url.rstrip("/") if sct_score_url else ""
        self._rorschach_score_url = rorschach_score_url.rstrip("/") if rorschach_score_url else ""
        self._report_summarize_url = report_summarize_url.rstrip("/") if report_summarize_url else ""
        self._report_api_key = report_api_key
        self._report_base_url = report_base_url.rstrip("/") if report_base_url else ""
        self._report_model = report_model
        self._comprehensive_url = comprehensive_url.rstrip("/") if comprehensive_url else ""
        self._timeout = timeout

    async def detect_htp_batch(
        self,
        images: dict[str, bytes],
        meta: dict | None = None,
    ) -> HTPBatchDetectionResult:
        """이미지 + 메타데이터를 AI 서버에 전송

        미업로드 카테고리는 빈 800x800 PNG placeholder로 채워서 전송.
        AI 서버는 placeholder에 대해 빈 탐지 결과를 반환한다.

        Args:
            images: {"house": bytes, ...} — 최소 1장 이상
            meta: {"gender": "남자"|"여자", "age": int}
        """
        if not images:
            from app.core.exceptions import InvalidOperationException
            raise InvalidOperationException("분석할 이미지가 없습니다.")

        # 미업로드 카테고리는 blank placeholder로 채움
        filled_images = {}
        for cat in ALL_CATEGORIES:
            filled_images[cat] = images.get(cat, BLANK_PLACEHOLDER_PNG)

        meta = meta or {}

        files = {
            field: (f"{field}.png", filled_images[cat], "image/png")
            for cat, field in _CATEGORY_TO_FIELD.items()
        }

        data = {
            "gender": meta.get("gender", "남자"),
            "age": str(meta.get("age", 0)),
        }

        real_count = len(images)
        logger.info(
            "AI 서버 호출: POST %s/detect (%d real + %d placeholder, gender=%s, age=%s)",
            self._base_url, real_count, 4 - real_count, data["gender"], data["age"],
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/detect",
                files=files,
                data=data,
            )
            response.raise_for_status()
            result_json = response.json()

        detected_count = sum(
            len([d for d in cat.get("detections", []) if d.get("points")])
            for cat in result_json.get("data", [])
        )
        logger.info("AI 서버 응답: %d categories, %d detected objects",
                     len(result_json.get("data", [])), detected_count)

        return HTPBatchDetectionResult(**result_json)

    async def interpret_htp(
        self,
        detection_result: HTPBatchDetectionResult,
        child: dict | None = None,
    ) -> HTPInterpretationResult:
        """탐지 결과를 해석 API에 전송하여 해석 결과 획득

        Args:
            detection_result: detect_htp_batch의 결과
            child: {"name": str, "birth": str, "gender": str}
        """
        child = child or {"name": "", "birth": "20100101", "gender": "남자"}

        # 탐지 결과를 해석 API 포맷으로 변환
        results = []
        for cat_data in detection_result.data:
            results.append({
                "category": cat_data.category,
                "img_name": cat_data.img_name,
                "original_img_url": cat_data.original_img_url or "",
                "img_url": cat_data.img_url or "",
                "img_size": cat_data.img_size,
                "detections": [
                    {
                        "label": det.label,
                        "points": det.points,
                        "confidence": det.confidence,
                    }
                    for det in cat_data.detections
                ],
            })

        payload = {"child": child, "results": results}

        logger.info("해석 API 호출: POST %s/htp/result (%d categories)",
                     self._interpretation_url, len(results))

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._interpretation_url}/htp/result",
                json=payload,
            )
            response.raise_for_status()
            result_json = response.json()

        items = result_json.get("data", [])
        logger.info("해석 API 응답: %d interpretation items", len(items))

        return HTPInterpretationResult(**result_json)

    # === SCT 채점 ===

    async def score_sct(
        self,
        items: list[dict],
        *,
        session_id: str | None = None,
    ) -> SCTScoringResult:
        """SCT 채점.

        URL이 설정돼 있으면 AI 서버 POST {sct_score_url}로 위임.

        요청 스키마:
            {
              "sessionId": str,
              "responses": [
                {"stemId":int,"stem":str,"domain":str,"domainLabel":str,
                 "isCompound":bool,"answer":str,"reason":str|null}
              ]
            }
        응답 스키마:
            {
              "sessionId": str, "scoredAt": str, "modelVersion": str,
              "scores": [
                {"domain":str,"domainLabel":str,"totalScore":int,"maxScore":int,
                 "items": [{"stemId":int,"stem":str,"score":int(0~6),"answer":str,
                            "reason":str|null,"rationale":str|null,
                            "subFocus":str|null,"subFocusLabel":str|null}]
                }
              ],
              "overallSummary": str
            }

        URL 미설정 시 키워드 기반 룰 채점으로 폴백.
        """
        if self._sct_score_url:
            payload = {"sessionId": session_id or "", "responses": items}
            logger.info(
                "AI 서버 호출: POST %s (sessionId=%s, %d items)",
                self._sct_score_url, session_id, len(items),
            )
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(self._sct_score_url, json=payload)
                r.raise_for_status()
                return SCTScoringResult(**r.json())

        logger.info("SCT 룰베이스 채점 (sessionId=%s, %d items)", session_id, len(items))
        return _rule_score_sct_aggregated(items, session_id=session_id)

    # === 종합보고서 초안 ===

    async def generate_comprehensive_draft(self, payload):
        """종합보고서 AI 초안 생성.

        URL 설정 시 AI 서버 POST {comprehensive_url}로 위임, 미설정 시 룰베이스 폴백.
        """
        from app.infrastructure.ai.base import ComprehensiveDraftResult

        data = payload.model_dump() if hasattr(payload, "model_dump") else dict(payload)

        if self._comprehensive_url:
            logger.info("AI 서버 호출: POST %s (종합보고서 초안, %d개 검사)",
                        self._comprehensive_url, len(data.get("exams", [])))
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.post(self._comprehensive_url, json=data)
                r.raise_for_status()
                return ComprehensiveDraftResult(**r.json())

        logger.info("종합보고서 룰베이스 초안 생성 (%d개 검사)", len(data.get("exams", [])))
        return _rule_compose_comprehensive_draft(data)

    # === Rorschach 채점 ===

    async def score_rorschach(
        self,
        *,
        card_no: int,
        response_no: int,
        transcript: str,
        location_marking: dict | None = None,
        inquiry_transcript: str | None = None,
    ) -> RorschachScoringResult:
        """Rorschach 단일 응답 Exner CS 채점.

        AXSprint Rorschach Inference 비동기 큐 (POST /jobs/score → poll /jobs/{id}).
        - 단일 region 도 1개짜리 responses 배열로 wrap
        - finished 시 result.responses[0].coding (camelCase) → snake_case 매핑
        - 잡이 'failed' 로 끝나면 1회 재시도 (간헐적 LLM/워커 오류 대응)

        **폴백이 없다.** 예전에는 URL 미설정·호출 실패 어느 쪽이든 룰베이스
        목업(`_rule_score_rorschach`)을 대신 돌려줬다. 목업은 카드·반응 번호로
        부호를 돌려 만든 그럴듯한 코딩에 confidence 0.7~0.9를 달고 나왔고,
        화면은 'AI 채점이 완료되었습니다'라고만 말했다. 임상가가 **AI가 본 적
        없는 부호**를 검토하고 확정할 수 있었다 — CDSS에서 가장 나쁜 실패다.
        실패를 성공으로 바꿔 반환하느니 실패라고 말한다(2026-08-26 제거).
        """
        area_code = (location_marking or {}).get("area_code")
        if not self._rorschach_score_url:
            raise ExternalServiceException(
                "AI 채점 서버가 설정되지 않았습니다(AI_RORSCHACH_SCORE_URL). "
                "관리자에게 문의해 주세요."
            )
        if not area_code:
            # 서비스의 `missing_score_inputs`가 먼저 막는 자리다. 여기까지 왔다면
            # 그 관문을 우회한 호출이므로, 위치 없이 추론하게 두지 않는다(§14-7).
            raise ExternalServiceException(
                f"위치 부호 없이 AI 채점을 요청했습니다(카드 {card_no} 반응 {response_no})."
            )

        last_exc: Exception | None = None
        for attempt in (1, 2):
            try:
                return await self._submit_and_poll_rorschach_score(
                    card_no=card_no,
                    response_no=response_no,
                    transcript=transcript,
                    area_code=area_code,
                )
            except ExternalServiceException:
                raise  # 빈 결과 — 재시도해도 같다
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                logger.warning(
                    "[score_rorschach] AI 서버 호출 실패 (attempt %d/2): %s",
                    attempt, exc,
                )

        logger.error("[score_rorschach] 2회 시도 모두 실패: %s", last_exc)
        raise ExternalServiceException(
            f"AI 채점 서버에 연결하지 못했습니다(카드 {card_no} 반응 {response_no}). "
            "잠시 후 다시 시도해 주세요."
        )

    async def _submit_and_poll_rorschach_score(
        self,
        *,
        card_no: int,
        response_no: int,
        transcript: str,
        area_code: str,
    ) -> RorschachScoringResult:
        """AI 서버에 1개짜리 batch 로 잡 제출 후 finished 까지 폴링."""
        base = self._rorschach_score_url
        # 카드 이름의 정본은 도메인이 갖는다. 예전 `.get(card_no, "I")`는
        # 범위 밖 카드를 **카드 I이라고 AI에 보냈다**(`card_label` 주석).
        roman = card_label(card_no)

        import uuid
        payload = {
            "sessionId": str(uuid.uuid4()),  # AI 서버 추적용 식별자 (필수)
            "responses": [
                {
                    "responseId": 1,
                    "cardNumber": roman,
                    "responseNumber": response_no,
                    "text": transcript or "",
                    "locationCodes": [area_code],
                }
            ]
        }

        logger.info(
            "AI Rorschach score 잡 제출: POST %s/jobs/score (card %s, resp %d, loc %s)",
            base, roman, response_no, area_code,
        )

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            submit = await client.post(f"{base}/jobs/score", json=payload)
            submit.raise_for_status()
            job_id = submit.json().get("jobId")
            if not job_id:
                raise RuntimeError("AI 서버가 jobId 를 반환하지 않았습니다.")

            # 폴링: 2초 간격, 총 self._timeout 초 한도
            import asyncio
            poll_interval = 2.0
            max_wait = self._timeout
            elapsed = 0.0
            while True:
                if elapsed >= max_wait:
                    raise TimeoutError(
                        f"AI 채점 폴링 타임아웃 ({max_wait}s, jobId={job_id})"
                    )
                await asyncio.sleep(poll_interval)
                elapsed += poll_interval
                state = await client.get(f"{base}/jobs/{job_id}")
                state.raise_for_status()
                state_json = state.json()
                status = state_json.get("status")
                if status == "finished":
                    result = state_json.get("result") or {}
                    return _parse_rorschach_result(result, card_no, response_no, area_code)
                if status in ("failed", "canceled", "stopped"):
                    err = state_json.get("error") or "(상세 메시지 없음)"
                    raise RuntimeError(
                        f"AI 채점 잡 {status} (jobId={job_id}): {err}"
                    )
                # queued / started / scheduled / deferred → 계속 대기

    # === 통합 보고서 요약 ===

    async def summarize_report(
        self,
        *,
        client: dict | None,
        exams: list[dict],
    ) -> ReportSummaryResult:
        """검사 결과들 → 검사별 해석 + 최종 종합 해석.

        URL 설정 시 AI 서버 POST {report_summarize_url}로 위임, 미설정 시 룰 폴백.
        """
        if self._report_summarize_url:
            payload = {"client": client, "exams": exams}
            logger.info(
                "AI 서버 호출: POST %s (%d exams)",
                self._report_summarize_url, len(exams),
            )
            async with httpx.AsyncClient(timeout=self._timeout) as c:
                r = await c.post(self._report_summarize_url, json=payload)
                r.raise_for_status()
                return ReportSummaryResult(**r.json())

        if self._report_api_key and self._report_base_url and self._report_model:
            # 동기 SDK → 이벤트 루프 블로킹 방지 위해 스레드에서 실행
            return await asyncio.to_thread(
                _llm_summarize_report, client, exams,
                api_key=self._report_api_key,
                base_url=self._report_base_url,
                model=self._report_model,
                timeout=self._timeout,
            )

        logger.info("통합 보고서 룰베이스 요약 (%d exams)", len(exams))
        return _rule_summarize_report(client, exams)

    # --- Batch → AnalysisResult 변환 ---

    @staticmethod
    def batch_to_analysis_map(
        batch: HTPBatchDetectionResult,
    ) -> dict[str, HTPAnalysisResult]:
        """batch 결과를 category별 HTPAnalysisResult dict로 변환

        Returns:
            {"house": HTPAnalysisResult, "tree": ..., "man": ..., "woman": ...}
        """
        result = {}
        for cat_data in batch.data:
            eng_cat = _KOREAN_TO_ENG.get(cat_data.category)
            if not eng_cat:
                continue

            objects = []
            for det in cat_data.detections:
                objects.append(HTPAnalysisObject(
                    label=det.label,
                    bbox={"points": det.points, "confidence": det.confidence} if det.points else {"points": [], "confidence": []},
                    analysis=None,
                    interpretation=None,
                ))

            result[eng_cat] = HTPAnalysisResult(
                img_size=cat_data.img_size,
                objects=objects,
                general_interpretations=[],
            )

        return result
