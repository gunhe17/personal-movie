"""Exner CS 코딩 부호의 단일 출처.

왜 이 파일이 필요한가
---------------------
부호 목록이 프론트 UI(드롭다운)와 백엔드 채점(scoring.py) 양쪽에 각각
손으로 적혀 있었고, 어긋나 있었다. UI에 없는 부호는 임상가가 입력할
방법이 없으므로 scoring.py가 `.get("COP", 0)`으로 읽을 때 **항상 0**이
나온다. 에러도 경고도 없이 지표만 조용히 죽는다.

실제로 죽어 있던 것:
  - ISO Index = (Bt + 2*Cl + Ge + Ls + 2*Na) / R  ← 다섯 항 전부 UI에 없어 분자가 항상 0
  - COP·AG (대인 지각), MOR (병적), PER (개인화), Fd (의존), CP (색채 투사)
즉 대인관계 클러스터가 통째로 비어 있었다.

무엇이 정본인가
---------------
**계산이 진실이다.** scoring.py가 참조하는 부호가 곧 "이 시스템이 아는
부호"이고, UI는 그것을 빠짐없이 제공해야 한다. 반대 방향(UI에만 있고
채점이 안 보는 부호)은 무해하다 — 기록으로 남을 뿐 계산을 바꾸지 않는다.

그래서 검증 방향은 한쪽이다:
    scoring.py가 참조하는 부호  ⊆  이 파일의 목록  ⊆  UI 드롭다운

첫 번째 포함은 tests/unit/test_rorschach_codes.py가 scoring.py를 AST로
읽어 강제하고, 두 번째는 contracts/rorschach-coding.json을 통해 프론트
테스트가 강제한다. 목록을 손으로 적는 건 여기 한 곳뿐이다.

부호 체계 출처: Exner Comprehensive System (CS)
"""
import re

# --- Location: 반응 영역 ---
# 아래 목록은 기본형 참고용이다. 실제 저장값에는 번호가 붙으므로
# 검증·해석은 목록이 아니라 parse_location()이 한다(이 파일 아래).
# 그래서 UI는 S 결합형까지 제공해야 임상가가 공백 반응을 입력할 수 있다.
LOCATION_CODES: tuple[str, ...] = ("W", "D", "Dd", "WS", "DS", "DdS")

# --- Developmental Quality ---
DQ_CODES: tuple[str, ...] = ("+", "o", "v/+", "v")

# --- Determinants: 결정인 ---
# scoring.py의 분류 집합(HUMAN_MOVEMENT/ACHROMATIC/TEXTURE/...)과 같은 어휘다.
DETERMINANT_CODES: tuple[str, ...] = (
    # 형태
    "F",
    # 운동 — 인간 / 동물 / 무생물
    "Ma", "Mp", "Ma-p",
    "FMa", "FMp", "FMa-p",
    "ma", "mp", "ma-p",
    # 유채색
    "FC", "CF", "C", "Cn",
    # 무채색
    "FC'", "C'F", "C'",
    # 재질 / 차원(V) / 확산음영
    "FT", "TF", "T",
    "FV", "VF", "V",
    "FY", "YF", "Y",
    # 형태차원 / 반사
    "FD",
    "Fr", "rF",
)

# --- Form Quality ---
# "none"은 FQ 없음을 뜻하는 UI 표기다(값이 비어 있음과 구분하기 위한 명시적 선택지).
FQ_CODES: tuple[str, ...] = ("+", "o", "u", "-", "none")

# --- Contents: 반응 내용 ---
# 예전 UI에는 앞의 12개만 있었다. Bt/Cg/Cl/Fd/Ge/Ls/Na/Xy 여덟 개가 빠져
# ISO Index와 Food가 구조적으로 0이었다.
CONTENT_CODES: tuple[str, ...] = (
    # 인간
    "H", "(H)", "Hd", "(Hd)", "Hx",
    # 동물
    "A", "(A)", "Ad", "(Ad)",
    # 해부·예술·인류
    "An", "Art", "Ay",
    # 자연·풍경 계열 — ISO Index 구성 항
    "Bt", "Cl", "Ge", "Ls", "Na",
    # 기타 — CDI/특수지표에서 참조
    "Bl", "Cg", "Ex", "Fd", "Fi", "Hh", "Sc", "Sx", "Xy", "Id",
)

# --- Z score: 조직화 활동 ---
Z_SCORE_CODES: tuple[str, ...] = ("ZW", "ZA", "ZD", "ZS")

