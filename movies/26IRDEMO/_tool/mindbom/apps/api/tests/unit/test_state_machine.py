"""검사 상태 머신 단위 테스트 (SaMD CDSS V&V)"""
import json
from functools import cache
from pathlib import Path

import pytest

from app.core.exceptions import InvalidStateTransitionException
from app.modules.examination.common.state_machine import (
    ALL_STATUSES,
    CONFIRMED_STATUSES,
    STATUS_LABELS,
    VALID_TRANSITIONS,
    can_transition,
    get_next_statuses,
    validate_transition,
)

# 언어 중립 계약 — 프론트도 같은 파일을 읽는다(core/state-contract.spec.ts)
# tests/unit/test_state_machine.py → apps/api → apps → 리포지토리 루트
CONTRACT_PATH = Path(__file__).resolve().parents[4] / "contracts" / "exam-state.json"


@cache
def _contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


class TestValidTransitions:
    """허용된 전이는 예외 없이 통과"""

    def test_created_to_in_progress(self):
        validate_transition("created", "in_progress")

    def test_in_progress_to_ai_draft_ready(self):
        """초안이 만들어지면 검토 대기로.

        분석 자체는 상태가 아니라 작업이다(ai_analysis_jobs).
        """
        validate_transition("in_progress", "ai_draft_ready")

    def test_ai_draft_ready_to_under_review(self):
        validate_transition("ai_draft_ready", "under_review")

    def test_under_review_to_confirmed(self):
        validate_transition("under_review", "confirmed")

    def test_reanalyze_returns_to_in_progress(self):
        """재분석 요청 — 초안을 버리고 진행중으로 되돌린다.

        분석이 status에서 빠졌으므로 재분석은 '초안 이전 상태로 돌아가
        다시 만든다'가 된다. 초안 완료·검토중 어느 쪽에서든 가능하다.
        """
        validate_transition("ai_draft_ready", "in_progress")
        validate_transition("under_review", "in_progress")

    def test_confirmed_to_report_generated(self):
        validate_transition("confirmed", "report_generated")

    def test_report_generated_is_terminal(self):
        """마인드봄의 일은 여기서 끝난다.

        그 뒤의 '완료'는 운영 플랫폼이 담당자 검수로 판정하는 별개 사건이다.
        같은 이름을 우리 축에 두면 동명이의가 되고, 자동 매핑하면 사람의
        검수가 조용히 사라진다.
        """
        assert get_next_statuses("report_generated") == []
        with pytest.raises(InvalidStateTransitionException):
            validate_transition("report_generated", "completed")


class TestInvalidTransitions:
    """허용되지 않은 전이는 예외 발생 (SaMD 무결성)"""

    def test_created_skip_to_completed(self):
        with pytest.raises(InvalidStateTransitionException):
            validate_transition("created", "completed")

    def test_completed_is_not_a_status(self):
        """'완료'는 플랫폼 소관이라 우리 축에 없다 — 알 수 없는 상태로 거부된다.

        과거 데이터에는 이 값이 남아 있을 수 있어 읽기 판정(is_confirmed)은
        여전히 받아 주지만, 전이는 만들지 않는다.
        """
        assert "completed" not in ALL_STATUSES
        with pytest.raises(InvalidStateTransitionException, match="알 수 없는"):
            validate_transition("completed", "in_progress")

    def test_confirmed_cannot_go_back_to_under_review(self):
        with pytest.raises(InvalidStateTransitionException):
            validate_transition("confirmed", "under_review")

    def test_unknown_status(self):
        with pytest.raises(InvalidStateTransitionException, match="알 수 없는"):
            validate_transition("invalid_state", "completed")


class TestHelpers:
    def test_can_transition_returns_bool(self):
        assert can_transition("created", "in_progress") is True
        assert can_transition("created", "completed") is False

    def test_get_next_statuses_for_terminal(self):
        assert get_next_statuses("completed") == []

    def test_get_next_statuses_includes_branching(self):
        nexts = get_next_statuses("under_review")
        assert "confirmed" in nexts      # 확정
        assert "in_progress" in nexts    # 재분석

    def test_all_statuses_count(self):
        """6개 상태 — ai_analyzing은 작업으로, completed는 플랫폼으로 분리됐다"""
        assert len(ALL_STATUSES) == 6

    def test_ai_analyzing_is_not_a_status(self):
        """분석은 상태가 아니라 작업이다 — ai_analysis_jobs가 담는다."""
        assert "ai_analyzing" not in ALL_STATUSES
        with pytest.raises(InvalidStateTransitionException, match="알 수 없는"):
            validate_transition("ai_analyzing", "ai_draft_ready")

    def test_state_machine_completeness(self):
        """모든 상태가 VALID_TRANSITIONS에 포함됨"""
        expected = {
            "created", "in_progress", "ai_draft_ready",
            "under_review", "confirmed", "report_generated",
        }
        assert set(VALID_TRANSITIONS.keys()) == expected

    def test_transition_targets_are_known_statuses(self):
        """전이 대상이 전부 정의된 상태인지 — 오타 방지"""
        for src, targets in VALID_TRANSITIONS.items():
            for dst in targets:
                assert dst in VALID_TRANSITIONS, f"{src} → {dst}: 정의되지 않은 상태"

    def test_every_status_has_label(self):
        for status in ALL_STATUSES:
            assert STATUS_LABELS.get(status), f"{status}에 한글 라벨이 없다"


