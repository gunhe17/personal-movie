from __future__ import annotations


def _josa_i_ga(word: str) -> str:
    if not word:
        return "이"
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:
        return "이" if (code - 0xAC00) % 28 > 0 else "가"
    return "이"


