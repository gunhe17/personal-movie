# 판정 #9 — 파이프라인 status enum 사슬이 워커 쓰기 경로(runner→facade→repo typecheck→DB)에서
# DevelopError 없이 관통되는지 + failed_step 어휘 통일·legacy 값 관용을 실 DB로 검증.
from sqlalchemy import text

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.field_note.field_note.repository import FieldNoteRepository
from app.modules.field_note.field_note.services.retry_pipeline import RetryPipelineService
from app.runtime.field_note.executor import _TRANSCRIBE
from app.runtime.field_note.runner import PipelineRunner

CENTER_ID = "11111111-1111-1111-1111-111111111111"
MEMBER_ID = "22222222-2222-2222-2222-222222222222"


async def _create_note(test_session):
    uow = UnitOfWork(test_session)
    async with uow:
        note = await uow.repo(FieldNoteRepository).add(
            center_id=CENTER_ID,
            author_id=MEMBER_ID,
        )
        await uow.commit()
    return note.id


def _session_factory(test_engine):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    return async_sessionmaker(test_engine, expire_on_commit=False)


async def test_runner_success_marks_completed_and_idle(
    test_engine,
    test_session,
):
    note_id = await _create_note(test_session)
    runner = PipelineRunner(_session_factory(test_engine))

    async def ok(uow):
        return {"text": "x"}

    result = await runner.run_step(note_id, CENTER_ID, _TRANSCRIBE, ok)

    assert result == {"text": "x"}
    row = (await test_session.execute(
        text("SELECT transcribe_status, processing_status FROM field_notes WHERE id = :id"),
        {"id": note_id},
    )).one()
    assert row.transcribe_status == "completed"
    assert row.processing_status == "idle"


async def test_runner_failure_marks_failed_with_unified_step_vocab(
    test_engine,
    test_session,
):
    note_id = await _create_note(test_session)
    runner = PipelineRunner(_session_factory(test_engine))

    async def boom(uow):
        raise RuntimeError("stt down")

    result = await runner.run_step(note_id, CENTER_ID, _TRANSCRIBE, boom)

    assert result is None
    row = (await test_session.execute(
        text("SELECT transcribe_status, processing_status, failed_step FROM field_notes WHERE id = :id"),
        {"id": note_id},
    )).one()
    assert row.transcribe_status == "failed"
    assert row.processing_status == "failed"
    # 어휘 통일: 과거 파생값 "transcribe"가 아니라 processing_step과 같은 "transcribing"
    assert row.failed_step == "transcribing"


async def test_retry_coerces_legacy_failed_step(test_session):
    note_id = await _create_note(test_session)
    # 어휘 통일 전 legacy 행 재현 — enum 사슬 밖(raw)으로 심는다
    await test_session.execute(
        text("UPDATE field_notes SET processing_status='failed', failed_step='transcribe' WHERE id = :id"),
        {"id": note_id},
    )
    await test_session.commit()

    uow = UnitOfWork(test_session)
    async with uow:
        _atomic, note, start_from = await RetryPipelineService(uow.repo(FieldNoteRepository)).execute(
            field_note_id=note_id,
            center_id=CENTER_ID,
        )
        await uow.commit()

    assert start_from == "transcribing"
    assert note.processing_step == "transcribing"
    assert note.failed_step is None
    assert note.processing_status == "processing"
