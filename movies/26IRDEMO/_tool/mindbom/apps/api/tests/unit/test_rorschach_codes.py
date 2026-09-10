"""Exner 코딩 부호의 정합성 — 채점이 읽는 부호를 UI가 제공하는가.

무엇을 막는 테스트인가
----------------------
scoring.py는 `summary["special_scores"].get("COP", 0)`처럼 부호를 이름으로
읽는다. 그 부호가 UI 드롭다운에 없으면 임상가가 입력할 수 없고, 값은
**항상 0**이 된다. 예외도 경고도 없다 — 지표만 조용히 죽는다.

실제로 그렇게 죽어 있었다(2026-08 발견):
  - ISO Index = (Bt + 2*Cl + Ge + Ls + 2*Na) / R  ← 다섯 항 전부 UI에 없음
  - COP·AG(대인 지각), MOR(병적), PER(개인화), Fd(의존), CP(색채 투사)
대인관계 클러스터가 통째로 0이었고, 화면은 멀쩡히 그려졌다.

왜 소스를 AST로 읽는가
----------------------
부호 목록을 여기 손으로 또 적으면 표가 한 벌 더 늘 뿐이다(그게 원인이었다).
scoring.py를 파싱해 "실제로 참조하는 부호"를 뽑으면, 누가 새 지표를 추가하며
`.get("GHR", 0)`를 쓰는 순간 이 테스트가 터진다. 목록을 손으로 적는 곳은
coding_codes.py 한 곳뿐이다.

정규식이 아니라 AST인 이유는 test_exam_types.py가 겪은 것과 같다 — 정규식은
리팩터링에 취약해 조용히 아무것도 못 찾는 상태가 된다. 그래서 아래
test_extractor_finds_something이 추출기 자체가 죽지 않았는지 먼저 확인한다.
"""
import ast
from pathlib import Path

import pytest

from app.modules.examination.rorschach.coding_codes import (
    CODING_OPTIONS,
    SCORED_GROUPS,
    unknown_codes,
)

SCORING_PATH = (
    Path(__file__).resolve().parents[2]
    / "app" / "modules" / "examination" / "rorschach" / "scoring.py"
)

# scoring.py의 summary 키 → 코딩 그룹 이름
SUMMARY_KEY_TO_GROUP = {
    "determinants": "determinants",
    "contents": "contents",
    "special_scores": "specialScores",
}


class _CodeCollector(ast.NodeVisitor):
    """`summary["<key>"].get("<CODE>")` 와 리터럴 부호 목록을 모은다.

    부호가 변수로 들어오는 형태도 있다:
        sum(summary["special_scores"].get(k, 0) for k in ["DV1", "DV2", ...])
    이때는 `k`가 어떤 리스트에서 왔는지 추적하는 대신, 파일 안의 모든 리터럴
    문자열 목록을 따로 모아 두고(`literals`) 그 그룹의 알려진 부호와 교집합을
    취한다. 지표명("X+%", "WDA%")처럼 부호가 아닌 리터럴은 교집합에서 빠진다.
    """

    def __init__(self) -> None:
        self.by_key: dict[str, set[str]] = {}
        self.var_keys: set[str] = set()
        self.literals: set[str] = set()

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == "get" and node.args:
            obj = func.value
            if isinstance(obj, ast.Subscript) and isinstance(obj.slice, ast.Constant):
                key = obj.slice.value
                arg = node.args[0]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    self.by_key.setdefault(key, set()).add(arg.value)
                elif isinstance(arg, ast.Name):
                    self.var_keys.add(key)
        self.generic_visit(node)

    def _collect_elts(self, node: ast.AST) -> None:
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            for e in node.elts:
                if isinstance(e, ast.Constant) and isinstance(e.value, str):
                    self.literals.add(e.value)

    def visit_comprehension(self, node: ast.comprehension) -> None:
        self._collect_elts(node.iter)
        self.generic_visit(node)

    def visit_For(self, node: ast.For) -> None:
        self._collect_elts(node.iter)
        self.generic_visit(node)

    def visit_Dict(self, node: ast.Dict) -> None:
        # weights = {"DV1": 1, "DV2": 2, ...} — 가중치 표의 키도 부호다
        keys = [
            k.value for k in node.keys
            if isinstance(k, ast.Constant) and isinstance(k.value, str)
        ]
        numeric_values = all(
            isinstance(v, ast.Constant) and isinstance(v.value, (int, float))
            for v in node.values
        )
        if keys and numeric_values:
            self.literals.update(keys)
        self.generic_visit(node)


