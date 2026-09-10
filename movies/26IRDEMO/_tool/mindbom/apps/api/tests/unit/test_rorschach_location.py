"""Location 부호 파싱 — 임상가가 고른 영역 코드를 채점 범주로 환산한다.

무엇을 막는 테스트인가
----------------------
임상가는 위치도에서 세부 영역을 고른다: `D1`, `Dd21`, `DdS26`.
그런데 구조요약이 세는 단위는 범주다: `W` / `D` / `Dd` + 공백(S) 여부.

예전 `_split_location`은 `("W","D","Dd")` 완전일치만 인정했다. 번호가 붙은
값은 `None`을 반환해 **어느 카운트에도 들어가지 않았다.** 실 DB 60건 중
47건이 그렇게 조용히 버려지고 있었다(2026-08-20 발견) — W:D:Dd 분포가
13건만 반영됐고, 거기서 파생되는 Zf·DQ 분포·X+%가 함께 틀어졌다.
예외도 경고도 없었다.

케이스는 추측이 아니라 실제 데이터에서 뽑았다
--------------------------------------------
표준 영역 파일(static/rorschach/areas/card-*.json) 371개의 코드 형태와
실 DB에 저장된 34종을 전수로 확인한 결과, 나타나는 형태는 여섯 가지다:

    W        DN(D1)      DSN(DS5)
             DdN(Dd21)   DdSN(DdS26)   DdsN(Dds30)

`Dds`는 소문자 s를 쓰는 표기 변형이고 표준 영역 파일에 10건 존재한다.
`Dd99`(표에 없는 비정형 영역)도 Exner 표기이므로 함께 받는다.
"""
import pytest

from app.modules.examination.rorschach.scoring import _split_location


class TestPlainCategories:
    """번호 없는 기본형 — 예전에도 되던 것들(회귀 방지)."""

    @pytest.mark.parametrize("loc,base,has_s", [
        ("W",   "W",  False),
        ("D",   "D",  False),
        ("Dd",  "Dd", False),
        ("WS",  "W",  True),
        ("DS",  "D",  True),
        ("DdS", "Dd", True),
    ])
    def test_category_only(self, loc, base, has_s):
        assert _split_location(loc) == (base, has_s)


class TestNumberedAreas:
    """번호가 붙은 실제 영역 코드 — 예전에는 전부 None으로 버려졌다."""

    @pytest.mark.parametrize("loc,base,has_s", [
        # D 계열
        ("D1",    "D",  False),
        ("D9",    "D",  False),
        ("DS5",   "D",  True),
        # Dd 계열
        ("Dd21",  "Dd", False),
        ("Dd35",  "Dd", False),
        ("DdS26", "Dd", True),
        ("DdS35", "Dd", True),
        # 소문자 s 표기 변형 (표준 영역 파일에 10건 존재)
        ("Dds23", "Dd", True),
        ("Dds30", "Dd", True),
        # 표에 없는 비정형 영역
        ("Dd99",  "Dd", False),
    ])
    def test_numbered(self, loc, base, has_s):
        assert _split_location(loc) == (base, has_s)


class TestRealDataCoverage:
    """실 DB에 저장된 34종 전부가 해석된다.

    하나라도 None으로 떨어지면 그 반응은 구조요약에서 사라진다.
    """

    # 2026-08-20 실 DB 전수 조회 결과 (rorschach_responses.location + regions.area_code)
    OBSERVED = [
        "D", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D9", "DS5",
        "Dd", "Dd21", "Dd22", "Dd23", "Dd24", "Dd25", "Dd26", "Dd27",
        "Dd28", "Dd29", "Dd31", "Dd33", "Dd34", "Dd35",
        "DdS26", "DdS27", "DdS28", "DdS29", "DdS30", "DdS32", "DdS35",
        "Dds23", "Dds30", "W",
    ]

    @pytest.mark.parametrize("loc", OBSERVED)
    def test_every_stored_value_resolves(self, loc):
        base, _ = _split_location(loc)
        assert base in ("W", "D", "Dd"), (
            f"'{loc}'이 범주로 해석되지 않는다 — 이 반응은 W:D:Dd 집계에서 "
            f"조용히 사라진다(파생되는 Zf·DQ 분포·X+%도 함께 틀어진다)."
        )

    def test_space_responses_counted(self):
        """공백(S) 반응이 번호와 함께 와도 S로 잡힌다."""
        space_codes = [c for c in self.OBSERVED if "S" in c or "s" in c]
        assert space_codes, "표본에 공백 반응이 없다 — 케이스가 낡았을 수 있다"
        for c in space_codes:
            _, has_s = _split_location(c)
            assert has_s, f"'{c}'의 공백 표시를 놓쳤다"


