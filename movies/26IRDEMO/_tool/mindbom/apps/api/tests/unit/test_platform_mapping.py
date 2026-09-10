"""마인드봄 → 마인드스코프 사상표 검증.

이 표는 회의 합의 전 초안이지만, 초안이라도 **내부적으로 모순이 없어야**
한다. 여기서 검사하는 것은 "합의가 맞나"가 아니라 "우리가 적은 것이 우리
상태 머신과 어긋나지 않나"다.
"""
import json
from functools import cache
from pathlib import Path

import pytest

from app.modules.examination.common.platform_mapping import (
    EVENT_MAP,
    EVENT_NOTES,
    NON_TRANSITION_EVENTS,
    PLATFORM_EVENTS,
    PLATFORM_STATUSES,
    PLATFORM_TERMINAL_STATUSES,
    STATUS_MAP,
    UNMAPPED_PLATFORM_STATUSES,
    build_mapping_contract,
    check_homomorphism,
    map_status,
)
from app.modules.examination.common.state_machine import (
    ALL_STATUSES,
    VALID_TRANSITIONS,
)

CONTRACT_PATH = (
    Path(__file__).resolve().parents[4] / "contracts" / "exam-state.json"
)


@cache
def _contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


class TestHomomorphism:
    """f가 전이를 보존하는가 — 준동형의 본체."""

    def test_no_violations(self):
        """현재 사상표는 준동형 조건을 만족한다."""
        violations = check_homomorphism(VALID_TRANSITIONS)
        assert violations == [], "\n".join(violations)

    def test_domain_covers_all_our_statuses(self):
        """f의 정의역이 우리 상태 6종을 빠짐없이 덮는가.

        하나라도 비면 그 상태의 검사는 플랫폼에 뭐라고 보낼지 알 수 없다.
        """
        assert set(STATUS_MAP) == set(ALL_STATUSES)

    def test_codomain_within_platform_statuses(self):
        """f의 치역이 플랫폼에 실재하는 상태인가."""
        assert set(STATUS_MAP.values()) <= set(PLATFORM_STATUSES)

    def test_completed_is_not_a_target(self):
        """report_generated를 플랫폼 completed로 보내면 안 된다.

        플랫폼 completed는 담당자 검수로만 도달한다. 자동 매핑하면 사람의
        검수가 조용히 사라진다 — 감사추적 구멍이자 준동형 위반.
        """
        assert "completed" not in STATUS_MAP.values()
        assert map_status("report_generated") == "submitted"

    def test_detects_the_documented_mistake(self):
        """문서가 경고한 실수(ai_draft_ready·under_review → submitted)를 잡는가.

        검증기가 아무것도 못 잡으면 통과해도 의미가 없다. 일부러 틀린 표를
        먹여 위반이 실제로 보고되는지 확인한다.
        """
        broken = dict(STATUS_MAP)
        broken["ai_draft_ready"] = "submitted"
        broken["under_review"] = "submitted"

        import app.modules.examination.common.platform_mapping as pm

        original = dict(pm.STATUS_MAP)
        try:
            pm.STATUS_MAP.clear()
            pm.STATUS_MAP.update(broken)
            violations = pm.check_homomorphism(VALID_TRANSITIONS)
        finally:
            pm.STATUS_MAP.clear()
            pm.STATUS_MAP.update(original)

        assert violations, "틀린 사상표인데 위반이 하나도 안 나왔다"

    def test_backward_transitions_stay_inside_the_fold(self):
        """재분석 역전이가 접힘 안에 갇히는가 — 4구간 접기가 안전한 근거.

        ai_draft_ready → in_progress 같은 역전이는 플랫폼에서 표현할 수단이
        없다. 다만 양끝이 같은 상태로 접히면 플랫폼은 아무 일도 없었던
        것으로 보므로 어긋나지 않는다. 접힘 밖으로 나가면 그때 문제가 된다.
        """
        backward = [
            ("ai_draft_ready", "in_progress"),
            ("under_review", "in_progress"),
        ]
        for src, dst in backward:
            assert dst in VALID_TRANSITIONS[src], f"{src} → {dst} 전제가 깨졌다"
            assert map_status(src) == map_status(dst), (
                f"{src} → {dst}: 역전이가 접힘 밖으로 나갔다"
            )


