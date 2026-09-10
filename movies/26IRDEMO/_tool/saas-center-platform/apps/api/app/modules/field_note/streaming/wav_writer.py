import struct


def pcm_to_wav(
    pcm_data: bytes,
    *,
    sample_rate: int = 16000,
    channels: int = 1,
    bits_per_sample: int = 16,
) -> bytes:
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    data_size = len(pcm_data)

    # WAV 헤더 (44 bytes)
    header = struct.pack(
        "<4sI4s"      # RIFF chunk
        "4sIHHIIHH"   # fmt sub-chunk
        "4sI",         # data sub-chunk header
        b"RIFF",
        36 + data_size,   # file size - 8
        b"WAVE",
        b"fmt ",
        16,                # fmt chunk size (PCM)
        1,                 # audio format (1 = PCM)
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + pcm_data
