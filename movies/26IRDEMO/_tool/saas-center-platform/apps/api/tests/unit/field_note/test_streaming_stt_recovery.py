"""AWS Transcribe 스트리밍 STT 복구 동작 테스트.

핵심 불변식:
- AWS 15초 무음 타임아웃(BadRequestException)은 세션을 죽이지 않고 재연결한다.
- 재연결 시 사용자에게 오류(전사 라인 포함)를 노출하지 않는다.
- 복구 불가 오류만 is_error=True 응답으로 전달한다 (전사 라인 아님).

배경: AWS Transcribe Streaming 은 15초간 오디오가 없으면 스트림을 종료한다.
일시정지·백그라운드·무음 구간에서 흔히 발생하며, 과거에는 "[STT_ERROR] ..."
문자열이 final 전사 결과로 노트에 렌더되고 세션이 영구 종료됐다.
"""
import asyncio

import pytest

from app.infrastructure.stt.aws.session import AWSTranscribeSession


# 타입 이름으로 판별하므로(_is_recoverable_timeout) 이름을 그대로 맞춘다.
class BadRequestException(Exception):
    pass


def _make_session() -> AWSTranscribeSession:
    return AWSTranscribeSession(region="r", access_key="k", secret_key="s")


async def test_idle_timeout_reconnects_without_error():
    """15초 무음 타임아웃 → 새 스트림으로 재연결, 오류 노출 없음."""
    session = _make_session()
    calls: list[bytes] = []

    async def fake_single(first_chunk: bytes) -> None:
        calls.append(first_chunk)
        if len(calls) == 1:
            # 1차 스트림: AWS 무음 타임아웃 시뮬레이션
            raise BadRequestException(
                "Your request timed out because no new audio "
                "was received for 15 seconds."
            )
        # 2차 스트림(재연결): finish 센티널까지 큐 소진
        while True:
            data = await session._audio_queue.get()
            if data is None:
                return

    session._run_single_stream = fake_single  # type: ignore[assignment]

    await session.feed_audio(b"chunk-1")  # _run_stream 시작 → 1차 → 타임아웃 → 재연결 대기
    await asyncio.sleep(0)  # _run_stream 이 재연결 대기 지점에 도달하도록 양보
    await session.feed_audio(b"chunk-2")  # 2차 스트림 시작
    remaining = await session.finish()  # None 센티널 → 2차 정상 종료

    assert len(calls) == 2, "무음 타임아웃 시 재연결되어야 한다"
    assert all(not r.is_error for r in remaining), "재연결은 오류를 노출하지 않는다"


async def test_fatal_error_emits_error_response_not_transcript():
    """복구 불가 오류 → is_error=True 응답 (전사 라인 아님)."""
    session = _make_session()

    async def fake_single(first_chunk: bytes) -> None:
        # 비-timeout BadRequestException 은 복구 불가(fatal)로 분류된다(_is_fatal).
        raise BadRequestException("boom")

    session._run_single_stream = fake_single  # type: ignore[assignment]

    await session.feed_audio(b"chunk-1")

    responses = [r async for r in session.get_responses()]

    assert len(responses) == 1
    assert responses[0].is_error is True
    assert "boom" in responses[0].text
    assert not responses[0].text.startswith("[STT_ERROR]")


async def test_recoverable_timeout_classifier():
    """무음 타임아웃만 복구 대상으로 분류한다."""
    assert AWSTranscribeSession._is_recoverable_timeout(
        BadRequestException("...no new audio was received for 15 seconds.")
    )
    # 다른 BadRequestException 은 복구 대상이 아니다 (치명적 처리)
    assert not AWSTranscribeSession._is_recoverable_timeout(
        BadRequestException("Invalid sample rate")
    )
    # 타입이 다르면 복구 대상 아님
    assert not AWSTranscribeSession._is_recoverable_timeout(RuntimeError("timed out"))
