import asyncio
from typing import AsyncIterator

from app.core.logger import get_logger
from app.infrastructure.stt.common.schemas import STTResponse

logger = get_logger(__name__)


class AWSTranscribeSession:
    def __init__(
        self,
        *,
        region: str,
        access_key: str,
        secret_key: str,
        language_code: str = "ko-KR",
        sample_rate: int = 16000,
    ):
        self._region = region
        self._access_key = access_key
        self._secret_key = secret_key
        self._language_code = language_code
        self._sample_rate = sample_rate

        self._response_queue: asyncio.Queue[STTResponse | None] = asyncio.Queue()
        self._audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._stream_task: asyncio.Task | None = None
        self._closed = False
        self._paused = False
        self._elapsed_seconds: float = 0.0

    @staticmethod
    def _is_recoverable_timeout(exc: BaseException) -> bool:
        if type(exc).__name__ != "BadRequestException":
            return False
        msg = str(exc).lower()
        return "timed out" in msg or "no new audio" in msg

    _MAX_RECONNECTS = 10

    @staticmethod
    def _is_fatal(exc: BaseException) -> bool:
        name = type(exc).__name__
        msg = str(exc).lower()
        if name == "BadRequestException":
            return not ("timed out" in msg or "no new audio" in msg)
        if name in ("AccessDeniedException", "ResourceNotFoundException"):
            return True
        fatal_markers = (
            "accessdenied", "forbidden", "unrecognizedclient", "invalidsignature",
            "not authorized", "expiredtoken", "credential",
        )
        return any(m in msg for m in fatal_markers)

    async def _run_stream(self) -> None:
        consecutive_failures = 0
        try:
            while not self._closed:
                first_chunk = await self._audio_queue.get()
                if first_chunk is None:
                    break
                try:
                    await self._run_single_stream(first_chunk)
                    consecutive_failures = 0
                except Exception as e:
                    if self._closed:
                        break
                    if self._is_recoverable_timeout(e):
                        consecutive_failures = 0
                        logger.warning(f"AWS Transcribe idle timeout — 재연결: {e}")
                        continue
                    if self._is_fatal(e):
                        logger.error(f"AWS Transcribe fatal error: {e}", exc_info=True)
                        await self._response_queue.put(STTResponse(
                            text=f"{type(e).__name__}: {e}", is_final=True, is_error=True,
                        ))
                        break
                    consecutive_failures += 1
                    if consecutive_failures > self._MAX_RECONNECTS:
                        logger.error(
                            f"AWS Transcribe — {self._MAX_RECONNECTS}회 연속 재연결 실패, 종료: {e}",
                            exc_info=True,
                        )
                        await self._response_queue.put(STTResponse(
                            text=f"{type(e).__name__}: {e}", is_final=True, is_error=True,
                        ))
                        break
                    logger.warning(
                        f"AWS Transcribe transient error — 재연결"
                        f"({consecutive_failures}/{self._MAX_RECONNECTS}): {e}"
                    )
                    continue
        finally:
            await self._response_queue.put(None)

    async def _run_single_stream(self, first_chunk: bytes) -> None:
        from amazon_transcribe.client import TranscribeStreamingClient
        from amazon_transcribe.auth import StaticCredentialResolver
        from amazon_transcribe.handlers import TranscriptResultStreamHandler
        from amazon_transcribe.model import TranscriptEvent

        stream_offset = self._elapsed_seconds

        credential_resolver = StaticCredentialResolver(
            access_key_id=self._access_key,
            secret_access_key=self._secret_key,
        )
        client = TranscribeStreamingClient(
            region=self._region,
            credential_resolver=credential_resolver,
        )

        stream = await client.start_stream_transcription(
            language_code=self._language_code,
            media_sample_rate_hz=self._sample_rate,
            media_encoding="pcm",
            enable_partial_results_stabilization=True,
            partial_results_stability="medium",
        )

        async def _write_audio():
            data: bytes | None = first_chunk
            while True:
                if data is None:
                    await stream.input_stream.end_stream()
                    break
                if not self._paused:
                    await stream.input_stream.send_audio_event(audio_chunk=data)
                    self._elapsed_seconds += len(data) / (self._sample_rate * 2)
                data = await self._audio_queue.get()

        class _Handler(TranscriptResultStreamHandler):
            def __init__(handler_self, output_stream):
                super().__init__(output_stream)
                handler_self._response_queue = self._response_queue

            async def handle_transcript_event(handler_self, transcript_event: TranscriptEvent):
                results = transcript_event.transcript.results
                for result in results:
                    if not result.alternatives:
                        continue
                    alt = result.alternatives[0]
                    text = alt.transcript or ""
                    if not text.strip():
                        continue

                    raw_start = result.start_time if hasattr(result, "start_time") else None
                    raw_end = result.end_time if hasattr(result, "end_time") else None
                    response = STTResponse(
                        text=text,
                        is_final=not result.is_partial,
                        start_seconds=(stream_offset + raw_start) if raw_start is not None else None,
                        end_seconds=(stream_offset + raw_end) if raw_end is not None else None,
                        stability=getattr(alt, "stability", 0.0) or 0.0,
                    )
                    await handler_self._response_queue.put(response)

        handler = _Handler(stream.output_stream)

        write_task = asyncio.create_task(_write_audio())
        read_task = asyncio.create_task(handler.handle_events())
        try:
            done, _pending = await asyncio.wait(
                {write_task, read_task},
                return_when=asyncio.FIRST_EXCEPTION,
            )
            for task in done:
                exc = task.exception()
                if exc is not None:
                    raise exc
        finally:
            for task in (write_task, read_task):
                if not task.done():
                    task.cancel()
            for task in (write_task, read_task):
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    async def feed_audio(self, data: bytes) -> None:
        if self._closed:
            return
        if self._stream_task is None:
            self._stream_task = asyncio.create_task(self._run_stream())
        await self._audio_queue.put(data)

    async def get_responses(self) -> AsyncIterator[STTResponse]:
        while True:
            response = await self._response_queue.get()
            if response is None:
                break
            yield response

    async def pause(self) -> None:
        self._paused = True

    async def resume(self) -> None:
        self._paused = False

    async def finish(self) -> list[STTResponse]:
        if self._closed:
            return []
        self._closed = True

        await self._audio_queue.put(None)

        if self._stream_task:
            try:
                await asyncio.wait_for(self._stream_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("AWS Transcribe stream finish timeout")
                self._stream_task.cancel()

        remaining: list[STTResponse] = []
        while not self._response_queue.empty():
            item = self._response_queue.get_nowait()
            if item is not None:
                remaining.append(item)
        return remaining

    async def close(self) -> None:
        if not self._closed:
            await self.finish()
        if self._stream_task and not self._stream_task.done():
            self._stream_task.cancel()