@pytest.fixture(scope="module")
def collector() -> _CodeCollector:
    c = _CodeCollector()
    c.visit(ast.parse(SCORING_PATH.read_text(encoding="utf-8")))
    return c


def referenced_codes(c: _CodeCollector, group: str) -> set[str]:
    """scoring.py가 이 그룹에서 실제로 읽는 부호."""
    summary_key = next(k for k, g in SUMMARY_KEY_TO_GROUP.items() if g == group)
    codes = set(c.by_key.get(summary_key, set()))
    if summary_key in c.var_keys:
        codes |= c.literals & set(CODING_OPTIONS[group])
    return codes


class TestExtractorHealth:
    """추출기가 죽은 채 통과하는 일을 막는다 (정규식 테스트가 그렇게 깨졌었다)."""

    def test_scoring_file_exists(self):
        assert SCORING_PATH.exists(), f"채점 모듈을 찾지 못했다: {SCORING_PATH}"

    def test_extractor_finds_something(self, collector):
        for group in SCORED_GROUPS:
            found = referenced_codes(collector, group)
            assert found, (
                f"'{group}'에서 참조 부호를 하나도 찾지 못했다. "
                "scoring.py의 조회 형태가 바뀌었다면 이 테스트의 추출기도 고쳐야 한다 "
                "— 조용히 통과하면 검증이 사라진다."
            )


class TestScoringCodesAreSelectable:
    """채점이 읽는 부호는 전부 임상가가 입력할 수 있어야 한다."""

    @pytest.mark.parametrize("group", SCORED_GROUPS)
    def test_every_referenced_code_is_offered(self, collector, group):
        referenced = referenced_codes(collector, group)
        offered = set(CODING_OPTIONS[group])
        missing = sorted(referenced - offered)

        assert not missing, (
            f"scoring.py가 '{group}'에서 읽지만 목록에 없는 부호: {missing}\n"
            "이 부호는 UI에서 고를 수 없으므로 채점 시 항상 0이 된다 "
            "(에러 없이 지표만 죽는다).\n"
            "coding_codes.py에 추가하고 "
            "`uv run python -m scripts.export_rorschach_codes`로 계약을 갱신할 것."
        )


class TestCodeTableSanity:
    def test_no_duplicates(self):
        for group, codes in CODING_OPTIONS.items():
            dupes = sorted({c for c in codes if list(codes).count(c) > 1})
            assert not dupes, f"'{group}'에 중복 부호: {dupes}"

    def test_no_blank_codes(self):
        for group, codes in CODING_OPTIONS.items():
            assert all(c and c.strip() == c for c in codes), (
                f"'{group}'에 공백이 섞인 부호가 있다"
            )

    def test_scored_groups_exist(self):
        for group in SCORED_GROUPS:
            assert group in CODING_OPTIONS, f"알 수 없는 검증 그룹: {group}"


class TestContractFreshness:
    """계약 파일(contracts/rorschach-coding.json)이 부호 표와 일치하는가.

    프론트는 이 계약을 읽어 드롭다운을 대조한다
    (rorschach/coding-contract.spec.ts). 계약이 낡으면 프론트는 옛 표를
    통과하므로, 백엔드에 부호를 추가하고 계약을 안 내보내면 어긋난 채로
    양쪽 테스트가 모두 초록이 된다 — 그 구멍을 여기서 막는다.

    낡았으면 `uv run python -m scripts.export_rorschach_codes`로 갱신할 것.
    """

    def test_contract_is_up_to_date(self):
        import json
        from scripts.export_rorschach_codes import CONTRACT_PATH, build_contract

        assert CONTRACT_PATH.exists(), (
            f"계약 파일이 없다: {CONTRACT_PATH}\n"
            "`uv run python -m scripts.export_rorschach_codes` 실행 필요"
        )
        on_disk = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
        assert on_disk == build_contract(), (
            "계약 파일이 낡았다. coding_codes.py를 고쳤으면 "
            "`uv run python -m scripts.export_rorschach_codes`로 갱신할 것."
        )


