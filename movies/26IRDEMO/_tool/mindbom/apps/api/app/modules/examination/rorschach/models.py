"""로르샤하 검사 모델

설계 (docs/로르샤하-프로세스-재설계.md §4-1 — 관계 역전):
- RorschachSession: examination 1건당 세션 1개. 전체 음성/메타.
- RorschachResponse: **주인.** 자유반응 단계에서 생성된다. 영역 없이 존재할 수 있다.
- RorschachRegion: 질문 단계에서 반응에 붙는 영역 조각. 반응당 0..N개.
- RorschachCardAdministration: 카드 레벨 사실(거부/미실시 구분).
- RorschachIntervention: 검사자 개입(촉구·한계검증 등).

**왜 뒤집었나.** 예전에는 Response가 Region에 매달려 있었다
(`region_id: unique NOT NULL`). 그래서 자유반응 단계에서 영역을 억지로
그리게 만들었고, 아날로그 절차(자유반응 전체 → 질문 전체)를 표현할 수 없었다.
실 DB가 그 증거다 — inquiry_text가 0건인데 confirmed는 56건이었다.

또한 영역이 0개인 반응(거부·미완성)이 표현되지 않아, 미완성 프로토콜이
완성된 것처럼 구조요약을 산출하고 R이 틀어졌다. R은 거의 모든 비율의
분모이므로 이는 SaMD 데이터 무결성 결함이다.
"""
from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class RorschachSession(BaseModel):
    """로르샤하 세션 (examination 1:1)

    Attributes:
        examination_id: Examination FK (unique)
        audio_url: 전체 녹음 파일 경로 (Phase 5)
        audio_duration_sec: 총 녹음 길이 (초)
        transcript_json: 화자분리 트랜스크립트 (Phase 3, jsonb)
        started_at: 세션 시작
        ended_at: 세션 종료
    """

    __tablename__ = "rorschach_sessions"

    examination_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)

    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audio_duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    transcript_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)


class RorschachCardAdministration(BaseModel):
    """카드 레벨 사실 — 이 카드를 실시했는가, 거부했는가 (§5-2)

    **거부는 "영역 없는 반응"이 아니라 반응이 없는 것이고, 카드 레벨 사실이다.**
    예전에는 region이 0개면 거부인지 미입력인지 구분되지 않았다. R은 거의 모든
    비율의 분모이므로, 미완성 프로토콜이 완성된 것처럼 구조요약을 냈다.

    Attributes:
        session_id: RorschachSession FK
        card_no: 1..10
        status: pending | responded | rejected
        presented_at: 카드를 건넨 시각 — 반응시간(R/T) 계산의 기준점 (§4-3)
        completed_at: 이 카드를 마친 시각
    """

    __tablename__ = "rorschach_card_administrations"

    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    card_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    presented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)


class RorschachIntervention(BaseModel):
    """검사자 개입 — 촉구·한계검증 등 (§4-1, §5-2)

    거부 전에 촉구했는지가 기록돼야 진짜 거부와 촉구 후 회복이 구분된다.
    한계검증(limits)은 무엇을 유도했는지가 남아야 "안 보인다"에 의미가 생긴다(§13 B-3).

    Attributes:
        session_id: RorschachSession FK
        response_id: 관련 반응 (없을 수 있다 — 카드 전체에 대한 개입)
        card_no: 1..10
        phase: free_association | inquiry | limits_testing
        kind: prompt | pull | repeat | limits | other
        text: 검사자가 실제로 한 말
    """

    __tablename__ = "rorschach_interventions"

    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    response_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    card_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    phase: Mapped[str] = mapped_column(String(30), nullable=False, default="free_association")
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="prompt")
    text: Mapped[str | None] = mapped_column(Text, nullable=True)


