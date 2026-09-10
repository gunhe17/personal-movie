"""전사 Facade — Service 조합 + 감사 추적"""
from app.core.dependencies import ClientInfo
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.openai import OpenAITranscription, get_transcription
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.dependencies import InstitutionContext
from app.modules.transcription.schemas import DiarizeResponse, TranscribeResponse
from app.modules.transcription.services import DiarizeService, WhisperService


class TranscriptionFacade:
    """음성 전사 도메인 — Service 조합 + 감사 통합"""

    def __init__(
        self,
        uow: UnitOfWork,
        client: OpenAITranscription | None = None,
    ):
        self._uow = uow
        self._client = client or get_transcription()

    def _audit_logger(self) -> AuditLogger:
        return AuditLogger(self._uow.repo(AuditLogRepository))

    async def whisper(
        self,
        ctx: InstitutionContext,
        audio: bytes,
        *,
        filename: str,
        language: str | None,
        prompt: str | None,
        client_info: ClientInfo,
    ) -> TranscribeResponse:
        result = await WhisperService(self._client).execute(
            audio, filename=filename, language=language, prompt=prompt,
        )
        await self._audit_logger().log(
            action="transcribe",
            entity_type="transcription",
            entity_id="whisper-1",
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            metadata={
                "filename": filename,
                "size_bytes": len(audio),
                "language": result.language,
                "duration_sec": result.duration_sec,
            },
        )
        return result

    async def diarize(
        self,
        ctx: InstitutionContext,
        audio: bytes,
        *,
        filename: str,
        language: str | None,
        known_speakers: dict[str, bytes] | None,
        speaker_mime: str,
        client_info: ClientInfo,
    ) -> DiarizeResponse:
        result = await DiarizeService(self._client).execute(
            audio,
            filename=filename,
            language=language,
            known_speakers=known_speakers,
            speaker_mime=speaker_mime,
        )
        await self._audit_logger().log(
            action="transcribe_diarize",
            entity_type="transcription",
            entity_id="gpt-4o-transcribe-diarize",
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            metadata={
                "filename": filename,
                "size_bytes": len(audio),
                "duration_sec": result.duration_sec,
                "segments_count": len(result.segments),
                "known_speakers_count": len(known_speakers or {}),
            },
        )
        return result
