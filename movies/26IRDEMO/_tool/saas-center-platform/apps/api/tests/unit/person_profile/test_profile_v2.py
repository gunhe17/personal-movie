import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.application.handlers.person_profile.build_profile_snapshot import _display_anchor as display_anchor
from app.application.handlers.person_profile.analyze_usage import (
    _compute_defaults as compute_defaults,
    _refine_narrative as refine_narrative,
)
from app.application.handlers.person_profile.analyze_profile_if_stale import _is_stale
from app.core.datetime_utils import utc_now
from app.runtime.assistant.context import _profile_lines


# #
# anchors — payload 평문에서 표시명 추출

def test_display_anchor_variants():
    assert display_anchor("client", {"data": {"name": "김민준"}}) == "김민준(내담자)"
    # 내담자·직원은 id 동반 (zero-hop — query 필터 client_id/member_id에 직결)
    assert (
        display_anchor("client", {"data": {"name": "김민준", "id": "u-1"}})
        == "김민준(내담자, client_id: u-1)"
    )
    assert (
        display_anchor("member", {"data": {"name": "박지은", "id": "u-2"}})
        == "박지은(직원, member_id: u-2)"
    )
    assert (
        display_anchor("schedule", {"input": {"x": 1}, "result": {"title": "심리검사"}})
        == "심리검사(일정)"
    )
    assert (
        display_anchor("counseling_case", {"data": {"case_code": "C01004"}})
        == "C01004(상담 케이스)"
    )
    # 미등록 엔티티는 entity_name fallback
    assert display_anchor("voucher", {"data": {"name": "A"}}) == "A(voucher)"


def test_display_anchor_skips_unextractable():
    assert display_anchor("client", {}) is None
    assert display_anchor("client", {"data": {"memo": "x"}}) is None
    assert display_anchor("client", {"data": "not-a-dict"}) is None
    assert display_anchor("client", {"data": {"name": 123}}) is None
    # 무명 엔티티의 저신뢰 필드(생성일 등)로 지어내지 않는다
    assert display_anchor("counseling_session", {"data": {"status": "completed"}}) is None


def test_display_anchor_fallbacks():
    assert display_anchor("field_note", {"data": {"note_number": 12}}) == "#12(필드노트)"
    assert (
        display_anchor("schedule", {"data": {"start": "2026-07-10T01:00:00", "title": None}})
        == "7/10 01:00(일정)"
    )
    assert display_anchor("schedule", {"data": {"start": "garbage"}}) is None
    # title 있으면 title 우선
    assert (
        display_anchor("schedule", {"data": {"start": "2026-07-10T01:00:00", "title": "C00004 - 1회기"}})
        == "C00004 - 1회기(일정)"
    )


# #
# stale 판정

def test_is_stale():
    assert _is_stale(None, 7) is True
    assert _is_stale(utc_now() - timedelta(days=8), 7) is True
    assert _is_stale(utc_now() - timedelta(days=1), 7) is False


# #
# refine — 어떤 실패도 raise하지 않는다 (소프트 처리)

async def _run_refine(facade):
    with patch(
        "app.application.handlers.person_profile.analyze_usage.create_ai_facade",
        return_value=facade,
    ):
        return await refine_narrative(
            center_id="c1",
            member_id="m1",
            previous=None,
            aggregates={"top_features": []},
            window_days=90,
        )


async def test_refine_parses_valid_json():
    facade = MagicMock()
    facade.generate_json = AsyncMock(
        return_value=SimpleNamespace(
            content=json.dumps({"summary": "오전 집중형.", "focus": ["일정", "노트", "검사", "잉여"]})
        )
    )
    result = await _run_refine(facade)
    assert result["summary"] == "오전 집중형."
    assert result["focus"] == ["일정", "노트", "검사"]  # 최대 3개 절단


async def test_refine_soft_on_refusal_like_empty_content():
    # background 거부 = 200 + 빈 content — 예외가 아니라 빈 산출로 온다
    facade = MagicMock()
    facade.generate_json = AsyncMock(return_value=SimpleNamespace(content=""))
    assert await _run_refine(facade) == {}


async def test_refine_soft_on_gateway_error():
    facade = MagicMock()
    facade.generate_json = AsyncMock(side_effect=RuntimeError("quota"))
    assert await _run_refine(facade) == {}


