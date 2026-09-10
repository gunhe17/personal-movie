# AI Gateway — 모든 AI 호출의 중앙 진입점.
# config 조회(ProductionAIConfig DB → 하드코딩 fallback) → 클라이언트 취득 →
# pre-call quota 체크 → 호출 → post-call 사용량 기록(LlmCall).

import time
from typing import TYPE_CHECKING

from app.core.logger import get_logger
from .schemas import AICallContext, LLMCallResult, STTCallResult, redact_image_messages
from .quota import QuotaChecker, CreditDeductor, NoOpQuotaChecker

if TYPE_CHECKING:
    from app.infrastructure.llm.openrouter.chat_json import ChatJsonResult
    from app.infrastructure.llm.openrouter.multimodal import OpenRouterCallResult

logger = get_logger(__name__)


# 독립 세션 기반 — 메인 트랜잭션과 분리되어 호출 실패 시에도 사용량 기록이 보장된다
class AIGateway:
    def __init__(
        self,
        session_factory,
        *,
        quota: QuotaChecker | None = None,
        deductor: CreditDeductor | None = None,
    ):
        self._sf = session_factory
        self._quota = quota or NoOpQuotaChecker()
        self._deductor = deductor

    # ── Config 조회 ──

    async def resolve_config(
        self,
        pipeline_step: str,
        *,
        module: str = "field_note",
        default_prompt: str | None = None,
    ) -> dict:
        from sqlalchemy import select
        from app.modules.ai_lab.production_config.models import ProductionAIConfig

        try:
            async with self._sf() as session:
                stmt = (
                    select(ProductionAIConfig)
                    .where(
                        ProductionAIConfig.module == module,
                        ProductionAIConfig.pipeline_step == pipeline_step,
                        ProductionAIConfig.is_active.is_(True),
                        ProductionAIConfig.deleted_at.is_(None),
                    )
                    .order_by(ProductionAIConfig.created_at.desc())
                    .limit(1)
                )
                result = await session.execute(stmt)
                config = result.scalar_one_or_none()

                if config:
                    logger.debug(
                        f"AI config from DB: step={pipeline_step}, model={config.model_name}"
                    )
                    resolved: dict = {
                        "model_name": config.model_name,
                        "system_prompt": config.system_prompt,
                    }
                    # stt_diarize 전용: 화자분리 전략
                    if (
                        hasattr(config, "diarization_strategy")
                        and config.diarization_strategy
                    ):
                        resolved["diarization_strategy"] = config.diarization_strategy
                    return resolved
        except Exception as e:
            logger.warning(f"Failed to load AI config for step={pipeline_step}: {e}")

        return {"model_name": None, "system_prompt": default_prompt}

    # ── 크레딧 사전체크 ──

    async def verify_quota(self, center_id: str, purpose: str) -> None:
        # 잔량 게이트(부족 시 QuotaExceededException) — 실제 호출 전 체크와 동일한 checker.
        # 기간 정산은 소비 직전 조율층 시임 소관(ai-calling.md)
        await self._quota.check(center_id, purpose)

    # ── LLM 호출 ──

    async def generate_text(
        self,
        ctx: AICallContext,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        resolved_config: dict | None = None,
    ) -> LLMCallResult:
        # resolved_config 전달 시 내부 중복 DB 조회 생략
        await self._quota.check(ctx.center_id, ctx.purpose)

        config = resolved_config or await self._resolve_config_if_needed(ctx)
        client = self._get_llm_client(config)
        if not client:
            raise AIServiceUnavailableError("LLM client not available")

        llm_result = await client.quick(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=max_tokens,
        )

        result = LLMCallResult(
            content=llm_result.content,
            model=llm_result.model,
            input_tokens=llm_result.input_tokens,
            output_tokens=llm_result.output_tokens,
            latency_ms=llm_result.latency_ms,
        )

        await self._record_call(
            ctx,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            latency_ms=result.latency_ms,
        )

        return result

    async def generate_json(
        self,
        ctx: AICallContext,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        resolved_config: dict | None = None,
    ) -> LLMCallResult:
        # resolved_config 전달 시 내부 중복 DB 조회 생략
        await self._quota.check(ctx.center_id, ctx.purpose)

        config = resolved_config or await self._resolve_config_if_needed(ctx)
        client = self._get_llm_client(config)
        if not client:
            raise AIServiceUnavailableError("LLM client not available")

        llm_result = await client.quick(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json=True,
            max_tokens=max_tokens,
        )

        result = LLMCallResult(
            content=llm_result.content,
            model=llm_result.model,
            input_tokens=llm_result.input_tokens,
            output_tokens=llm_result.output_tokens,
            latency_ms=llm_result.latency_ms,
        )

        await self._record_call(
            ctx,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            latency_ms=result.latency_ms,
        )

        return result

    # ── 실험 (ai_lab 전용 — model override + no-bill) ──

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
        # ai_lab 전용 무과금 경로 — quota 체크·사용량 기록 없음(실험은 과금 대상 아님).
        # raw LLMResponse(.content·.input_tokens·.output_tokens·.latency_ms) 그대로 반환
        from app.infrastructure.llm.factory import openai_client, openrouter_client

        client = (
            openrouter_client(model)
            if provider == "openrouter"
            else openai_client(model)
        )
        return await client.quick(
            system_prompt,
            user_prompt,
            json=json,
            max_tokens=max_tokens,
        )

    # ── 실험 STT (ai_lab 전용 — model override + no-bill) ──

    def _experiment_stt_client(
        self,
        model: str,
    ):
        from app.core.config import settings
        from app.infrastructure.stt.whisper.client import WhisperSTTClient

        return WhisperSTTClient(api_key=settings.OPENAI_API_KEY, model=model)

    async def experiment_transcribe(
        self,
        audio_data: bytes,
        *,
        model: str,
        **kwargs,
    ) -> str:
        # run_experiment의 STT 판 — quota·과금·기록 없음
        return await self._experiment_stt_client(model).transcribe(
            audio_data=audio_data,
            **kwargs,
        )

    async def experiment_transcribe_with_timestamps(
        self,
        audio_data: bytes,
        *,
        model: str,
        **kwargs,
    ) -> dict:
        return await self._experiment_stt_client(model).transcribe_with_timestamps(
            audio_data=audio_data,
            **kwargs,
        )

    async def experiment_transcribe_with_diarization(
        self,
        audio_data: bytes,
        *,
        model: str,
        **kwargs,
    ) -> dict:
        return await self._experiment_stt_client(model).transcribe_with_diarization(
            audio_data=audio_data,
            **kwargs,
        )

    # ── 멀티모달 호출 ──

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
    ) -> "OpenRouterCallResult | ChatJsonResult":
        # call_key: 호출자가 여러 병렬 콜을 구분하려고 붙이는 라벨(예: 페이지 id) — meta에만 실림,
        # 호출 자체엔 영향 없음.
        # service_tier="flex": 여유 자원 등급(동일 품질·−50%·지연 best-effort). 비스트리밍만 배선.
        # stream=True: SSE 멀티모달(cutoff_seconds·stop·response_format) → OpenRouterCallResult /
        # stream=False: 비스트리밍 JSON(cache_control, transport가 json_object 고정) → ChatJsonResult.
        # 호출 실패는 raise 없이 ok=False 결과 — 사용량 기록은 성공/실패 모두(과금 리포트 연속성)
        await self._quota.check(ctx.center_id, ctx.purpose)

        if stream:
            client = self._get_multimodal_client()
            if not client:
                raise AIServiceUnavailableError(
                    "OpenRouter multimodal client not available"
                )
            result = await client.call(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format=response_format,
                stop=stop,
                reasoning=reasoning,
                cutoff_seconds=cutoff_seconds,
                max_retries=max_retries,
            )
        else:
            chat = self._get_chat_json_client()
            if not chat:
                raise AIServiceUnavailableError("OpenRouter chat client not available")
            result = await chat.call_json(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                reasoning=reasoning,
                response_format=response_format,
                service_tier=service_tier,
                timeout=timeout,
                max_retries=max_retries,
            )

        content = getattr(result, "content", None) or getattr(result, "raw", None)
        await self._record_call(
            ctx,
            model=result.model or model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            latency_ms=float(result.latency_ms),
            error_message=None if result.ok else (result.error or "unknown")[:500],
            meta={"input": redact_image_messages(messages), "output": content, "key": call_key},
        )

        return result

    # ── STT 호출 ──

    async def transcribe(
        self,
        ctx: AICallContext,
        audio_data: bytes,
        *,
        language: str = "ko",
        filename: str = "audio.webm",
    ) -> STTCallResult:
        await self._quota.check(ctx.center_id, ctx.purpose)

        stt = self._get_stt_client()
        if not stt:
            raise AIServiceUnavailableError("STT client not available")

        audio_duration = len(audio_data) / (16000 * 2)

        t0 = time.monotonic()
        text = await stt.transcribe(
            audio_data=audio_data,
            language=language,
            filename=filename,
        )
        latency = (time.monotonic() - t0) * 1000

        result = STTCallResult(
            text=text,
            model=stt.model,
            audio_duration_seconds=audio_duration,
            latency_ms=latency,
        )

        await self._record_call(
            ctx,
            model=result.model,
            latency_ms=result.latency_ms,
            audio_duration_seconds=result.audio_duration_seconds,
        )

        return result

    async def transcribe_with_timestamps(
        self,
        ctx: AICallContext,
        audio_data: bytes,
        *,
        language: str = "ko",
        filename: str = "audio.webm",
        model_override: str | None = None,
    ) -> STTCallResult:
        # specialized diarization 전략에서 사용(Whisper 전사 → pyannote 화자분리)
        await self._quota.check(ctx.center_id, ctx.purpose)

        stt = self._get_stt_client()
        if not stt:
            raise AIServiceUnavailableError("STT client not available")

        audio_duration = len(audio_data) / (16000 * 2)
        stt_model = model_override or stt.model

        t0 = time.monotonic()
        raw_result = await stt.transcribe_with_timestamps(
            audio_data=audio_data,
            language=language,
            filename=filename,
            model_override=stt_model,
        )
        latency = (time.monotonic() - t0) * 1000

        result = STTCallResult(
            text=raw_result["text"],
            model=stt_model,
            audio_duration_seconds=audio_duration,
            segments=raw_result["segments"],
            latency_ms=latency,
        )

        await self._record_call(
            ctx,
            model=result.model,
            latency_ms=result.latency_ms,
            audio_duration_seconds=result.audio_duration_seconds,
        )

        return result

    async def transcribe_with_diarization(
        self,
        ctx: AICallContext,
        audio_data: bytes,
        *,
        language: str = "ko",
        filename: str = "audio.webm",
        model_override: str | None = None,
    ) -> STTCallResult:
        from app.infrastructure.stt.common.normalize_diarize import (
            normalize_diarize_response,
        )

        await self._quota.check(ctx.center_id, ctx.purpose)

        stt = self._get_stt_client()
        if not stt:
            raise AIServiceUnavailableError("STT client not available")

        audio_duration = len(audio_data) / (16000 * 2)
        stt_model = model_override or stt.diarize_model

        t0 = time.monotonic()
        raw_result = await stt.transcribe_with_diarization(
            audio_data=audio_data,
            language=language,
            model_override=stt_model,
            filename=filename,
        )
        latency = (time.monotonic() - t0) * 1000

        # normalize_diarize_response로 통일된 형식 보장
        if isinstance(raw_result, dict):
            normalized = normalize_diarize_response(raw_result)
        elif isinstance(raw_result, str):
            normalized = {"text": raw_result, "segments": []}
        else:
            normalized = {"text": "", "segments": []}

        result = STTCallResult(
            text=normalized["text"],
            model=stt_model,
            audio_duration_seconds=audio_duration,
            segments=normalized["segments"],
            latency_ms=latency,
        )

        await self._record_call(
            ctx,
            model=result.model,
            latency_ms=result.latency_ms,
            audio_duration_seconds=result.audio_duration_seconds,
        )

        return result

    # ── 외부 호출 기록 ──

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
        """agent 스트리밍 턴 정산 — 영수증 기록 + drain-to-zero 차감(잔액까지만, 안 끊음)."""
        await self._record_call(
            ctx,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            drain=True,
            meta=meta,
        )

    async def record_external_call(
        self,
        ctx: AICallContext,
        *,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        audio_duration_seconds: float | None = None,
        error_message: str | None = None,
    ) -> None:
        # Gateway 밖에서 수행된 AI 호출의 사용량만 통합 기록(자체 클라이언트를 쓰는 agent 잔존 2곳)
        await self._record_call(
            ctx,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            audio_duration_seconds=audio_duration_seconds,
            error_message=error_message,
        )

    async def bill_diarize(
        self,
        ctx: AICallContext,
        *,
        duration_seconds: float,
        model: str,
    ) -> None:
        # 화자분리 과금 — 전략 무관 길이 기반 제품 가격을 합성 토큰으로 환산해 실차감
        # (개별 transcribe/LLM 호출 기록은 토큰 0)
        import math
        from app.modules.llm.credit_balance.plan_config import DIARIZE_TOKENS_PER_MINUTE

        synthetic_tokens = math.ceil(duration_seconds / 60 * DIARIZE_TOKENS_PER_MINUTE)
        if synthetic_tokens <= 0:
            return
        await self._record_call(
            ctx,
            model=model,
            input_tokens=synthetic_tokens,
        )

    # ── 스트리밍 STT ──

    def streaming_stt_available(self) -> bool:
        from app.infrastructure.stt.factory import get_streaming_provider

        return get_streaming_provider() is not None

    async def transcribe_stream(
        self,
        ctx: AICallContext,
        *,
        sample_rate: int = 16000,
    ) -> "StreamingTranscription":
        # provider 미설정이면 RuntimeError — 가용성은 streaming_stt_available()로 먼저 확인
        from app.core.config import settings
        from app.infrastructure.stt.factory import get_streaming_provider

        provider = get_streaming_provider()
        if provider is None:
            raise RuntimeError("Streaming STT provider is not configured")

        await self.verify_quota(ctx.center_id, ctx.purpose)

        session = await provider.create_session(
            language_code=settings.AWS_TRANSCRIBE_LANGUAGE_CODE,
            sample_rate=sample_rate,
        )
        return StreamingTranscription(
            self,
            ctx,
            session,
            sample_rate=sample_rate,
            model="aws-transcribe-streaming",
        )

    # ── 내부 헬퍼 ──

    def _get_llm_client(self, config: dict):
        # config.model_name(없으면 SUMMARY_MODEL) OpenAI provider — OPENAI_API_KEY 없으면 None(기능 비활성)
        from app.infrastructure.llm.factory import openai_client
        from app.core.config import settings

        if not settings.OPENAI_API_KEY:
            return None
        model = config.get("model_name") or settings.SUMMARY_MODEL
        return openai_client(model)

    def _get_multimodal_client(self):
        # OpenRouter 멀티모달 SSE transport — OPENROUTER_API_KEY 없으면 None
        from app.core.config import settings
        from app.infrastructure.llm.factory import openrouter_multimodal_client

        if not settings.OPENROUTER_API_KEY:
            return None
        return openrouter_multimodal_client()

    def _get_chat_json_client(self):
        # OpenRouter 비스트리밍 JSON transport — OPENROUTER_API_KEY 없으면 None
        from app.core.config import settings
        from app.infrastructure.llm.factory import openrouter_chat_json_client

        if not settings.OPENROUTER_API_KEY:
            return None
        return openrouter_chat_json_client()

    def _get_stt_client(self, model_override: str | None = None):
        from app.infrastructure.stt.factory import get_stt_client

        return get_stt_client()

    async def _resolve_config_if_needed(self, ctx: AICallContext) -> dict:
        # ctx.pipeline_step 있으면 config 조회, 없으면 빈 config
        if ctx.pipeline_step:
            return await self.resolve_config(ctx.pipeline_step)
        return {"model_name": None, "system_prompt": None}

    async def _record_call(
        self,
        ctx: AICallContext,
        *,
        model: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        audio_duration_seconds: float | None = None,
        error_message: str | None = None,
        drain: bool = False,
        meta: dict | None = None,
    ) -> None:
        # LlmCall 기록 + 크레딧 차감 (단일 독립 세션).
        # drain=True는 남은 잔액까지만 차감(0에서 멈춤) — agent 스트리밍 턴 전용 정책
        from app.modules.llm.llm_call.models import LlmCall
        from app.modules.llm.credit_balance.plan_config import AIPurpose, FREE_PURPOSES
        from app.modules.llm.credit_balance.repository import CreditBalanceRepository
        from app.modules.llm.credit_balance.services import (
            DeductCreditService,
            DeductCreditToZeroService,
        )

        # 미등록 purpose 차단 — AIPurpose Enum에 등록되지 않은 호출은 기록하지 않음
        if not ctx.purpose or ctx.purpose not in frozenset(AIPurpose):
            logger.error(
                "AI call blocked: purpose='%s' is not registered in AIPurpose Enum. "
                "새 AI 기능을 추가하려면 AIPurpose Enum에 먼저 등록하세요.",
                ctx.purpose,
            )
            return

        try:
            async with self._sf() as session:
                from app.modules.llm.credit_rate_config.repository import (
                    CreditRateConfigRepository,
                )
                from app.modules.llm.credit_rate_config.services.get_tokens_per_credit import (
                    GetTokensPerCreditService,
                )

                # 0. 현재 활성 비율 조회
                rate_repo = CreditRateConfigRepository(session)
                current_rate = await GetTokensPerCreditService(rate_repo).execute()

                # 1. 사용량 기록
                is_free = ctx.purpose in FREE_PURPOSES
                call = LlmCall(
                    session_id=ctx.session_id,
                    center_id=ctx.center_id,
                    member_id=ctx.member_id,
                    source_type=ctx.source_type,
                    source_id=ctx.source_id,
                    model=model,
                    purpose=ctx.purpose,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    latency_ms=latency_ms,
                    audio_duration_seconds=audio_duration_seconds,
                    error_message=error_message,
                    tokens_per_credit=current_rate,
                    credits_charged=0,  # 무료이면 0, 유료이면 아래에서 갱신
                    meta=meta,
                )
                session.add(call)

                # 2. 크레딧 사후 차감 (동일 세션, 무료 purpose 제외)
                if ctx.center_id and not is_free:
                    total_tokens = input_tokens + output_tokens
                    if total_tokens > 0:
                        repo = CreditBalanceRepository(session)
                        svc = (DeductCreditToZeroService if drain else DeductCreditService)(repo)
                        # 같은 tx의 llm_calls 행이 활동 정본이고 activity read가 이를 노출한다.
                        _deduct_atomic, _, credits_charged = await svc.execute(
                            ctx.center_id,
                            total_tokens,
                            rate=current_rate,
                        )
                        call.credits_charged = credits_charged

                await session.commit()
        except Exception as e:
            logger.warning(f"Failed to record AI call / deduct credit: {e}")


