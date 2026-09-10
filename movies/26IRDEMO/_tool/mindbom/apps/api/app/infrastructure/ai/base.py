"""AI Service ABC — AI 서버 연동 인터페이스 정의

현재 연동:
- POST /detect → detect_htp_batch (HTP 객체 탐지)

추후 추가 예정:
- Rorschach 화자분리 + 채점
- SCT 채점
- 통합 보고서 요약
"""
from abc import ABC, abstractmethod
from pydantic import BaseModel


# === HTP 분석 결과 (도메인 모델) ===

class HTPAnalysisObject(BaseModel):
    """HTP 분석 객체 — 상세 bbox + 분석 조건 포함"""
    label: str
    bbox: dict               # {points: [[x1, y1, x2, y2]], confidence: [float]}
    analysis: dict | None = None
    interpretation: dict | None = None


class HTPAnalysisResult(BaseModel):
    """HTP 카테고리별 분석 결과 — RunAnalysisService 입력 형식"""
    img_size: dict                         # {width, height}
    objects: list[HTPAnalysisObject]
    general_interpretations: list[dict] = []


# === HTP Batch Detection (AI 서버 응답 모델) ===

class HTPDetectionItem(BaseModel):
    """AI 서버 응답: 단일 탐지 객체"""
    label: str                          # 한글 (집전체, 지붕, 문, ...)
    points: list[list[float]]           # [[x1,y1,x2,y2], ...] 픽셀 좌표, 빈 리스트=미탐지
    confidence: list[float]             # [0.99, ...] points와 1:1 대응


class HTPDetectionCategory(BaseModel):
    """AI 서버 응답: 카테고리별 탐지 결과"""
    category: str                       # 한글 (집, 나무, 남자사람, 여자사람)
    img_name: str                       # house, tree, boy, girl
    original_img_url: str | None = None
    img_url: str | None = None
    img_size: dict                      # {width, height}
    detections: list[HTPDetectionItem]


class HTPBatchDetectionResult(BaseModel):
    """AI 서버 응답: POST /detect 전체 결과"""
    meta: dict = {}
    data: list[HTPDetectionCategory]


# === HTP 해석 결과 (해석 API 응답 모델) ===

class HTPInterpretationItem(BaseModel):
    """해석 API 응답: 단일 해석 항목"""
    cls_name: str = ""            # 카테고리 (집, 나무, 사람, "")
    obj_name: str = ""            # 객체명 (집전체, 기둥, ...)
    main_cond: str = ""           # 분석 조건 (크기, 굵기, 객체 유무)
    sub_cond: str = ""            # 분석 값 (크다, 작다, 무)
    main_category: str = ""       # 해석 카테고리 (자기개념, 정서적 안정성, 대인관계)
    sub_category: str = ""        # 하위 카테고리
    main_priority: int = 0
    sub_priority: int = 0
    sentence: str = ""            # 해석 문장
    target_name: str = ""         # 복합 해석 대상 객체명
    checked: bool = False         # 주요 소견 여부
    is_safty: bool = False        # 안전/안정 지표
    flag: str = ""


class HTPInterpretationResult(BaseModel):
    """해석 API 응답: POST /htp/result 전체 결과"""
    status_code: int = 200
    message: str = ""
    data: list[HTPInterpretationItem] = []


# === SCT 채점 결과 ===

class SCTScoredItem(BaseModel):
    """SCT 단일 문항 채점 (이미 임상 표시 schema 0~6점)"""
    stemId: int
    stem: str
    score: int          # 0~6 (0=안정, 6=강한 갈등)
    answer: str | None = None
    reason: str | None = None
    rationale: str | None = None
    subFocus: str | None = None
    subFocusLabel: str | None = None


class SCTDomainScored(BaseModel):
    """SCT 영역별 집계"""
    domain: str
    domainLabel: str
    totalScore: int
    maxScore: int
    items: list[SCTScoredItem]


class SCTScoringResult(BaseModel):
    """SCT 전체 채점 결과 (AI 서버 응답 스키마)"""
    sessionId: str | None = None
    scoredAt: str | None = None
    modelVersion: str | None = None
    scores: list[SCTDomainScored]
    overallSummary: str | None = None


# === Rorschach 채점 결과 ===

class RorschachScoringResult(BaseModel):
    """AI Rorschach 채점 결과 (Exner CS 기반 단일 응답)

    AI 서버 POST /api/rorschach/score 응답 스키마.
    URL 미설정 시 RemoteAIService가 결정론적 룰베이스 mock 반환.
    """
    location: str | None = None              # W / D / Dd / S
    dev_quality: str | None = None           # +, o, v/+, v
    determinants: list[str] = []             # F, M, FM, m, FC, CF, C, ...
    form_quality: str | None = None          # +, o, u, -, none
    content: list[str] = []                  # H, A, Ad, ...
    popular: bool = False
    # 쌍반응 (2). AI 서버는 `coding.pair`로 보내는데 우리가 읽지 않고 있었다
    # (2026-08-26). 자아중심성 지표 3r+(2)/R에 직접 들어가는 값이라,
    # 안 읽으면 그 지표는 항상 반사(Fr+rF)만으로 계산된다.
    pair: bool = False
    z_score: float | None = None
    special_scores: list[str] = []
    confidence: float = 0.7
    reasoning: str = ""