class RorschachRegion(BaseModel):
    """**반응이 가리킨 위치.** 반응당 0개 또는 1개 (§4-1, §14-7)

    **관계 역전**: 예전에는 Response가 여기 매달려 있었다. 이제 반대다.

    **위치는 반응당 하나다.** Exner CS에서 위치 부호는 언제나 1개이고
    ("각 객체의 Loc을 먼저 보고, 전체 반응에 단일 Loc 부호를 배정한다"),
    그 부호가 가리키는 영역도 하나다. 표준 영역(Table A)의 `D1`처럼 떨어진
    두 덩어리를 포함하는 영역이 이미 있으므로, 그런 경우도 조각 하나다.

    한 반응 안에서 "여기는 날개, 여기는 몸통"처럼 부분을 나눠 보는 것은
    **위치를 쪼개는 것이 아니라 DQ(발달질)와 내용의 문제다** — DQ+가
    "둘 이상의 대상이 분리되어 있으나 관련됨"이고, DQ는 독립 축이다(§4-4).

    0개인 것은 정상 상태다 — 자유반응만 하고 아직 질문을 안 한 반응이다.
    부호는 `Response.area_code`에 있다. 조각에 두면 1:1인데 값을 담는 자리가
    둘이 되어, 어긋나도 아무도 모른다.

    Attributes:
        response_id: RorschachResponse FK — 관계 역전의 핵심
        session_id: RorschachSession FK (조회 편의 — 정본은 response를 통한 경로)
        path_json: [{x, y}, ...] normalized 0..1. **항상 정위(∧) 기준**으로 저장한다
            — 화면에서 회전 상태로 그렸어도 저장 시 역회전 변환한다(§5-1).
        memo: 검사자 메모
    """

    __tablename__ = "rorschach_regions"

    response_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    # label·color는 없다(2026-08-26 제거). 둘 다 **반응 번호에서 파생되는
    # 값**이라 저장할 것이 아니었다:
    #   라벨 = 표시 번호(`display_numbers()`) · 색 = `responseColor(번호)`
    # 번호 자체가 순서에서 파생되므로, 반응을 하나 지우면 저장값만 옛 번호에
    # 머문다. 읽는 쪽이 하나라도 남아 있으면 그 순간 화면과 갈린다 —
    # 실제로 PDF가 그 옛 번호를 찍고 있었다.
    # 채워 두면 "DB만 보는 소비자"에게 도움이 될 것 같지만 반대다.
    # **낡은 값은 없는 값보다 나쁘다.** 없으면 파생시키고, 있으면 믿는다.
    path_json: Mapped[list] = mapped_column(JSON, nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    # area_code는 여기 없다 — Response로 올라갔다(§14-7).
    # area_match_score·drawn_orientation도 없다(2026-08-26 제거). 둘 다 모델
    # 정의에만 있었고 읽는 코드도 쓰는 코드도 0건이었다(전 행 NULL).
    # drawn_orientation은 애초에 필요가 없었다 — `path_json`이 이미 정위(∧)
    # 기준으로 역회전해서 저장되므로 변환이 저장 시점에 끝난다(§5-1).

    audio_timestamp_start_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    audio_timestamp_end_sec: Mapped[float | None] = mapped_column(Float, nullable=True)


class RorschachResponse(BaseModel):
    """반응 — **이 도메인의 주인** (§4-1 관계 역전)

    자유반응 단계에서 생성된다. 영역(Region)은 질문 단계에서 0..N개 붙는다.
    영역이 없어도 반응은 존재한다 — 아날로그가 그렇기 때문이다.

    설계 원칙 (CDSS):
    - ai_coding_json: AI가 생성한 초안 (절대 덮어쓰지 않음)
    - final_coding_json: 임상가가 확정/수정한 코딩
    - STT 원문(*_stt_raw)과 임상가 확정본도 같은 원칙으로 나눈다 (§4-2).
      검토자가 원본과 대조할 수 없으면 검토가 아니라 승인이다. 또한 분리해야
      "임상가가 확정한 텍스트만 의료기기 데이터"로 격리해 V&V 부담이 준다.

    Attributes:
        session_id: RorschachSession FK — region을 거치지 않고 직접 달린다
        card_no: 1..10. **정본은 여기다** — Region.card_no는 삭제했다(§4-5).
        sort_seq: **카드 안에서의 정렬 서열이지 화면에 보이는 번호가 아니다.**
            화면·보고서의 "반응 3"은 살아 있는 반응을 순서대로 세어 매번
            파생시킨다(`display_numbers()`). 이 컬럼은 그 순서를 정하는 데만 쓴다.

            예전엔 이 값이 곧 표시 번호였는데, 삭제가 재배열을 안 해서 1번을
            지우면 화면에 2,3만 남았다. 실데이터에 결번 4건과 **중복 1건**
            (`[…,10,10,11]`)까지 생겼고, 중복은 정렬을 비결정적으로 만든다.
            근본 원인은 "카드 내 순번"이 이 컬럼과 살아 있는 행들의 실제 순서
            **두 곳**에 있었던 것이다 — 삭제가 둘을 갈라놓는다.

            그래서 순번을 한 곳(순서)으로 모으고 이 컬럼은 서열로 격하했다.
            삭제해도 아무것도 다시 쓰지 않는다 — 간이 벌어질 뿐이고 표시는
            늘 1..n이다.
        phase: free_association | inquiry | limits_testing
        is_formal: 정식 반응인가. limits_testing은 False — R 집계에서 제외된다.

        free_association_stt_raw / free_association_text: STT 원문 / 임상가 확정본
        inquiry_stt_raw / inquiry_text: 질문 단계도 같은 쌍

        card_orientation: up|down|left|right (∧ ∨ < >). **반응마다 붙는다** —
            같은 카드에서도 반응마다 다르다. 자주 돌리는 것 자체가 해석 대상이다(§5-1).
            영역 좌표는 저장 시점에 정위(∧) 기준으로 역회전된다(§5-1) — 그래서
            조각 쪽에는 방향을 남기지 않는다(§13 B-1).

        ai_coding_json / final_coding_json: AI 초안 / 임상가 확정 (jsonb)
        ai_confidence: AI 확신도 (0..1)
        ai_reasoning: AI 채점 근거 텍스트
        confirmed_at / confirmed_by: 임상가 확정 시각·주체
    """

    __tablename__ = "rorschach_responses"

    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    card_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sort_seq: Mapped[int | None] = mapped_column(Integer, nullable=True)

    phase: Mapped[str] = mapped_column(String(30), nullable=False, default="free_association")
    is_formal: Mapped[bool] = mapped_column(nullable=False, default=True)

    free_association_stt_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    free_association_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    inquiry_stt_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    inquiry_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # stt_edited는 없다(2026-08-26 제거). **위 두 쌍에서 파생되는 값**이라
    # 저장할 것이 아니었다: `*_stt_raw != *_text`이면 임상가가 고친 것이다.
    # 저장하면 원문이 바뀌어도 옛 판단만 남는다(`Region.label`과 같은 자리).

    # **위치 부호는 반응당 1개다** (§4-4, §14-7).
    #
    # 예전에는 조각(Region)마다 area_code가 있었다. 그래서 조각 2개에 서로 다른
    # 부호를 넣어도 아무도 막지 않았고, 채점은 "첫 값"을 조용히 골랐다 —
    # 나머지는 화면엔 보이는데 채점엔 안 들어갔다.
    #
    # 형식: `W` / `D6` / `DS6` / `Dd99` — coding_codes.parse_location이
    # 범주(W/D/Dd)와 공백(S) 여부로 쪼갠다. 번호는 여기가 정본이고
    # 구조요약은 범주만 센다. 조각은 이제 "한 위치를 이루는 획"일 뿐이다.
    area_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    card_orientation: Mapped[str | None] = mapped_column(String(10), nullable=True)

    ai_coding_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    final_coding_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 채점의 **근거가 바뀐 시각**. null이면 채점과 원자료가 맞물려 있다.
    #
    # 실시로 돌아가 반응 텍스트·질문·위치 부호·카드 회전을 고치면, 이미 저장된
    # 채점은 **없어진 원자료를 근거로 한 값**이 된다. 그런데 채점 칸은 그대로
    # 차 있으므로 확정 게이트(`response_coded`)는 통과한다 — 어긋난 채로
    # 확정되는 자리다.
    #
    # 지우지 않고 표시만 하는 이유: 오타 한 글자에 임상가가 한 채점이 날아가면
    # **임상가가 오타를 안 고치게 된다.** 되돌아갈 길을 막는 것과 같은 실수다
    # (기록을 채점 단계에서도 고칠 수 있게 한 것과 같은 판단). 값은 남기고
    # 게이트에서 막아, 유지할지 다시 채점할지는 사람이 고른다.
    #
    # 해제는 임상가가 그 반응의 코딩을 **다시 저장할 때**뿐이다. AI 재채점은
    # 초안만 갱신하므로 해제하지 않는다.
    coding_stale_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True
    )

    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    confirmed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