class AIServiceUnavailableError(Exception):
    pass


# 게이트웨이 소유 스트리밍 STT 세션 — transport 프록시 + 사용량 기록.
# record_usage()는 명시 호출·멱등 — 기록 없이 닫는 경로(유령 세션 eviction)는 close()만
class StreamingTranscription:
    def __init__(
        self,
        gateway: AIGateway,
        ctx: AICallContext,
        session,
        *,
        sample_rate: int,
        model: str,
    ):
        self._gateway = gateway
        self._ctx = ctx
        self._session = session
        self._bytes_per_second = sample_rate * 2  # PCM 16bit mono
        self._model = model
        self._fed_bytes = 0
        self._opened_at = time.monotonic()
        self._recorded = False

    @property
    def duration_seconds(self) -> float:
        return self._fed_bytes / self._bytes_per_second

    async def feed_audio(self, data: bytes) -> None:
        await self._session.feed_audio(data)
        self._fed_bytes += len(data)

    def get_responses(self):
        return self._session.get_responses()

    async def pause(self) -> None:
        await self._session.pause()

    async def resume(self) -> None:
        await self._session.resume()

    async def finish(self):
        return await self._session.finish()

    async def close(self) -> None:
        await self._session.close()

    async def record_usage(self) -> None:
        if self._recorded:
            return
        self._recorded = True
        await self._gateway._record_call(
            self._ctx,
            model=self._model,
            latency_ms=(time.monotonic() - self._opened_at) * 1000,
            audio_duration_seconds=self.duration_seconds,
        )
