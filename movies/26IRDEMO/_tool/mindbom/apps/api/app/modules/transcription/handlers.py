"""전사 Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.dependencies import ClientInfo
from app.core.unit_of_work import UnitOfWork
from app.modules.auth.dependencies import InstitutionContext
from app.modules.transcription.facade import TranscriptionFacade
from app.modules.transcription.schemas import DiarizeResponse, TranscribeResponse


async def handle_whisper(
    ctx: InstitutionContext,
    audio: bytes,
    filename: str,
    language: str | None,
    prompt: str | None,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> TranscribeResponse:
    async with uow:
        result = await TranscriptionFacade(uow).whisper(
            ctx, audio,
            filename=filename, language=language, prompt=prompt,
            client_info=client_info,
        )
        await uow.commit()
        return result


async def handle_diarize(
    ctx: InstitutionContext,
    audio: bytes,
    filename: str,
    language: str | None,
    known_speakers: dict[str, bytes] | None,
    speaker_mime: str,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> DiarizeResponse:
    async with uow:
        result = await TranscriptionFacade(uow).diarize(
            ctx, audio,
            filename=filename, language=language,
            known_speakers=known_speakers, speaker_mime=speaker_mime,
            client_info=client_info,
        )
        await uow.commit()
        return result