class TestTransitionMatrix:
    """7×7 = 49칸 전수 표 — 허용/불허를 명시적으로 고정한다.

    기존 테스트는 허용 전이를 띄엄띄엄 확인할 뿐이라, 전이 규칙을 바꿨을 때
    '무엇이 달라졌는지'가 드러나지 않는다. 여기서 49칸을 전부 못박아 두면
    상태를 추가·제거하는 리팩터링에서 의도한 변경만 diff로 남는다.

    (SaMD V&V: 상태 전이 규칙은 검증 대상이므로 전수 명세가 필요하다)
    """

    # 허용되는 전이 전부. 여기 없는 조합은 전부 거부되어야 한다.
    ALLOWED: set[tuple[str, str]] = {
        ("created", "in_progress"),
        ("in_progress", "ai_draft_ready"),
        ("ai_draft_ready", "under_review"),
        ("ai_draft_ready", "in_progress"),    # 재분석
        ("under_review", "confirmed"),
        ("under_review", "in_progress"),      # 재분석
        ("confirmed", "report_generated"),
        # report_generated가 최종 — 그 뒤 '완료'는 플랫폼 소관
    }

    def test_matrix_matches_allowed_set(self):
        """VALID_TRANSITIONS를 (src, dst) 집합으로 펼쳐 ALLOWED와 일치 확인"""
        actual = {
            (src, dst)
            for src, targets in VALID_TRANSITIONS.items()
            for dst in targets
        }
        assert actual == self.ALLOWED

    @pytest.mark.parametrize("src", ALL_STATUSES)
    @pytest.mark.parametrize("dst", ALL_STATUSES)
    def test_every_pair(self, src: str, dst: str):
        """64칸 전수 검증 — can_transition이 ALLOWED와 정확히 일치"""
        expected = (src, dst) in self.ALLOWED
        assert can_transition(src, dst) is expected, (
            f"{src} → {dst}: {'허용' if expected else '거부'}되어야 한다"
        )

    def test_no_self_loops(self):
        """자기 자신으로의 전이는 없다 (재진입은 별도 상태를 거친다)"""
        for status in ALL_STATUSES:
            assert not can_transition(status, status), f"{status} 자기 전이 허용됨"

    def test_reachability_from_created(self):
        """created에서 모든 상태에 도달 가능한지 — 고아 상태 검출"""
        seen = {"created"}
        frontier = ["created"]
        while frontier:
            for nxt in get_next_statuses(frontier.pop()):
                if nxt not in seen:
                    seen.add(nxt)
                    frontier.append(nxt)
        assert seen == set(ALL_STATUSES), f"도달 불가: {set(ALL_STATUSES) - seen}"


