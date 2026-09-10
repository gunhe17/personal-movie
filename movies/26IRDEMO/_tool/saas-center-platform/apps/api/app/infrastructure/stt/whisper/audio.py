import asyncio
import os
import tempfile
import glob as _glob

from app.core.logger import get_logger

logger = get_logger(__name__)

MODEL_MAX_DURATION: dict[str, int] = {
    "gpt-4o-transcribe": 480,
    "gpt-4o-mini-transcribe": 480,
}
DEFAULT_MAX_DURATION = 1200
DIARIZE_CHUNK_SECONDS = 60


async def to_mp3(
    audio_data: bytes, src_filename: str, *, bitrate: str = "48k",
) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(src_filename)[1] or ".bin", delete=False) as src:
        src.write(audio_data)
        src_path = src.name

    dst_path = src_path + ".mp3"
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", src_path,
            "-ar", "16000", "-ac", "1", "-b:a", bitrate, dst_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.warning(f"ffmpeg conversion failed: {stderr.decode()[:500]}")
            return audio_data

        with open(dst_path, "rb") as f:
            return f.read()
    finally:
        for p in (src_path, dst_path):
            try:
                os.unlink(p)
            except OSError:
                pass


async def get_duration(file_path_or_bytes: str | bytes) -> float:
    if isinstance(file_path_or_bytes, bytes):
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(file_path_or_bytes)
            tmp_path = tmp.name
        try:
            return await get_duration(tmp_path)
        finally:
            os.unlink(tmp_path)

    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", file_path_or_bytes,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode == 0 and stdout.strip():
            return float(stdout.strip())
    except Exception:
        pass
    return 0.0


async def split_audio(
    audio_data: bytes, chunk_seconds: int, *, known_duration: float = 0,
) -> list[bytes]:
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as src:
        src.write(audio_data)
        src_path = src.name

    try:
        duration = known_duration if known_duration > 0 else await get_duration(src_path)

        force_split = duration <= 0 and len(audio_data) > 500_000
        if force_split:
            logger.warning(
                f"Duration unknown (ffprobe failed), forcing split for "
                f"{len(audio_data)} bytes file"
            )

        if not force_split and duration <= chunk_seconds:
            return [audio_data]

        out_dir = tempfile.mkdtemp()
        out_pattern = os.path.join(out_dir, "chunk_%03d.mp3")
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", src_path,
            "-f", "segment", "-segment_time", str(chunk_seconds),
            "-ar", "16000", "-ac", "1", "-b:a", "48k",
            out_pattern,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.warning(f"ffmpeg split failed: {stderr.decode()[:500]}")
            return [audio_data]

        chunks: list[bytes] = []
        for chunk_path in sorted(_glob.glob(os.path.join(out_dir, "chunk_*.mp3"))):
            with open(chunk_path, "rb") as f:
                chunks.append(f.read())
            os.unlink(chunk_path)
        os.rmdir(out_dir)

        actual_duration = duration if duration > 0 else len(audio_data) / 6000
        logger.info(
            f"Audio split: ~{actual_duration:.0f}s → {len(chunks)} chunks "
            f"({chunk_seconds}s each)"
        )
        return chunks if chunks else [audio_data]
    finally:
        try:
            os.unlink(src_path)
        except OSError:
            pass