class TestWriteValidation:
    """저장 시점에 형태를 검증한다 — 파싱이 못 읽을 값을 애초에 받지 않는다.

    `location`은 드롭다운이 아니라 **자유 텍스트 입력**이다(CodingPanel).
    세부 번호가 무한하므로 목록 대조로는 검증할 수 없고, 형태로 본다.

    검증이 없으면 오타(`Dd2l` — 숫자 1 대신 알파벳 L)가 그대로 저장되고,
    파싱이 None을 뱉어 그 반응이 구조요약에서 조용히 사라진다.
    2026-08-20에 고친 43건 소실과 같은 결과가 입력 쪽에서 다시 들어온다.
    """

    @pytest.mark.parametrize("loc", [
        "W", "D1", "Dd21", "DdS26", "Dds30", "DS5", "Dd99", "WS",
    ])
    def test_accepts_valid_forms(self, loc):
        from app.modules.examination.rorschach.schemas import (
            CodingUpdateRequest, RorschachCoding,
        )
        req = CodingUpdateRequest(coding=RorschachCoding(location=loc))
        assert req.coding.location == loc

    @pytest.mark.parametrize("loc", [
        "XYZ",      # 아예 다른 부호
        "Dd2l",     # 숫자 1 대신 알파벳 L — 실제로 일어나는 오타
        "dd21",     # 범주 소문자
        "D-1",      # 구분자
        "99",       # 번호만
        "S",        # 공백 단독
    ])
    def test_rejects_unparseable(self, loc):
        from pydantic import ValidationError
        from app.modules.examination.rorschach.schemas import (
            CodingUpdateRequest, RorschachCoding,
        )
        with pytest.raises(ValidationError, match="영역 부호"):
            CodingUpdateRequest(coding=RorschachCoding(location=loc))

    def test_empty_is_allowed(self):
        """아직 위치를 안 정한 상태는 정상이다 — 채점 중에는 빈 값이 있다."""
        from app.modules.examination.rorschach.schemas import (
            CodingUpdateRequest, RorschachCoding,
        )
        assert CodingUpdateRequest(coding=RorschachCoding()).coding.location is None

    def test_reading_legacy_location_is_not_blocked(self):
        """과거 기록에 이상한 값이 있어도 조회는 되어야 한다."""
        from app.modules.examination.rorschach.schemas import RorschachCoding
        assert RorschachCoding(location="XYZ").location == "XYZ"


class TestRejected:
    """모르는 값은 None으로 남긴다 — 억지로 범주에 밀어 넣지 않는다."""

    @pytest.mark.parametrize("loc", [
        None, "", "   ",
        "X", "ZZ9",       # 아예 다른 부호
        "S",              # 공백 단독은 base가 없다
        "1", "99",        # 번호만
    ])
    def test_unknown_is_none(self, loc):
        base, _ = _split_location(loc)
        assert base is None, f"'{loc}'을 범주로 잘못 해석했다"

    def test_whitespace_is_trimmed(self):
        """앞뒤 공백은 입력 실수이지 다른 값이 아니다."""
        assert _split_location(" D1 ") == ("D", False)

    def test_case_of_category_matters(self):
        """'dd21'처럼 범주를 소문자로 쓴 것은 받지 않는다.

        Dd의 소문자 s(Dds30)는 표준 표기 변형이라 받지만, 범주 자체의
        대소문자까지 흐리면 'D'와 'd'가 같은 값이 되어 오히려 위험하다.
        """
        assert _split_location("dd21")[0] is None