# --- Special Scores: 특수 점수 ---
# 앞의 열은 Sum6/WSum6(사고 장애)을 이룬다. 뒤의 여섯은 예전 UI에서 통째로
# 빠져 있었고, 그래서 COP/AG/MOR/PER/CP가 항상 0이었다.
SPECIAL_SCORE_CODES: tuple[str, ...] = (
    # 인지적 특수점수 (Sum6 / WSum6)
    "DV1", "DV2",
    "DR1", "DR2",
    "INCOM1", "INCOM2",
    "FABCOM1", "FABCOM2",
    "ALOG", "CONTAM",
    # 주제적 특수점수
    "AB", "AG", "COP", "MOR", "PER",
    # 기타
    "CP", "PSV",
)


# 프론트 드롭다운의 그룹 키와 같은 이름을 쓴다(RorschachCoding 스키마의 필드명).
# 여기서 이름이 갈리면 계약을 읽는 쪽이 다시 매핑을 적어야 한다.
CODING_OPTIONS: dict[str, tuple[str, ...]] = {
    "location": LOCATION_CODES,
    "dq": DQ_CODES,
    "determinants": DETERMINANT_CODES,
    "fq": FQ_CODES,
    "contents": CONTENT_CODES,
    "zScore": Z_SCORE_CODES,
    "specialScores": SPECIAL_SCORE_CODES,
}

# `scoring.py가 읽는 부호 ⊆ 이 표`를 **AST로 대조하는** 그룹.
#
# ⚠️ 이 목록은 "검증하는 그룹 전부"가 아니다. 저장 경로의 부호 검증
# (`CodingUpdateRequest`)은 dq·fq·zScore까지 **모든 그룹**에 걸린다.
# 여기 있는 셋은 그 위에 AST 대조까지 더 받는 그룹일 뿐이다.
#
# 빠진 그룹의 이유 — **AST 추출기가 못 읽는 형태**라서다:
#   dq / fq  — `summary["<key>"].get("<CODE>")` 꼴이 아니라 지역 Counter를
#              거쳐 읽는다(`dq_counter.get("+")`, `fq.get("o")`).
#   zScore   — `z in Z_TABLE[card_no]`. 부호가 코드가 아니라 표의 키에 있다.
#
#   (예전 주석은 "이 셋은 부호를 열거하지 않는다"고 적혀 있었다. **사실이
#    아니다** — 셋 다 이름으로 열거한다(2026-08-26 확인). 그 잘못된 설명이
#    저장 경로에 검증이 없는 것을 정당해 보이게 하고 있었다.)
#
#   location — `summary["location"]`은 입력 부호가 아니라 **집계 결과**다.
#                     scoring.py가 WS/DS/DdS에서 S를 떼어(`_split_location`)
#                     W/D/Dd 카운트와 S 카운트를 따로 만들고, "S"·"W+D" 같은
#                     파생 키로 조회한다. 그 키들은 임상가가 고르는 선택지가
#                     아니므로 UI 목록과 대조하면 안 된다.
SCORED_GROUPS: tuple[str, ...] = (
    "determinants",
    "contents",
    "specialScores",
)


# --- Location: 형태로 검증한다 ---
#
# location만 목록 대조가 불가능하다. 임상가는 위치도에서 세부 영역을 고르므로
# 저장값에 번호가 붙고(D1, Dd21, DdS26), 그 조합은 무한하다. 게다가 UI가
# 드롭다운이 아니라 자유 텍스트 입력이라 오타가 그대로 들어온다.
#
# 나타나는 형태는 여섯이다. 표준 영역 파일 371개와 실 DB 34종을 전수 확인했다:
#     W        DN(D1)      DSN(DS5)
#              DdN(Dd21)   DdSN(DdS26)   DdsN(Dds30)
# 여기에 Dd99(표에 없는 비정형 영역)가 더해진다.
#
# 소문자 s(Dds30)는 **데이터 표기 흔들림이지 별개 범주가 아니다.**
# 임상가 2인 검토(2026-08-20)에서 실제 어휘는 W/D/Dd/WS/DS/DdS 여섯이었다.
# 받아주는 것은 이미 저장된 값을 읽기 위해서이고, 대문자 S와 같게 해석한다.
#
# 번호는 벗겨낸다. 임상가 확인: "중요한 것은 뒤의 숫자가 아니라
# D/Dd/W/DS/DdS/WS라는 영역을 작성하고 집계하는 것"
#
# 'Dd'를 'D'보다 먼저 시도해야 한다 — 'D'가 먼저 걸리면 'Dd21'의 'd'가 남는다.
LOCATION_RE = re.compile(r"^(W|Dd|D)([Ss])?(\d*)$")