class TestEventMapping:
    """플랫폼 이벤트 10종 사상."""

    def test_all_ten_events_are_decided(self):
        """10종 전부에 판단이 적혀 있는가 — 빈칸은 '아직 안 봤다'와 구분 불가."""
        assert set(EVENT_MAP) == set(PLATFORM_EVENTS)
        assert len(PLATFORM_EVENTS) == 10

    def test_every_event_has_a_note(self):
        """대응이 없는 이벤트는 왜 없는지가 적혀 있어야 한다."""
        assert set(EVENT_NOTES) == set(PLATFORM_EVENTS)
        for event, note in EVENT_NOTES.items():
            assert note.strip(), f"{event}: 설명이 비었다"

    @pytest.mark.parametrize("event", sorted(NON_TRANSITION_EVENTS))
    def test_non_transition_events_map_to_nothing(self, event):
        """updated·deleted는 status를 안 바꾸므로 전이 사상의 정의역 밖이다.

        플랫폼 발행 서비스 실측 결과다 — updated는 changed dict만 싣고,
        deleted는 soft delete다. 문서는 10종을 일괄로 '전이'라 부르지만
        코드가 그렇지 않다.
        """
        assert EVENT_MAP[event] is None

    def test_mapped_events_point_at_real_transitions(self):
        """대응이 있는 이벤트는 실제로 허용된 우리 전이를 가리켜야 한다."""
        for event, pair in EVENT_MAP.items():
            if pair is None:
                continue
            src, dst = pair
            if src == "__none__":
                assert dst in ALL_STATUSES, f"{event}: {dst}는 우리 상태가 아니다"
                continue
            assert dst in VALID_TRANSITIONS.get(src, []), (
                f"{event}: {src} → {dst}는 우리 전이 맵에 없다"
            )

    def test_revert_events_are_unmappable_by_construction(self):
        """reverted·cancel_reverted는 정적 전이 맵으로 표현 불가능하다.

        목적지가 고정값이 아니라 process['previous_status']에 저장된 값이라
        우리 VALID_TRANSITIONS(정적 dict)에는 대응물이 있을 수 없다.
        """
        for event in ("reverted", "cancel_reverted"):
            assert EVENT_MAP[event] is None
            assert "previous_status" in EVENT_NOTES[event]


class TestGaps:
    """대응하지 않는 것들이 명시돼 있는가."""

    def test_unmapped_platform_statuses_are_explained(self):
        """f의 치역 밖 플랫폼 상태 전부에 이유가 적혀 있는가."""
        uncovered = set(PLATFORM_STATUSES) - set(STATUS_MAP.values())
        assert set(UNMAPPED_PLATFORM_STATUSES) == uncovered
        for status, reason in UNMAPPED_PLATFORM_STATUSES.items():
            assert reason.strip(), f"{status}: 이유가 비었다"

    def test_refuse_cancel_are_recorded_as_gaps(self):
        """refused·cancelled는 우리 쪽에 없다는 사실이 표에 남아 있어야 한다.

        회의 안건이라 지금 해결할 수 없지만, 기록이 없으면 '검토했는데
        없는 것'과 '빠뜨린 것'을 구분할 수 없다.
        """
        assert "refused" in UNMAPPED_PLATFORM_STATUSES
        assert "cancelled" in UNMAPPED_PLATFORM_STATUSES

    def test_terminal_statuses_are_unmapped(self):
        """플랫폼 종료 상태 3종은 전부 우리 사상 밖이다.

        우리 축은 report_generated(→ submitted)에서 끝나므로, 그 뒤의
        종료 판정은 전부 플랫폼 소관이어야 한다.
        """
        assert PLATFORM_TERMINAL_STATUSES <= set(UNMAPPED_PLATFORM_STATUSES)


class TestMappingContract:
    """계약 파일에 사상표가 실려 나가는가."""

    def test_contract_has_mapping(self):
        assert "platform_mapping" in _contract()

    def test_contract_mapping_is_current(self):
        """계약이 낡으면 여기서 죽는다 — export_state_contract 재실행 필요."""
        assert _contract()["platform_mapping"] == build_mapping_contract()

    def test_contract_event_map_is_json_safe(self):
        """튜플이 JSON에서 {from, to} 객체로 나가는가."""
        event_map = _contract()["platform_mapping"]["event_map"]
        assert event_map["started"] == {"from": "created", "to": "in_progress"}
        assert event_map["updated"] is None
