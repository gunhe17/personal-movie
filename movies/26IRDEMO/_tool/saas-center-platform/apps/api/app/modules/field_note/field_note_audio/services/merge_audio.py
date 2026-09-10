import os
import subprocess
import tempfile

from app.core.logger import get_logger

logger = get_logger(__name__)


# m4a는 MPEG-4 컨테이너라 바이트 연결 불가 — ffmpeg concat 필수, 실패 시 가장 큰 청크 fallback.
async def merge_audio_chunks(audios: list, storage) -> bytes:
    # load
    chunk_data_list: list[bytes] = []
    for audio in audios:
        data = await storage.download_file(audio.storage_path)
        chunk_data_list.append(data)

    if len(chunk_data_list) == 1:
        return chunk_data_list[0]

    logger.info(f"Merging {len(chunk_data_list)} audio chunks with ffmpeg")

    with tempfile.TemporaryDirectory() as tmpdir:
        chunk_paths = []
        for i, data in enumerate(chunk_data_list):
            path = os.path.join(tmpdir, f"chunk_{i:04d}.m4a")
            with open(path, "wb") as f:
                f.write(data)
            chunk_paths.append(path)

        list_path = os.path.join(tmpdir, "files.txt")
        with open(list_path, "w") as f:
            for path in chunk_paths:
                f.write(f"file '{path}'\n")

        output_path = os.path.join(tmpdir, "combined.m4a")

        try:
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-f", "concat", "-safe", "0",
                    "-i", list_path,
                    "-c", "copy",
                    output_path,
                ],
                capture_output=True,
                timeout=120,
            )
            if result.returncode == 0 and os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    merged = f.read()
                logger.info(f"ffmpeg merge success: {len(merged)} bytes")
                return merged
            else:
                logger.warning(
                    f"ffmpeg merge failed (rc={result.returncode}): "
                    f"{result.stderr.decode(errors='replace')[:500]}"
                )
        except FileNotFoundError:
            logger.warning("ffmpeg not found, falling back to largest chunk")
        except subprocess.TimeoutExpired:
            logger.warning("ffmpeg merge timed out, falling back to largest chunk")

    largest = max(chunk_data_list, key=len)
    logger.warning(f"Using largest chunk only ({len(largest)} bytes) as fallback")
    return largest
