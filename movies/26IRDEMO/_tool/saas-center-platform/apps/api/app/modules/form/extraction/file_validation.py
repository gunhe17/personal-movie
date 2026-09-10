"""서식 업로드 파일 검증 + 확장자 결정 헬퍼.

form extraction 입력은 서식 1장 — 이미지(png/jpg) 또는 PDF만 받는다.
(voucher 의 file_validation 보다 좁은 화이트리스트: 가공이 PNG 1장으로 환원하므로
오피스/HWPX 등은 받지 않는다.)
"""
from __future__ import annotations

from app.core.exceptions import InvalidOperationException


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}

# 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

EXTENSION_MAP = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

_ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp"}


def _ext_from_filename(filename: str | None) -> str | None:
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[1].lower()


def validate_file(
    filename: str | None, content_type: str | None, data: bytes
) -> None:
    type_ok = content_type in ALLOWED_CONTENT_TYPES
    ext = _ext_from_filename(filename)
    ext_ok = ext in _ALLOWED_EXTENSIONS
    if not type_ok and not ext_ok:
        raise InvalidOperationException(
            f"허용되지 않는 서식 형식입니다(PDF/PNG/JPG만): {content_type} ({filename})"
        )
    if len(data) == 0:
        raise InvalidOperationException("빈 파일은 업로드할 수 없습니다")
    if len(data) > MAX_FILE_SIZE:
        raise InvalidOperationException(
            f"파일 크기가 너무 큽니다. 최대: {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )


def resolve_ext(filename: str | None, content_type: str | None) -> str:
    """확장자 결정 우선순위: 파일명 확장자 → content_type 매핑 → 'bin'."""
    ext = _ext_from_filename(filename)
    if ext:
        return "jpg" if ext == "jpeg" else ext
    if content_type:
        return EXTENSION_MAP.get(content_type, "bin")
    return "bin"