# === 통합 보고서 요약 (검사별 해석 + 종합 해석) ===

class ReportPerExamSummary(BaseModel):
    """검사 1건 해석 — 임상 한 줄(clinical) + 피검사자용 번역 한 줄(plain)"""
    exam_id: str
    exam_type: str                       # htp | rorschach | sct
    clinical: str = ""                   # 이 검사 임상 해석 (한 줄, 전문 용어 허용)
    plain: str = ""                      # 이 검사 피검사자용 번역 (한 줄, 비진단·수치 배제)


class ReportSummaryResult(BaseModel):
    """여러 검사 결과 → 검사별 해석 + 최종 종합 해석 (AI 서버 POST {AI_REPORT_SUMMARIZE_URL})

    URL 미설정 시 RemoteAIService가 결정론적 룰베이스 요약 반환.
    각 소견·종합은 임상 한 줄 + 피검사자용 번역 한 줄로 구성한다.
    """
    per_exam: list[ReportPerExamSummary] = []
    comprehensive: str = ""              # 최종 종합 — 임상적 해석 한 줄 (임상가용)
    plain_summary: str = ""              # 최종 종합 — 피검사자용 쉬운 번역 한 줄
    key_findings: list[str] = []         # 검사 전반 핵심 소견
    model_version: str | None = None


# === 종합보고서 초안 (구조화 섹션 문서) ===

class ComprehensiveDraftInput(BaseModel):
    """종합보고서 AI 초안 입력.

    client: {"name": str, "gender": str|None, "age": int|None, "birth_date": str|None}
    exams: [{"exam_type": str, "exam_date": str|None, "signals": dict}]
    """
    client: dict
    exams: list[dict] = []


class ComprehensiveDraftSection(BaseModel):
    """AI가 생성한 섹션 초안"""
    key: str
    title: str
    body: str


class ComprehensiveDraftResult(BaseModel):
    """종합보고서 AI 초안 결과.

    AI 서버 미연동 시 RemoteAIService가 결정론적 룰베이스 초안 반환.
    """
    sections: list[ComprehensiveDraftSection] = []
    model_version: str = "rule-based-fallback"


# === Service Interface ===

class AIService(ABC):
    """AI 서비스 인터페이스

    구현체: RemoteAIService (AI 서버 HTTP 연동)
    """

    @abstractmethod
    async def detect_htp_batch(
        self,
        images: dict[str, bytes],
        meta: dict | None = None,
    ) -> HTPBatchDetectionResult:
        """HTP 이미지 일괄 객체 탐지 (AI 서버 POST /detect)"""
        ...

    @abstractmethod
    async def interpret_htp(
        self,
        detection_result: HTPBatchDetectionResult,
        child: dict | None = None,
    ) -> HTPInterpretationResult:
        """HTP 탐지 결과를 해석 API에 전송하여 해석 결과 획득

        Args:
            detection_result: detect_htp_batch의 결과
            child: {"name": str, "birth": str, "gender": str}
        """
        ...

    @abstractmethod
    async def score_sct(
        self,
        items: list[dict],
        *,
        session_id: str | None = None,
    ) -> SCTScoringResult:
        """SCT 채점 (AI 서버 POST {AI_SCT_SCORE_URL}).

        Args:
            items: [{"stemId": int, "domain": str, "domainLabel": str, "stem": str,
                    "isCompound": bool, "answer": str, "reason": str | None}]
            session_id: 검사 ID 등 추적용 식별자
        """
        ...

    @abstractmethod
    async def score_rorschach(
        self,
        *,
        card_no: int,
        response_no: int,
        transcript: str,
        location_marking: dict | None = None,
        inquiry_transcript: str | None = None,
    ) -> RorschachScoringResult:
        """Rorschach 단일 응답 채점 (Exner CS).

        AI 서버 POST {AI_RORSCHACH_SCORE_URL}. URL 미연동 시 결정론적 룰베이스 mock 반환.
        """
        ...

    @abstractmethod
    async def summarize_report(
        self,
        *,
        client: dict | None,
        exams: list[dict],
    ) -> ReportSummaryResult:
        """여러 검사 결과를 종합해 검사별 해석 + 최종 종합 해석 생성.

        AI 서버 POST {AI_REPORT_SUMMARIZE_URL}. URL 미설정 시 결정론적 룰베이스 요약.

        Args:
            client: {"name": str, "gender": str, "birth_date": str, "age": int|None}
            exams: [{"exam_id": str, "exam_type": str, "findings": list[str],
                     "summary": str}]  — findings는 각 검사에서 추출한 소견 문장들
        """
        ...

    @abstractmethod
    async def generate_comprehensive_draft(
        self,
        payload: "ComprehensiveDraftInput",
    ) -> "ComprehensiveDraftResult":
        """종합보고서 AI 초안 생성 (검사 결과 취합 → 종합 소견/제언 초안).

        AI 서버 POST {AI_COMPREHENSIVE_URL}. URL 미연동 시 결정론적 룰베이스 초안 반환.
        CDSS 원칙: AI는 초안까지만, 최종 확정은 임상가.
        """
        ...
