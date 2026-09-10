"""전사 Router — multipart/form-data 업로드"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.dependencies import ClientInfo, get_client_info
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.auth.dependencies import InstitutionContext, get_institution_context
from app.modules.transcription.handlers import handle_diarize, handle_whisper
from app.modules.transcription.schemas import DiarizeResponse, TranscribeResponse

router = APIRouter(
    prefix="/institutions/{institution_id}/transcription",
    tags=["transcription"],
)

# OpenAI Audio API 제한
_MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25MB


@router.post("/whisper", response_model=TranscribeResponse)
async def whisper(
    audio: UploadFile = File(..., description="오디오 파일 (mp3/mp4/m4a/wav/webm, 25MB 이하)"),
    language: str | None = Form(None, description="ISO 639-1 언어 코드 (예: ko)"),
    prompt: str | None = Form(None, description="의학용어 사전 등 컨텍스트 (224 토큰 제한)"),
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    """whisper-1 단순 전사"""
    audio_bytes = await audio.read()
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"오디오 파일은 {_MAX_AUDIO_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
        )

    return await handle_whisper(
        ctx=ctx,
        audio=audio_bytes,
        filename=audio.filename or "audio.wav",
        language=language,
        prompt=prompt,
        client_info=client_info,
        uow=uow,
    )


@router.post("/diarize", response_model=DiarizeResponse)
async def diarize(
    audio: UploadFile = File(..., description="오디오 파일 (mp3/mp4/m4a/wav/webm, 25MB 이하)"),
    language: str | None = Form(None, description="ISO 639-1 언어 코드"),
    speaker_names: list[str] = Form(default_factory=list, description="화자 라벨 (speaker_audios와 인덱스 매칭)"),
    speaker_audios: list[UploadFile] = File(default_factory=list, description="화자 참조 오디오 (2~10초, 최대 4명)"),
    speaker_mime: str = Form("audio/wav", description="화자 참조 오디오 MIME 타입"),
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    """gpt-4o-transcribe-diarize 화자 분리 전사"""
    audio_bytes = await audio.read()
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"오디오 파일은 {_MAX_AUDIO_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
        )

    if len(speaker_names) != len(speaker_audios):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="speaker_names와 speaker_audios는 같은 개수여야 합니다.",
        )

    known_speakers: dict[str, bytes] | None = None
    if speaker_names:
        known_speakers = {
            name: await ref.read()
            for name, ref in zip(speaker_names, speaker_audios)
        }

    return await handle_diarize(
        ctx=ctx,
        audio=audio_bytes,
        filename=audio.filename or "audio.wav",
        language=language,
        known_speakers=known_speakers,
        speaker_mime=speaker_mime,
        client_info=client_info,
        uow=uow,
    )