class TestWritePathValidation:
    """저장은 막고, 열람은 막지 않는다."""

    def test_rejects_unknown_code_on_save(self):
        from pydantic import ValidationError
        from app.modules.examination.rorschach.schemas import (
            CodingUpdateRequest, RorschachCoding,
        )

        with pytest.raises(ValidationError, match="알 수 없는 코딩 부호"):
            CodingUpdateRequest(
                coding=RorschachCoding(special_scores=["INC1"])  # INCOM1 오타
            )

    def test_accepts_known_codes_on_save(self):
        from app.modules.examination.rorschach.schemas import (
            CodingUpdateRequest, RorschachCoding,
        )

        req = CodingUpdateRequest(
            coding=RorschachCoding(
                location="WS", dq="o", determinants=["Ma", "FC"],
                fq="o", contents=["H", "Bt"], special_scores=["COP", "AG"],
            )
        )
        assert req.coding.special_scores == ["COP", "AG"]

    def test_reading_legacy_coding_is_not_blocked(self):
        """과거 기록에 이상한 부호가 있어도 조회는 되어야 한다.

        검증을 RorschachCoding 자체에 걸면 services.py가 DB의 ai_coding_json을
        역직렬화하는 순간 터진다. 저장을 막는 것과 열람을 막는 것은 다른 문제다.
        """
        from app.modules.examination.rorschach.schemas import RorschachCoding

        legacy = RorschachCoding(special_scores=["INC1"], contents=["Zzz"])
        assert legacy.special_scores == ["INC1"]


class TestUnknownCodes:
    """입력 검증 헬퍼 — 모르는 부호를 조용히 삼키지 않는지."""

    def test_flags_unknown(self):
        assert unknown_codes("specialScores", ["COP", "NOPE"]) == ["NOPE"]

    def test_accepts_known(self):
        assert unknown_codes("specialScores", ["COP", "AG", "MOR"]) == []

    def test_empty_input(self):
        assert unknown_codes("contents", None) == []
        assert unknown_codes("contents", []) == []

    def test_unknown_group_raises(self):
        # 오타난 그룹 이름이 빈 집합으로 통과하면 검증이 사라진다
        with pytest.raises(KeyError):
            unknown_codes("speical_scores", ["COP"])


class TestAIDraftCodeFilter:
    """AI 초안 경로의 부호 검증 — 임상가 저장 경로와 같은 기준이어야 한다.

    무엇을 막는가: 임상가 저장(`CodingUpdateRequest`)에는 계약 검증이 있는데
    **AI 초안 저장에는 없었다**. 그 구멍으로 옛 목업이 만든 `INC1`(INCOM1 오타),
    `M`/`FM`/`ma`(능동·수동 접미사 누락)가 들어와 확정 검사 7건에 굳었다.

    왜 위험한가: 채점은 부호를 이름으로 읽으므로 철자가 다르면 **에러 없이
    0이 된다.** `INC1`은 Sum6에서, `M`은 SumM·EB·Ma:Mp·GHR/PHR에서 빠진다.
    """

    def test_모르는_부호는_빠진다(self):
        from app.modules.examination.rorschach.services import _keep_known

        assert _keep_known("specialScores", ["INC1", "COP"]) == ["COP"]
        assert _keep_known("determinants", ["M", "FM", "Ma"]) == ["Ma"]

    def test_아는_부호는_순서대로_남는다(self):
        from app.modules.examination.rorschach.services import _keep_known

        codes = ["FC", "Ma", "FD"]
        assert _keep_known("determinants", codes) == codes

    def test_조용히_버리지_않는다(self, caplog):
        """무엇을 버렸는지 로그에 남아야 한다 — AI가 계약을 어긴다는 신호다."""
        import logging

        from app.modules.examination.rorschach.services import _keep_known

        with caplog.at_level(logging.WARNING):
            _keep_known("specialScores", ["INC1"], response_id="r1")
        assert "INC1" in caplog.text

    def test_빈_값도_터지지_않는다(self):
        from app.modules.examination.rorschach.services import _keep_known

        assert _keep_known("determinants", None) == []
        assert _keep_known("determinants", []) == []

    def test_추측해서_고치지_않는다(self):
        """`INC1 → INCOM1`은 맞혀볼 수 있지만 `M`은 Ma/Mp/Ma-p 중 무엇인지 모른다.

        능동·수동은 임상 판단이라, 찍으면 틀린 값이 **맞는 것처럼** 저장된다.
        모르는 건 고치지 말고 버려야 한다.
        """
        from app.modules.examination.rorschach.services import _keep_known

        assert "INCOM1" not in _keep_known("specialScores", ["INC1"])
        assert _keep_known("determinants", ["M"]) == []
