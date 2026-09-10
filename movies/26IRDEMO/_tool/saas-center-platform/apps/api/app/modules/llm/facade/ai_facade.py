from __future__ import annotations

from app.modules.llm.gateway.ai_gateway import AIGateway
from app.modules.llm.gateway.factory import create_ai_gateway
from app.modules.llm.gateway.schemas import (
    AICallContext,
    LLMCallResult,
    STTCallResult,
)


class AIFacade:
    # non-uow — 게이트웨이가 자체 독립 세션으로 사용량을 기록한다(ai-calling.md)
    def __init__(
        self,
        gateway: AIGateway,
    ):
        self._gw = gateway

    # 크레딧 사전체크 (호출 전 잔량 게이트 — 부족 시 QuotaExceededException)
    async def verify_quota(
        self,
        center_id: str,
        purpose: str,
    ) -> None:
        return await self._gw.verify_quota(center_id, purpose)

    # config
    async def resolve_config(
        self,
        pipeline_step: str,
        *,
        module: str = "field_note",
        default_prompt: str | None = None,
    ) -> dict:
        return await self._gw.resolve_config(
            pipeline_step,
            module=module,
            default_prompt=default_prompt,
        )

    # LLM
    async def generate_text(
        self,
        ctx: AICallContext,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        resolved_config: dict | None = None,
    ) -> LLMCallResult:
        return await self._gw.generate_text(
            ctx,
            system_prompt,
            user_prompt,
            max_tokens=max_tokens,
            resolved_config=resolved_config,
        )

    async def generate_json(
        self,
        ctx: AICallContext,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        resolved_config: dict | None = None,
    ) -> LLMCallResult:
        return await self._gw.generate_json(
            ctx,
            system_prompt,
            user_prompt,
            max_tokens=max_tokens,
            resolved_config=resolved_config,
        )

    async def generate_multimodal(
        self,
        ctx: AICallContext,
        *,
        model: str,
        messages: list[dict],
        max_tokens: int = 64000,
        temperature: float = 0.1,
        response_format: dict | None = None,
        stop: list[str] | None = None,
        reasoning: dict | None = None,
        cutoff_seconds: float = 60.0,
        max_retries: int = 3,
        stream: bool = True,
        timeout: float = 120.0,
        call_key: str | None = None,
        service_tier: str | None = None,
    ):
        return await self._gw.generate_multimodal(
            ctx,
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format=response_format,
            stop=stop,
            reasoning=reasoning,
            cutoff_seconds=cutoff_seconds,
            max_retries=max_retries,
            stream=stream,
            timeout=timeout,
            call_key=call_key,
            service_tier=service_tier,
        )

    # STT
    async def transcribe(
        self,
        ctx: AICallContext,
        audio_data: bytes,
        *,
        language: str = "ko",
        filename: str = "audio.webm",
    ) -> STTCallResult:
        return await self._gw.transcribe(
            ctx,
            audio_data,
            language=language,
            filename=filename,
        )

    async def transcribe_with_timestamps(
        self,
        ctx: AICallContext,
        audio_data: bytes,
        *,
        language: str = "ko",
        filename: str = "audio.webm",
        model_override: str | None = None,
    ) -> STTCallResult:
        return await self._gw.transcribe_with_timestamps(
            ctx,
            audio_data,
            language=language,
            filename=filename,
            model_override=model_override,
        )

    async def transcribe_with_diarization(
        self,
        ctx: AICallContext,
        audio_data: bytes,
        *,
        language: str = "ko",
        filename: str = "audio.webm",
        model_override: str | None = None,
    ) -> STTCallResult:
        return await self._gw.transcribe_with_diarization(
            ctx,
            audio_data,
            language=language,
            filename=filename,
            model_override=model_override,
        )

    # 실험 (ai_lab 전용 — model override + no-bill)
    async def run_experiment(
        self,
        *,
        provider: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        json: bool = False,
        max_tokens: int | None = None,
    ):
        return await self._gw.run_experiment(
            provider=provider,
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json=json,
            max_tokens=max_tokens,
        )

    # agent 전용 — 스트리밍 턴 정산(drain-to-zero: 잔액까지만 차감, 턴 안 끊음)
    async def record_agent_call(
        self,
        ctx: AICallContext,
        *,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        meta: dict | None = None,
    ) -> None:
        return await self._gw.record_agent_call(
            ctx,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            meta=meta,
        )

    # 화자분리 과금 — 길이 기반 제품 가격(전략 무관), 게이트웨이가 환산·차감 소유
    async def bill_diarize(
        self,
        ctx: AICallContext,
        *,
        duration_seconds: float,
        model: str,
    ) -> None:
        return await self._gw.bill_diarize(
            ctx,
            duration_seconds=duration_seconds,
            model=model,
        )

    # 스트리밍 STT — 세션 개시(quota 게이트·사용량 기록 게이트웨이 소유)
    def streaming_stt_available(self) -> bool:
        return self._gw.streaming_stt_available()

    async def transcribe_stream(
        self,
        ctx: AICallContext,
        *,
        sample_rate: int = 16000,
    ):
        return await self._gw.transcribe_stream(
            ctx,
            sample_rate=sample_rate,
        )

    # 실험 STT — run_experiment의 STT 판(no-bill), ai_lab 전용
    async def experiment_transcribe(
        self,
        audio_data: bytes,
        *,
        model: str,
        **kwargs,
    ) -> str:
        return await self._gw.experiment_transcribe(audio_data, model=model, **kwargs)

    async def experiment_transcribe_with_timestamps(
        self,
        audio_data: bytes,
        *,
        model: str,
        **kwargs,
    ) -> dict:
        return await self._gw.experiment_transcribe_with_timestamps(audio_data, model=model, **kwargs)

    async def experiment_transcribe_with_diarization(
        self,
        audio_data: bytes,
        *,
        model: str,
        **kwargs,
    ) -> dict:
        return await self._gw.experiment_transcribe_with_diarization(audio_data, model=model, **kwargs)


def create_ai_facade() -> AIFacade:
    return AIFacade(create_ai_gateway())
