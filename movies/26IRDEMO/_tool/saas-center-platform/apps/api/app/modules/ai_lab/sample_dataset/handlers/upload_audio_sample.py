import asyncio
import io
import os
import tempfile
from uuid import uuid4

from mutagen import File as MutagenFile

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client

from ..._audit import emit_admin_audit
from ...facade import SampleFacade
from ..schemas import SampleDatasetResponse


async def upload_audio_sample_handler(
    *,
    file_content: bytes,
    filename: str | None,
    content_type: str | None,
    name: str,
    description: str | None,
    tags: str | None,
    source_type: str,
    uow: UnitOfWork,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> SampleDatasetResponse:
    file_size = len(file_content)

    # 오디오 길이 측정: mutagen → ffprobe fallback
    audio_duration = 0.0
    try:
        audio_file = MutagenFile(io.BytesIO(file_content))
        if audio_file and audio_file.info:
            audio_duration = audio_file.info.length
    except Exception:
        pass  # mutagen 미지원 포맷은 ffprobe fallback으로 처리

    if audio_duration <= 0:
        ext = os.path.splitext(filename or "audio.bin")[1] or ".bin"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0 and stdout.strip():
                audio_duration = float(stdout.strip())
        except Exception:
            pass  # ffprobe 미설치 또는 실행 실패 시 duration=0으로 진행
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    storage = get_storage_client()
    sample_id = str(uuid4())
    ext = os.path.splitext(filename or "audio.webm")[1] or ".webm"
    s3_key = f"centers/lab/samples/{sample_id}{ext}"

    await storage.upload_file(
        file_data=file_content,
        path=s3_key,
        content_type=content_type or "audio/webm",
    )

    sample = await SampleFacade(uow).upload_audio_sample(
        name=name,
        s3_key=s3_key,
        audio_duration=audio_duration,
        audio_file_size=file_size,
        description=description,
        tags=tags,
        source_type=source_type,
    )
    await emit_admin_audit(
        uow, "sample_dataset_created",
        act="created", entity_name="sample_dataset", entity_id=sample.id,
        payload={"name": name, "input_type": "audio"},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return SampleDatasetResponse.model_validate(sample)


TOOL = {
    "name": "upload_audio_sample_handler",
    "permission": None,
    "purpose": "오디오 파일을 업로드해 샘플로 등록한다.",
    "keywords": ["오디오 샘플 업로드", "음성 파일 등록", "녹음 업로드", "audio 샘플"],
    "boundaries": "오디오 파일을 올려 샘플로 만든다. 텍스트 샘플은 create_text_sample_handler.",
    "output": "등록된 오디오 샘플 (SampleDatasetResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "샘플 이름", "description": "등록할 샘플 이름."},
            "description": {"type": "string", "title": "설명", "description": "설명(선택)."},
            "tags": {"type": "string", "title": "태그", "description": "태그(선택)."},
            "source_type": {"type": "string", "title": "출처 유형", "description": "샘플 출처 유형."},
            "filename": {"type": "string", "title": "파일명", "description": "업로드 파일명(선택)."},
        },
        "required": ["name", "source_type"],
    },
}