def parse_location(loc: str | None) -> tuple[str | None, bool]:
    """영역 코드를 채점 범주와 공백(S) 여부로 나눈다.

        'W'      → ('W',  False)
        'D1'     → ('D',  False)     번호는 범주에 영향을 주지 않는다
        'DS5'    → ('D',  True)
        'DdS26'  → ('Dd', True)
        'Dds30'  → ('Dd', True)      소문자 s는 표기 변형
        'Dd99'   → ('Dd', False)     표에 없는 비정형 영역
        'XYZ'    → (None, False)     해석 불가

    구조요약이 세는 단위는 범주뿐이므로 번호를 벗겨낸다. 번호 자체는
    area_code가 정본으로 보관하며 위치도 표시에 쓰인다.

    scoring.py와 schemas.py가 **같은 규칙을 쓰도록** 여기 둔다.
    양쪽이 각자 정규식을 갖고 있으면 어긋나도 아무도 모른다.
    """
    if not loc:
        return (None, False)
    m = LOCATION_RE.match(loc.strip())
    if not m:
        return (None, False)
    base, s_mark, _number = m.groups()
    return (base, s_mark is not None)


def is_valid_location(loc: str | None) -> bool:
    """저장해도 되는 형태인가. 빈 값은 허용한다(아직 안 정한 상태)."""
    if not loc:
        return True
    return parse_location(loc)[0] is not None


def all_codes(group: str) -> frozenset[str]:
    """그룹의 부호 집합. 없는 그룹이면 KeyError — 조용히 빈 집합을 주지 않는다."""
    return frozenset(CODING_OPTIONS[group])


def unknown_codes(group: str, codes: list[str] | None) -> list[str]:
    """목록 중 이 시스템이 모르는 부호. 검증·경고용이며 순서를 보존한다."""
    if not codes:
        return []
    known = all_codes(group)
    return [c for c in codes if c not in known]


def is_known_code(group: str, code: str | None) -> bool:
    """칸 하나짜리 부호(dq·fq·zScore)가 이 시스템의 어휘인가.

    빈 값은 통과시킨다 — **"아직 안 정했다"는 오류가 아니다.** 세 필드 모두
    `str | None`이고, 채점은 빈 값을 그냥 안 센다(`if coding.get("dq")`).

    목록 부호(`unknown_codes`)와 나뉘어 있을 뿐 막는 이유는 같다: 채점이
    부호를 **이름으로** 읽으므로 철자가 다르면 에러 없이 지표만 죽는다.
        dq  → `dq_counter.get("+"/"o"/"v/+"/"v")`   DQ+·DQv
        fq  → `fq.get("+"/"o"/"u"/"-"/"none")`      X+%·Xu%·X-%·XA%·F+%
        z   → `z in Z_TABLE[card_no]`               Zf·ZSum·Zd
    """
    if not code:
        return True
    return code in all_codes(group)


# --- Popular(평범반응) 표 ---
#
# **출처: 『로르샤하 종합체계 워크북』(Exner) 〈표 5-2〉 "종합체계에서 사용된
# 평범반응" 89쪽.** `docs/로르샤하 종합체계 워크북-exner_compressed.pdf`
#
# 왜 표가 필요한가
# ----------------
# P는 **Exner 표의 함수**이지 임상가의 인상이 아니다. 그런데 화면은 체크박스
# 하나로 받고 기본값이 False였다 — "안 눌렀다"와 "P 아님으로 확정했다"가
# 구분되지 않았다(§13 E-2).
#
# 표가 있으면 **자동 제안 → 임상가 확인**이 된다. AI가 아니라 표에서 나온
# 값이므로 결정적이고, 임상가는 확인만 한다(CDSS).
#
# ⚠️ **표만으로 P를 자동 판정할 수는 없다.** 기준에 "반점의 꼭대기가 박쥐의
# 상단부로 지각되고"처럼 **내용과 지각 방식**에 대한 조건이 붙는다. 영역이
# 맞아도 무엇으로 봤는지가 다르면 P가 아니다. 그래서 이 표가 답하는 것은
# 딱 하나다: **"이 카드의 이 영역이 평범반응 자리인가."** 나머지는 사람이 본다.
#
# 카드 I·V·X는 서로 다른 평범반응이 같은 영역에 둘씩 있다(박쥐/나비, 게/거미).
# 그래서 카드→영역이 아니라 **항목의 목록**으로 둔다.

