"""pipeline prepare 스텝 characterization — facade→service 추출 전후 동작 보존.

각 스텝의 계약: precondition 거부 · 진행중(완료) 거부 · 정상 전이 시 상태 업데이트 키/값.
메시지 문자열도 계약(모바일이 그대로 노출).
"""
import json
from dataclasses import asdict
from types import SimpleNamespace

import pytest

from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from app.modules.field_note.facade.pipeline_facade import PipelineFacade


class FakeRepo:
    def __init__(
        self,
        note,
    ):
        self._note = note
        self.updates = None

    async def get_in_center(
        self,
        *,
        field_note_id,
        center_id,
    ):
        return self._note

    async def update_in_center(
        self,
        *,
        field_note_id,
        center_id,
        **fields,
    ):
        self.updates = fields
        for k, v in fields.items():
            if v is not unset:
                setattr(self._note, k, v)
        return self._note

    async def list_by_field_note(
        self,
        *,
        field_note_id,
    ):
        return []


class FakeUow:
    def __init__(
        self,
        repo,
    ):
        self._repo = repo

    def repo(self, cls):
        return self._repo


def make_note(**overrides):
    note = SimpleNamespace(
        id="fn-1",
        center_id="c-1",
        schedule_id="sch-1",
        task_id=None,
        status="completed",
        total_duration=120.0,
        processing_status="none",
        processing_step=None,
        failed_step=None,
        transcribe_status="completed",
        refine_status="none",
        summary_status="none",
        diarization_status="none",
        note_status="none",
        note_template_type=None,
        summary=None,
        nonverbal_markers=None,
        refined_transcript=json.dumps(
            [{"speaker": "A", "text": "안녕하세요", "start": 0, "end": 1}]
        ),
    )
    for k, v in overrides.items():
        setattr(note, k, v)
    return note


def build(note):
    repo = FakeRepo(note)
    return PipelineFacade(FakeUow(repo)), repo


async def call_prepare(
    facade,
    step,
    **kw,
):
    _atomic, result = await facade.prepare_step("fn-1", "c-1", step=step, **kw)
    return asdict(result)


PRECONDITION_CASES = [
    ("transcribe", {"status": "recording"}, "녹음이 완료된 필드노트만 전사할 수 있습니다."),
    ("refine", {"transcribe_status": "none"}, "전사가 완료된 필드노트만 보정할 수 있습니다."),
    ("summary", {"status": "recording"}, "녹음이 완료된 필드노트만 요약할 수 있습니다."),
    ("summary", {"transcribe_status": "none"}, "전사가 완료된 필드노트만 요약할 수 있습니다."),
    ("diarize", {"transcribe_status": "none"}, "전사가 완료된 필드노트만 화자분리할 수 있습니다."),
    ("counseling_note", {"status": "recording"}, "녹음이 완료된 필드노트만 상담일지를 생성할 수 있습니다."),
    ("counseling_note", {"schedule_id": None}, "일정에 연결된 필드노트만 상담일지를 생성할 수 있습니다."),
    ("counseling_note", {"transcribe_status": "none"}, "전사가 완료된 필드노트만 상담일지를 생성할 수 있습니다."),
]


@pytest.mark.parametrize("step,overrides,message", PRECONDITION_CASES)
async def test_precondition_rejected_without_update(
    step,
    overrides,
    message,
):
    facade, repo = build(make_note(**overrides))

    result = await call_prepare(facade, step)

    assert result["status"] == "precondition_not_met"
    assert result["step"] == step
    assert result["message"] == message
    assert repo.updates is None


BUSY_CASES = [
    ("transcribe", {"transcribe_status": "processing"}, "already_processing", "이미 전사가 진행 중입니다."),
    ("refine", {"refine_status": "processing"}, "already_processing", "이미 보정이 진행 중입니다."),
    ("summary", {"summary_status": "generating"}, "already_processing", "이미 요약이 진행 중입니다."),
    ("diarize", {"diarization_status": "completed"}, "already_done", "이미 화자분리가 완료되었습니다."),
    ("diarize", {"diarization_status": "processing"}, "already_processing", "이미 화자분리가 진행 중입니다."),
    ("counseling_note", {"note_status": "processing"}, "already_processing", "이미 상담일지 생성이 진행 중입니다."),
]


@pytest.mark.parametrize("step,overrides,status,message", BUSY_CASES)
async def test_busy_rejected_without_update(
    step,
    overrides,
    status,
    message,
):
    facade, repo = build(make_note(**overrides))

    result = await call_prepare(facade, step)

    assert result["status"] == status
    assert result["message"] == message
    assert repo.updates is None


STARTED_CASES = [
    (
        "transcribe",
        "음성 전사를 시작합니다.",
        {"transcribe_status": "processing", "processing_status": "processing", "processing_step": "transcribing"},
    ),
    ("refine", "LLM 전사 보정을 시작합니다.", {"refine_status": "processing"}),
    ("summary", "AI 요약 생성을 시작합니다.", {"summary_status": "generating"}),
    ("diarize", "화자분리를 시작합니다.", {"diarization_status": "processing"}),
]


@pytest.mark.parametrize("step,message,expected_updates", STARTED_CASES)
async def test_started_transitions_state(
    step,
    message,
    expected_updates,
):
    facade, repo = build(make_note())

    result = await call_prepare(facade, step)

    assert result["status"] == "started"
    assert result["step"] == step
    assert result["field_note_id"] == "fn-1"
    assert result["message"] == message
    assert repo.updates == expected_updates


async def test_note_started_without_template_keeps_existing():
    facade, repo = build(make_note())

    result = await call_prepare(facade, "counseling_note")

    assert result["status"] == "started"
    assert result["message"] == "상담일지 생성을 시작합니다."
    assert repo.updates["note_status"] == "processing"
    assert repo.updates["note_template_type"] is unset


async def test_note_started_with_valid_template():
    facade, repo = build(make_note())

    result = await call_prepare(facade, "counseling_note", note_template_type="soap")

    assert result["status"] == "started"
    assert repo.updates["note_template_type"] == "soap"


async def test_note_invalid_template_raises():
    facade, repo = build(make_note())

    with pytest.raises(InvalidOperationException):
        await call_prepare(facade, "counseling_note", note_template_type="nope")

    assert repo.updates is None
