"""로르샤하 검사 스키마"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.datetime_utils import to_utc_naive

from app.modules.examination.rorschach.coding_codes import (
    is_known_code,
    is_valid_location,
    unknown_codes,
)

# 카드 회전 ∧ ∨ < > (§5-1) — 반응마다 붙는다
CardOrientation = Literal["up", "down", "left", "right"]
# 반응이 만들어진 단계 (§4-1)
ResponsePhase = Literal["free_association", "inquiry", "limits_testing"]
# 카드 레벨 사실 — 거부와 미입력을 구분한다 (§5-2)
CardStatus = Literal["pending", "responded", "rejected"]
# 검사자 개입 종류 (§4-1)
InterventionKind = Literal["prompt", "pull", "repeat", "limits", "other"]


# --- Region ---

class Point(BaseModel):
    x: float
    y: float


class ResponseCreate(BaseModel):
    """반응 생성 — 자유반응 단계의 산물(§4-1).

    영역보다 먼저 존재한다. 영역이 0개인 채로도 유효하다 — 아날로그가 그렇다.
    정렬 서열(`sort_seq`)은 서버가 매긴다: 같은 카드에서 기존 최대값 + 1.
    화면이 계산해 보내면 동시 입력 시 충돌한다. 그 값은 순서를 정할 뿐이고,
    화면에 보이는 번호는 살아 있는 반응을 세어 파생된다(`display_numbers()`).

    **텍스트는 빈 값으로 시작할 수 있다** (§14-2). 예전에는 `min_length=1`로
    막았는데, 그건 "텍스트를 입력해야 반응이 생긴다"는 전제였다. 반응은
    채점지의 한 줄이고 그 줄의 칸은 아무 순서로나 채운다 — 줄을 먼저 만들고
    내용을 나중에 적는 것이 정상 경로다.

    빈 반응이 남는 것은 실시 완료 게이트가 막는다(`completion.py`) —
    입력을 조이는 대신 완료 시점에 검사한다.

    **STT 초안으로 줄을 만들 때는 원문도 함께 보낸다** (§4-2). 같은 문자열이
    두 칸에 들어가지만 뜻이 다르다 — `_stt_raw`는 기계가 들은 것으로 고정이고,
    `_text`는 임상가가 고쳐 나가는 칸이다. 원문이 없으면 나중에 "이건 내가
    적은 건가 기계가 들은 건가"를 구분할 수 없고, 그러면 검토가 아니라 승인이
    된다.
    """
    card_no: int = Field(..., ge=1, le=10)
    free_association_text: str = ""
    free_association_stt_raw: str | None = None
    phase: ResponsePhase = "free_association"
    is_formal: bool = True
    card_orientation: CardOrientation = "up"


class ResponseUpdate(BaseModel):
    """반응 수정 — 텍스트·회전 교정.

    채점(final_coding)은 여기서 건드리지 않는다. 별도 엔드포인트다.
    """
    free_association_text: str | None = None
    inquiry_text: str | None = None
    # STT 원문 — 전사가 도착할 때마다 이어붙는다. 임상가가 고치는 칸은
    # free_association_text 쪽이고, 여기는 기계가 들은 그대로 남는다(§4-2).
    free_association_stt_raw: str | None = None
    # 질문 답변의 STT 원문. **자유반응과 같은 쌍이어야 한다**(§4-2) — 예전에는
    # 이 칸만 받는 자리가 없어서, 임상가가 질문 답변을 고쳐도 "기계가 들은 것"과
    # 대조할 수가 없었다. 화면 주석은 채운다고 적혀 있었는데 실제로는 안 갔다.
    inquiry_stt_raw: str | None = None
    card_orientation: CardOrientation | None = None
    is_formal: bool | None = None
    # 위치 부호 — 반응당 1개(§14-7). 'W' / 'D6' / 'DS6' / 'Dd99'.
    area_code: str | None = Field(None, max_length=20)


class CardStatusUpdate(BaseModel):
    """카드 실시 기록(§5-2) — 거부와 미입력을 구분한다.

    미입력(pending)은 "아직 안 했다", 거부(rejected)는 "제시했으나 반응이
    없었다"이다. 둘을 같은 값으로 두면 R 판정에서 구분할 수 없다.
    """
    status: CardStatus
    presented_at: datetime | None = None

    # 화면은 `toISOString()`으로 tz-aware 값을 보내는데 컬럼은
    # `TIMESTAMP WITHOUT TIME ZONE`이다. 경계에서 UTC naive로 눕힌다 —
    # 이 프로젝트의 저장 규약이다.
    _naive_presented = field_validator("presented_at")(lambda cls, v: to_utc_naive(v))


class InterventionCreate(BaseModel):
    """검사자 개입 기록(§4-1) — 촉구·한계검증 등.

    거부 전에 촉구했는지가 남아야 진짜 거부와 구분된다(§5-2).

    **text는 종류에 따라 필요 여부가 다르다.**

    촉구(prompt)는 **있었다는 사실 자체가 기록의 전부**다. 해석에 쓰이는 것은
    "이 카드에서 촉구가 있었나"이고, 촉구 없는 거부와 촉구 후에도 안 나온 거부는
    그 플래그만으로 구분된다. 여기서 문장을 요구하면 실시 중에 타이핑을 시키는
    셈이라 아무도 기록하지 않게 되고, 기록되지 않는 필수 기록은 없는 것과 같다.

    한계검증(limits)은 반대다 — **무엇을 유도했는지가 없으면 해석할 수 없다.**
    "안 보인다"에 의미가 생기려면 무엇을 대고 물었는지가 남아야 한다(§13 B-3).
    그래서 limits에만 text를 요구한다.
    """
    card_no: int = Field(..., ge=1, le=10)
    kind: InterventionKind
    text: str | None = None
    phase: ResponsePhase = "free_association"
    response_id: str | None = Field(None, max_length=36)

    @model_validator(mode="after")
    def _limits_requires_text(self):
        if self.kind == "limits" and not (self.text or "").strip():
            raise ValueError("한계검증은 무엇을 유도했는지 기록해야 합니다.")
        return self


class InterventionResponse(BaseModel):
    id: str
    session_id: str
    card_no: int
    response_id: str | None = None
    phase: str
    kind: str
    # 촉구는 문장 없이 플래그만 남는다 — InterventionCreate 참조
    text: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CardAdministrationResponse(BaseModel):
    id: str
    session_id: str
    card_no: int
    status: str
    presented_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class RegionCreate(BaseModel):
    """영역 조각 생성.

    response_id가 정본이다(§4-5). card_no로 추론하지 않는다 — 같은 카드에
    반응이 여러 개면 어느 반응인지 알 수 없고, 조용히 틀린 반응에 붙는다.
    """
    response_id: str = Field(..., max_length=36)
    path: list[Point] = Field(..., min_length=2)
    memo: str | None = None
    audio_timestamp_start_sec: float | None = Field(None, ge=0)
    audio_timestamp_end_sec: float | None = Field(None, ge=0)


class RegionUpdate(BaseModel):
    path: list[Point] | None = None
    memo: str | None = None


class RegionResponse(BaseModel):
    """영역 조각. 관계 역전(§4-5) 이후 card_no는 소유 반응에서 파생된다.

    라벨·색은 **내보내지 않는다**(2026-08-26). 둘 다 소유 반응의 표시 번호에서
    파생되는 값이라 조각이 들고 있을 것이 아니다. 화면은 이미 `labelOf`·
    `colorOf`로 파생시킨다 — 여기 필드가 남아 있으면 새 소비자가 그 낡은
    값을 읽어 화면과 갈린다(PDF가 그렇게 갈려 있었다).
    """
    id: str
    session_id: str
    response_id: str | None = None
    card_no: int | None = None
    path: list[Point]
    memo: str | None = None
    audio_timestamp_start_sec: float | None = None
    audio_timestamp_end_sec: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Session ---

class SessionResponse(BaseModel):
    id: str
    examination_id: str
    audio_url: str | None = None
    audio_duration_sec: float | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionStartResponse(BaseModel):
    session: SessionResponse
    examination_status: str


class SessionCompleteRequest(BaseModel):
    audio_duration_sec: float | None = Field(None, ge=0)


# --- Coding (Phase 3) ---

class RorschachCoding(BaseModel):
    """Exner CS 코딩"""
    location: str | None = None
    dq: str | None = None
    determinants: list[str] = []
    fq: str | None = None
    # **세 값이다** — `popular`와 같은 이유다(아래 주석).
    #
    # 쌍반응 (2)는 반점의 대칭에 근거해 같은 대상을 둘로 본 것인지의 판단이다.
    # `bool = False`면 "아직 안 봤다"와 "쌍이 아니라고 판단했다"가 한 값이 된다.
    #
    # 여기서만 유독 나쁜 이유: (2)는 **자아중심성 지표 3r+(2)/R**에 직접
    # 들어가고, 그 값이 다시 S-CON(자살지표)·DEPI로 흘러간다. 검토하지 않은
    # 반응이 "쌍 아님"으로 집계되면 지표가 조용히 낮아진다.
    pair: bool | None = None
    contents: list[str] = []
    # **세 값이다: None(아직 안 봤다) / True(P) / False(P 아님으로 확정).**
    #
    # 예전엔 `bool = False`라 "안 눌렀다"와 "P가 아니라고 판단했다"가 같은
    # 값이었다(§13 E-2). P는 Exner 표(〈표 5-2〉)의 함수이지 인상이 아니므로,
    # 임상가가 표를 보고 판단했는지 아닌지가 구분돼야 한다.
    #
    # 채점은 True만 센다 — None과 False는 둘 다 "P 아님"으로 집계된다.
    # 구분이 필요한 곳은 **검토·감사추적**이지 집계가 아니다.
    popular: bool | None = None
    z_score: str | None = None
    special_scores: list[str] = []


class ResponseDetail(BaseModel):
    """반응 — 이 도메인의 주인(§4-1).

    영역 조각은 0..N개 붙는다. 영역이 없는 반응(거부·미완성)도 정상이며
    R 집계에 포함된다. region_id는 되돌리기용 잔존 컬럼이라 신뢰하지 않는다.
    """
    id: str
    session_id: str
    card_no: int
    region_ids: list[str] = []
    phase: str = "free_association"
    is_formal: bool = True
    # **화면에 보이는 번호** — 카드마다 1..n으로 파생된다(`display_numbers()`).
    # DB의 `sort_seq`(정렬 서열)와 다른 값일 수 있다: 반응을 지우면 서열엔 간이
    # 벌어지지만 여기는 늘 연속이다. 프론트는 이 값만 보면 된다.
    response_no: int | None = None
    # 피검자가 카드를 어느 쪽으로 놓고 봤는가 — 자주 돌리는 것이 해석 대상이다
    card_orientation: str | None = None
    area_code: str | None = None
    free_association_text: str | None = None
    # 기계가 들은 원문 — 화면이 "무엇을 고쳤나"를 대조할 수 있어야 한다(§4-2)
    free_association_stt_raw: str | None = None
    inquiry_text: str | None = None
    # 질문 답변의 원문 — 자유반응과 **같은 쌍**이다(§4-2). 한쪽만 내보내면
    # 화면이 질문 답변에 대해서만 "무엇을 고쳤나"를 못 보여준다.
    inquiry_stt_raw: str | None = None
    ai_coding: RorschachCoding | None = None
    final_coding: RorschachCoding | None = None
    ai_confidence: float | None = None
    ai_reasoning: str | None = None
    # 채점의 근거가 바뀌었는가 — 실시로 돌아가 원자료를 고친 뒤 아직 이 반응의
    # 채점을 다시 저장하지 않았다는 뜻이다. 값은 남아 있지만 확정 게이트는
    # 막힌다(`completion.response_coded`). 화면은 이 값으로 '재검토 필요'를 낸다.
    coding_stale: bool = False
    confirmed_at: datetime | None = None
    confirmed_by: str | None = None

    model_config = {"from_attributes": True}


class CodingUpdateRequest(BaseModel):
    """임상가 코딩 수정.

    transcript_text: 임상가가 채점 시 본 응답 텍스트(검토·교정 후).
        제공되면 free_association_text에 저장. 빈 문자열/None이면 저장 안 함.
    """
    coding: RorschachCoding
    transcript_text: str | None = None

    @field_validator("coding")
    @classmethod
    def _known_codes_only(cls, v: RorschachCoding) -> RorschachCoding:
        """이 시스템이 모르는 부호를 저장하지 않는다.

        채점(scoring.py)은 부호를 이름으로 읽으므로, 철자가 다르면 값이 조용히
        0으로 남는다("INC1" vs "INCOM1"처럼). 저장 시점에 막아야 임상 결과가
        틀린 채로 확정되는 일이 없다.

        검증은 **쓰기 경로에만** 건다. RorschachCoding 자체에 걸면 과거 데이터를
        읽을 때도 걸려(services.py의 ai_coding/final_coding 역직렬화) 옛 기록의
        조회가 통째로 막힌다 — 저장을 막는 것과 열람을 막는 것은 다른 문제다.
        """
        bad: list[str] = []
        for group, codes in (
            ("determinants", v.determinants),
            ("contents", v.contents),
            ("specialScores", v.special_scores),
        ):
            bad += [f"{group}: {c}" for c in unknown_codes(group, codes)]

        # 칸 하나짜리 부호도 같은 이유로 막는다. 예전엔 목록 셋만 봤는데,
        # 이 셋도 채점이 **이름으로** 읽는다(2026-08-26 확인):
        #   dq → DQ+·DQv / fq → X+%·Xu%·X-%·XA%·F+% / zScore → Zf·ZSum·Zd
        # AI가 z_score에 `"1.0"` 같은 값을 주면 Z_TABLE 조회에서 빠져
        # **Zf가 조용히 하나 모자란다.** 에러도 경고도 없다.
        for group, code in (("dq", v.dq), ("fq", v.fq), ("zScore", v.z_score)):
            if not is_known_code(group, code):
                bad.append(f"{group}: {code}")
        if bad:
            raise ValueError(
                "알 수 없는 코딩 부호 — " + ", ".join(bad)
            )

        # location만 목록이 아니라 형태로 본다 — 세부 번호(D1·Dd21)가 붙어
        # 조합이 무한하고, UI가 자유 텍스트 입력이라 오타가 그대로 들어온다.
        # 여기서 막지 않으면 채점이 못 읽어 그 반응이 구조요약에서 사라진다.
        if not is_valid_location(v.location):
            raise ValueError(
                f"해석할 수 없는 영역 부호 — {v.location!r} "
                "(W · D1 · Dd21 · DdS26 · Dd99 같은 형태여야 합니다)"
            )
        return v


class ScoreResponseRequest(BaseModel):
    """단일 **반응** AI 채점 요청 (§7 관계 역전).

    transcript_text: 임상가가 교정한 응답 텍스트.
        제공되면 채점 입력으로 우선 사용. 미제공이면 반응의 확정 텍스트를 쓰고,
        그것도 없으면 서버가 transcript_json에서 반응에 딸린 조각들의 시간
        범위에 걸친 examinee 발화를 추출해 사용한다.
    """
    transcript_text: str | None = None


class TranscriptSegment(BaseModel):
    start: float
    end: float
    speaker: str   # "examiner" | "examinee"
    text: str
    card_no: int | None = None


class TranscriptResponse(BaseModel):
    """transcript-only 응답"""
    segments: list[TranscriptSegment] = []


class TranscriptClipResponse(BaseModel):
    """발화 한 조각의 전사 결과 — 반응 단위 즉시 배치(§3-3).

    text: 전사 초안. **빈 문자열일 수 있다.**
    detected: 음성이 있다고 판단했는가.
        (detected=True, text="")는 "말은 있었는데 인식하지 못했다"이다 —
        환각으로 의심돼 버린 경우가 여기 온다. 화면은 이때 빈 칸을 두고
        임상가가 직접 적게 한다. 틀린 문장을 넣는 것보다 낫다.
    """
    text: str = ""
    detected: bool = False


class AudioUrlResponse(BaseModel):
    """오디오 재생용 presigned URL 응답"""
    url: str
    expires_in: int


class SessionDetailResponse(BaseModel):
    """세션 + 반응 + 영역 + 트랜스크립트 일괄 조회.

    축은 반응이다(§7). cards/interventions는 자유반응·질문 화면이 쓴다 —
    카드 거부는 반응이 0개라서, region이나 response만 봐서는 알 수 없다.
    """
    session: SessionResponse
    regions: list[RegionResponse]
    responses: list[ResponseDetail]
    transcript: list[TranscriptSegment] = []
    cards: list[CardAdministrationResponse] = []
    interventions: list[InterventionResponse] = []


# Phase 2 호환 (기존 GET 응답)
class SessionWithRegionsResponse(BaseModel):
    """세션 + 영역 일괄 조회 (단순)"""
    session: SessionResponse
    regions: list[RegionResponse]


# --- Phase 4: 구조요약 ---

# 구조요약 하위 집계는 `StructuralSummaryResponse`가 dict[str, int]로 받는다.
# LocationSummary·DqSummary·FqSummary 모델이 있었는데 아무도 안 썼다 —
# 부호 집합이 늘 때 여기와 scoring.py 두 곳을 고쳐야 해서 어긋날 자리였다.

class StructuralSummaryResponse(BaseModel):
    """Exner CS 구조요약 (Phase 4 통합: Upper + Lower + SpecialIndices)."""
    R: int

    # 프로토콜 타당성 — "valid" | "insufficient_r" | "not_scored"
    # R<14면 Exner CS 기준 해석 불가 프로토콜이라 lower_section·special_indices가
    # 비어 온다. 화면은 이 값을 보고 재실시 권고를 띄워야 한다.
    validity: str = "valid"

    # === Upper Section (Phase 4-1) ===
    location: dict[str, int]
    Zf: int
    ZSum: float
    ZEst: float
    dq: dict[str, int]
    determinants: dict[str, int]
    blends: list[str]
    blends_count: int
    fq: dict[str, int]
    form_quality_extended: dict[str, int]
    contents: dict[str, int]
    special_scores: dict[str, int]
    P: int
    approach: dict[int, list[str]]

    # 핵심 비율
    # null이면 **정의되지 않음**이다(R=F, 모든 반응이 순수 형태). 0이 아니다 —
    # 0은 "순수 형태반응이 하나도 없다"는 정반대 소견이다(scoring._lambda).
    Lambda: float | None
    EA: float
    es: int
    FM: int
    m: int
    SumC_prime: int
    SumT: int
    SumV: int
    SumY: int
    SumM: int
    WSumC: float
    SumShading: int

    # 형태질 비율
    X_plus_pct: float
    X_u_pct: float
    X_minus_pct: float
    F_plus_pct: float
    P_pct: float

    # === Lower Section (Phase 4-3) — 7개 클러스터, 각 키-값 dict ===
    # 값 타입이 number와 string 혼재 (예: "EB": "3:5")
    lower_section: dict[str, dict[str, int | float | str]]

    # === Special Indices (Phase 4-4) — 6개 지표, 각 항목별 'v' 또는 '' ===
    # 지표 키 → {label, rule, items:[{label, met}], positive}
    #
    # **판정과 항목 문장을 백엔드가 함께 낸다.** 예전에는 조건만 내보내고
    # 문장은 프론트 배열에, 임계값 표는 화면·PDF 두 곳에 있었다. 잇는 것이
    # `"0"`~`"11"` 문자열 인덱스뿐이라 한쪽에 항목을 끼우면 조용히 밀렸다 —
    # 실제로 HVI가 그렇게 밀려 "Zf > 12 ✔"가 다른 조건으로 켜졌다.
    # 게다가 원전의 HVI·OBS는 "N개 이상" 형태가 아니라 화면이 판정할 수 없다.
    special_indices: dict[str, dict]