class TestModuleWorkflows:
    """각 검사가 실제로 밟는 경로가 상태 머신에서 유효한지.

    상태 머신이 자체적으로 일관돼도, 모듈이 실제로 그 경로를 밟지 않으면
    의미가 없다. 여기서 검사별 실제 시퀀스를 표로 남겨 두면 새 검사를
    붙일 때 무엇을 맞춰야 하는지가 드러난다.
    """

    def _walk(self, path: list[str]) -> None:
        """경로를 순서대로 전이 — 하나라도 불가하면 예외"""
        for cur, nxt in zip(path, path[1:]):
            validate_transition(cur, nxt)

    def test_htp_happy_path(self):
        """HTP: 그림 초기화 → AI 분석 → 검토 → 확정 → PDF

        htp/facade.py 의 initialize_drawings / analyze / report PDF 경로.
        분석 중이라는 사실은 status가 아니라 ai_analysis_jobs에 남는다.
        """
        self._walk([
            "created", "in_progress", "ai_draft_ready",
            "under_review", "confirmed", "report_generated",
        ])

    def test_rorschach_happy_path(self):
        """로르샤하: 세션 시작 → 채점 → 코딩 수정 → 확정 → PDF

        주의: '기록 완료'(CompleteSessionService)는 session.ended_at만 남기고
        상태를 바꾸지 않는다. 기록 완료 여부는 progress가 판단한다.
        """
        self._walk([
            "created", "in_progress", "ai_draft_ready",
            "under_review", "confirmed", "report_generated",
        ])

    def test_rorschach_confirm_jumps_two_steps(self):
        """ConfirmSessionService는 ai_draft_ready에서 confirmed까지 2단 점프한다.

        테이블에 직행 경로가 없어 under_review를 경유하도록 구현돼 있다
        (rorschach/services.py). 직행이 여전히 막혀 있는지 고정.
        """
        with pytest.raises(InvalidStateTransitionException):
            validate_transition("ai_draft_ready", "confirmed")
        self._walk(["ai_draft_ready", "under_review", "confirmed"])

    def test_sct_path_is_now_legal(self):
        """SCT가 밟던 경로가 이제 정식 전이다.

        예전에는 in_progress → ai_draft_ready가 불법이라 ScoreSCTService가
        validate_transition을 건너뛰고 직접 대입했다. ai_analyzing이 빠지면서
        그 경로가 상태 머신 안으로 들어왔다 — 우회할 이유가 사라졌다.

        AI 채점이 없는 표준화 검사(MMPI·웩슬러 등)도 같은 경로를 쓴다.
        """
        validate_transition("in_progress", "ai_draft_ready")

    def test_sct_score_from_created_is_illegal(self):
        """created에서 곧바로 채점하면 불법 전이 — 현재 백엔드는 이를 막지 않는다.

        ScoreSCTService에 상태 가드가 없어 응답 없이 채점을 호출하면
        created → ai_draft_ready가 성립해 버린다. 상태 머신은 거부한다.
        """
        with pytest.raises(InvalidStateTransitionException):
            validate_transition("created", "ai_draft_ready")

    def test_report_generated_ends_our_workflow(self):
        """마인드봄의 마지막 상태는 report_generated다.

        예전에는 completed로 가는 전이가 테이블에 있었지만 백엔드에 생산자가
        없었고, 실제로 그 상태를 만드는 것은 HTP 화면의 '검사 완료' 버튼
        하나뿐이었다(로르샤하·SCT엔 없었다). '완료'는 운영 플랫폼이 담당자
        검수로 판정하는 사건이라 우리 축에서 뺐다.
        """
        assert get_next_statuses("report_generated") == []
        assert "completed" not in ALL_STATUSES


class TestStateContract:
    """언어 중립 계약(contracts/exam-state.json)이 상태 머신과 일치하는가.

    프론트는 이 계약을 읽어 같은 검증을 돌린다(core/state-contract.spec.ts).
    양쪽이 같은 표를 통과하면, 서로의 구현을 몰라도 동작이 같음이 보장된다
    — 준동형 f(a∘b) = f(a)∘f(b)를 전수로 확인하는 형태다.

    계약이 낡으면 여기서 죽는다. state_machine.py를 고쳤으면
    `uv run python -m scripts.export_state_contract`로 갱신할 것.
    """

    def test_contract_file_exists(self):
        assert CONTRACT_PATH.exists(), (
            f"계약 파일이 없다: {CONTRACT_PATH}\n"
            "`uv run python -m scripts.export_state_contract` 실행 필요"
        )

    def test_contract_is_current(self):
        """계약이 현재 상태 머신을 그대로 반영하는가 — CI 게이트."""
        from scripts.export_state_contract import build_contract

        assert _contract() == build_contract(), (
            "계약 파일이 낡았다. state_machine.py를 고쳤으면 "
            "`uv run python -m scripts.export_state_contract`로 갱신할 것"
        )

    def test_contract_statuses_match(self):
        assert _contract()["statuses"] == list(ALL_STATUSES)

    def test_contract_confirmed_statuses_match(self):
        assert set(_contract()["confirmed_statuses"]) == set(CONFIRMED_STATUSES)

    def test_contract_covers_all_pairs(self):
        """전수여야 한다 — 빠진 칸이 있으면 '어긋나도 모르게' 지나간다."""
        n = len(ALL_STATUSES)
        assert len(_contract()["transitions"]) == n * n

    def test_contract_transitions_match_engine(self):
        """계약의 49칸이 can_transition과 한 칸도 빠짐없이 일치하는가."""
        for t in _contract()["transitions"]:
            assert can_transition(t["from"], t["to"]) is t["allowed"], (
                f"{t['from']} → {t['to']}: 계약={t['allowed']} "
                f"엔진={can_transition(t['from'], t['to'])}"
            )

    def test_contract_labels_match(self):
        assert _contract()["labels"] == {s: STATUS_LABELS[s] for s in ALL_STATUSES}