async def test_refine_soft_on_empty_summary():
    facade = MagicMock()
    facade.generate_json = AsyncMock(
        return_value=SimpleNamespace(content=json.dumps({"summary": "", "focus": ["x"]}))
    )
    assert await _run_refine(facade) == {}


# #
# defaults — 항목별 독립 실패

async def _run_defaults(
    schedule_facade,
    case_facade,
    room_facade,
    program_facade,
):
    base = "app.application.handlers.person_profile.analyze_usage"
    with (
        patch(f"{base}.ScheduleFacade", return_value=schedule_facade),
        patch(f"{base}.CounselingCaseFacade", return_value=case_facade),
        patch(f"{base}.RoomFacade", return_value=room_facade),
        patch(f"{base}.ProgramFacade", return_value=program_facade),
    ):
        return await compute_defaults(
            MagicMock(), center_id="c1", member_id="m1", since=utc_now()
        )


async def test_defaults_full():
    schedule = MagicMock()
    schedule.aggregate_usual_schedule = AsyncMock(return_value=("r1", 60))
    case = MagicMock()
    case.aggregate_top_program = AsyncMock(return_value="p1")
    room = MagicMock()
    room.get_rooms_by_ids = AsyncMock(
        return_value={"r1": SimpleNamespace(id="r1", name="상담실A")}
    )
    program = MagicMock()
    program.find_program = AsyncMock(return_value=SimpleNamespace(id="p1", name="개인상담"))

    d = await _run_defaults(schedule, case, room, program)
    assert d == {
        "usual_room": {"id": "r1", "name": "상담실A"},
        "usual_duration_min": 60,
        "usual_program": {"id": "p1", "name": "개인상담"},
    }


async def test_defaults_partial_failure_isolated():
    schedule = MagicMock()
    schedule.aggregate_usual_schedule = AsyncMock(side_effect=RuntimeError("db"))
    case = MagicMock()
    case.aggregate_top_program = AsyncMock(return_value="p1")
    program = MagicMock()
    program.find_program = AsyncMock(return_value=SimpleNamespace(id="p1", name="개인상담"))

    d = await _run_defaults(schedule, case, MagicMock(), program)
    assert d["usual_room"] is None and d["usual_duration_min"] is None
    assert d["usual_program"] == {"id": "p1", "name": "개인상담"}


async def test_defaults_empty_data():
    schedule = MagicMock()
    schedule.aggregate_usual_schedule = AsyncMock(return_value=(None, None))
    case = MagicMock()
    case.aggregate_top_program = AsyncMock(return_value=None)

    d = await _run_defaults(schedule, case, MagicMock(), MagicMock())
    assert d == {"usual_room": None, "usual_duration_min": None, "usual_program": None}


# #
# 주입 라인 — 전 라인 조건부 + 예산 절단

def _snapshot(**kw):
    base = dict(recent_interactions=[], narrative=None, defaults=None)
    base.update(kw)
    return SimpleNamespace(**base)


def test_profile_lines_full():
    lines = _profile_lines(_snapshot(
        recent_interactions=["김민준(내담자)", "C01004(상담 케이스)"],
        narrative={"summary": "오전 집중형.", "focus": ["일정 관리"]},
        defaults={
            "usual_room": {"id": "r", "name": "상담실A"},
            "usual_duration_min": 60,
            "usual_program": {"id": "p", "name": "개인상담"},
        },
    ))
    assert lines == [
        "최근 작업: 김민준(내담자) · C01004(상담 케이스)",
        "업무 패턴: 오전 집중형. (주: 일정 관리)",
        "자주 쓰는 값: 상담실A · 60분 · 개인상담",
    ]


def test_profile_lines_all_conditional():
    assert _profile_lines(_snapshot()) == []
    assert _profile_lines(_snapshot(narrative={"summary": ""})) == []


def test_profile_lines_budget_drops_narrative_first():
    lines = _profile_lines(_snapshot(
        recent_interactions=["a(내담자)"],
        narrative={"summary": "가" * 700, "focus": []},
        defaults={"usual_room": None, "usual_duration_min": 50, "usual_program": None},
    ))
    assert all(not x.startswith("업무 패턴") for x in lines)
    assert any(x.startswith("최근 작업") for x in lines)
    assert any(x.startswith("자주 쓰는 값") for x in lines)