POPULAR_RESPONSES: tuple[dict, ...] = (
    {"card_no": 1, "locations": ("W",), "content": "박쥐",
     "criteria": "반점의 꼭대기가 박쥐의 상단부로 지각되고 항상 반점 전체를 포함해야 한다."},
    {"card_no": 1, "locations": ("W",), "content": "나비",
     "criteria": "반점의 꼭대기가 나비의 상단부로 지각되고 항상 반점 전체를 포함해야 한다."},
    {"card_no": 2, "locations": ("D1",), "content": "구체적으로 밝혀진 동물",
     "criteria": "곰, 개, 코끼리 또는 양. 보통 머리나 상체가 있으나 동물 전체를 포함하고 있어도 P를 부여한다."},
    {"card_no": 3, "locations": ("D9",), "content": "인간상이나 인형·만화 등의 묘사",
     "criteria": "D1이 두 인간상으로 사용되었다면, D7이나 Dd31은 인간상의 부분으로 보고되지 않아야 P로 기호화한다."},
    {"card_no": 4, "locations": ("W", "D7"), "content": "인간이나 거인",
     "criteria": "괴물, 공상과학에서 나오는 생명체와 같이 인간을 닮은 모양. 동물상은 P로 기호화하지 않는다."},
    {"card_no": 5, "locations": ("W",), "content": "박쥐",
     "criteria": "반점의 꼭대기를 박쥐의 상단부로 지각해야 하고 항상 반점 전체를 포함해야 한다."},
    {"card_no": 5, "locations": ("W",), "content": "나비",
     "criteria": "반점의 꼭대기를 나비의 상단부로 지각해야 하고 항상 반점 전체를 포함해야 한다."},
    {"card_no": 6, "locations": ("W", "D1"), "content": "동물가죽·짐승가죽·융단이나 모피",
     "criteria": "고양이나 여우 같은 동물 전체를 기술하는 데 자주 포함된다. 수검자가 가죽·융단·모피를 실제로 언급했는지, 반응기술에 분명하게 내포되어 있는지에 근거해 결정한다."},
    {"card_no": 7, "locations": ("D9",), "content": "사람의 머리나 얼굴",
     "criteria": "여자·아이·인디언처럼 밝힐 수도, 성별을 밝히지 않을 수도 있다. D2나 Dd23 영역을 포함한다면 D9 영역에 한해서 머리나 얼굴이라고 할 때만 P로 기호화된다."},
    {"card_no": 8, "locations": ("D1",), "content": "전체 동물상",
     "criteria": "개·고양이·다람쥐 같은 종류로 보고 D4 영역과 가까운 부분을 동물의 머리로 지각한다."},
    {"card_no": 9, "locations": ("D3",), "content": "인간 또는 인간과 유사한 형상",
     "criteria": "마녀, 거인, 괴물, 공상과학에 나오는 생명체."},
    {"card_no": 10, "locations": ("D1",), "content": "게",
     "criteria": "모든 부속기관은 D1 영역에 한정되어 있어야 한다."},
    {"card_no": 10, "locations": ("D1",), "content": "거미",
     "criteria": "모든 부속기관은 D1 영역에 한정되어 있어야 한다."},
)


def popular_candidates(card_no: int, location: str | None) -> tuple[dict, ...]:
    """이 카드·영역이 평범반응 자리인가 — 해당하는 표 항목들.

    빈 튜플이면 그 자리에서는 P가 나올 수 없다. 비어 있지 않다고 P인 것은
    **아니다** — 무엇으로 봤는지는 임상가가 본다(위 주석 참조).

    영역은 세부 번호까지 정확히 맞아야 한다. `W`는 `W`로, `D1`은 `D1`로 —
    `WS`나 `D1` 아닌 `D3`은 다른 자리다. 다만 공백 반응(S)이 붙은 형태는
    범주를 떼어 비교한다: `WS`도 W 자리다.
    """
    if not location:
        return ()
    base, _has_space = parse_location(location)
    if base is None:
        return ()
    # 'WS' → 'W', 'DS1' → 'D1' 로 정규화해 표와 맞춘다
    normalized = location.replace("S", "", 1) if _has_space else location
    return tuple(
        p for p in POPULAR_RESPONSES
        if p["card_no"] == card_no and normalized in p["locations"]
    )


# --- 조직활동 Z값 (카드별) ---
#
# **정본은 `scoring.py`의 `Z_TABLE`이다** — 채점이 실제로 읽는 표가 정본이어야
# 한다. 여기서는 계약으로 내보내기 위해 참조만 한다.
#
# 화면이 이 값을 알아야 하는 이유: 임상가가 ZW/ZA/ZD/ZS 중 하나를 고르는데,
# **값은 카드마다 다르다**(카드 I의 ZW=1.0, 카드 IX의 ZW=5.5). 부호만 보이면
# 무엇을 고르는지 알 수 없고, 두 기준을 함께 만족할 때 "더 높은 값을 준다"는
# 규칙(워크북 94쪽)도 적용할 수 없다.
def z_values_by_card() -> dict[int, dict[str, float]]:
    """카드 → {ZW/ZA/ZD/ZS → 값}. 계약 내보내기가 쓴다.

    순환 import를 피하려고 함수 안에서 가져온다 — `scoring`이
    `coding_codes.parse_location`을 이미 쓰고 있다.
    """
    from app.modules.examination.rorschach.scoring import Z_TABLE

    return {card: dict(vals) for card, vals in Z_TABLE.items()}
