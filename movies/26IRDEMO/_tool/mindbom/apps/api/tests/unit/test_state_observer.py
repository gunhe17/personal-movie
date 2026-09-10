"""4층 방어 — 계약 밖 status의 런타임 관측.

DB의 status는 String(30)이고 enum 제약이 없다. 코드를 거치지 않고 들어온
값(과거 버전·마이그레이션·수기 수정)은 1~3층 방어가 보지 못한다.
"""
from unittest.mock import AsyncMock

import pytest

from app.modules.examination.common.state_machine import ALL_STATUSES
from app.modules.examination.common.state_observer import (
    AUDIT_ACTION,
    KNOWN_LEGACY_STATUSES,
    is_contract_status,
    observe_status,
    reset_reported_cache,
    scan_statuses,
)


def _repo() -> AsyncMock:
    repo = AsyncMock()
    repo.create = AsyncMock(return_value=None)
    return repo


def _payload(repo: AsyncMock) -> dict:
    return repo.create.call_args.args[0]


class TestContractPredicate:
    @pytest.mark.parametrize("status", ALL_STATUSES)
    def test_contract_statuses_pass(self, status):
        assert is_contract_status(status) is True

    def test_completed_is_outside_the_contract(self):
        """상태 머신에서 뺐으므로 계약 밖이다 — 그런데 DB엔 남아 있을 수 있다."""
        assert is_contract_status("completed") is False

    def test_unknown_string_is_outside(self):
        assert is_contract_status("좋아보이는아무값") is False

    def test_legacy_set_is_derived_not_hardcoded(self):
        """레거시 목록을 손으로 적지 않는다 — CONFIRMED_STATUSES에서 유도한다.

        두 곳에 적으면 하나만 고쳐도 모르게 지나간다.
        """
        assert "completed" in KNOWN_LEGACY_STATUSES
        assert KNOWN_LEGACY_STATUSES.isdisjoint(ALL_STATUSES)


class TestObserve:
    def setup_method(self):
        reset_reported_cache()

    async def test_contract_status_is_silent(self):
        """정상 값에는 아무 기록도 남기지 않는다 — 로그가 잡음이 되면 안 된다."""
        repo = _repo()
        violated = await observe_status(
            "confirmed", examination_id="e1", institution_id="i1", repo=repo
        )
        assert violated is False
        repo.create.assert_not_called()

    async def test_legacy_status_is_recorded(self):
        repo = _repo()
        violated = await observe_status(
            "completed", examination_id="e1", institution_id="i1", repo=repo
        )
        assert violated is True
        repo.create.assert_called_once()

        payload = _payload(repo)
        assert payload["action"] == AUDIT_ACTION
        assert payload["entity_type"] == "examination"
        assert payload["entity_id"] == "e1"
        assert payload["institution_id"] == "i1"
        assert "completed" in payload["metadata_json"]
        assert "legacy" in payload["metadata_json"]

    async def test_unknown_status_is_marked_differently(self):
        """아는 레거시와 모르는 값을 구분한다 — 대응이 다르다."""
        repo = _repo()
        await observe_status(
            "웬값", examination_id="e1", institution_id="i1", repo=repo
        )
        assert "unknown" in _payload(repo)["metadata_json"]

    async def test_never_raises(self):
        """관측이 조회를 죽이면 안 된다 — 임상 기록 접근이 막히는 편이 더 나쁘다."""
        repo = _repo()
        # 예외가 나면 이 테스트가 실패한다
        await observe_status(
            "완전히모르는값", examination_id="e1", institution_id=None, repo=repo
        )

    async def test_works_without_repo(self):
        """repo 없이도 동작한다 — 앱 로그에만 남기는 경로."""
        violated = await observe_status(
            "completed", examination_id="e1", institution_id="i1"
        )
        assert violated is True

    async def test_actor_is_system_not_a_person(self):
        """사람이 한 일이 아님이 감사 로그에 드러나야 한다."""
        repo = _repo()
        await observe_status(
            "completed", examination_id="e1", institution_id="i1", repo=repo
        )
        payload = _payload(repo)
        assert payload["actor_id"] is None
        assert payload["actor_role"] is None
        assert "system" in payload["actor_email"]


class TestDeduplication:
    def setup_method(self):
        reset_reported_cache()

    async def test_same_status_logged_once(self):
        """목록 조회 한 번에 같은 값이 수십 건 나와도 로그는 한 줄이다."""
        repo = _repo()
        for i in range(50):
            violated = await observe_status(
                "completed",
                examination_id=f"e{i}",
                institution_id="i1",
                repo=repo,
            )
            assert violated is True, "억제돼도 위반 판정 자체는 유지돼야 한다"
        repo.create.assert_called_once()

    async def test_different_institutions_are_separate(self):
        """기관이 다르면 별개 사건이다 — 한쪽 기관 로그가 다른 쪽을 가리면 안 된다."""
        repo = _repo()
        await observe_status(
            "completed", examination_id="e1", institution_id="i1", repo=repo
        )
        await observe_status(
            "completed", examination_id="e2", institution_id="i2", repo=repo
        )
        assert repo.create.call_count == 2

    async def test_different_statuses_are_separate(self):
        repo = _repo()
        await observe_status(
            "completed", examination_id="e1", institution_id="i1", repo=repo
        )
        await observe_status(
            "이상한값", examination_id="e2", institution_id="i1", repo=repo
        )
        assert repo.create.call_count == 2


class TestScan:
    def test_counts_only_violations(self):
        statuses = ["confirmed", "completed", "completed", "created", "웬값"]
        assert scan_statuses(statuses) == {"completed": 2, "웬값": 1}

    def test_clean_list_is_empty(self):
        assert scan_statuses(list(ALL_STATUSES)) == {}

    def test_empty_input(self):
        assert scan_statuses([]) == {}
