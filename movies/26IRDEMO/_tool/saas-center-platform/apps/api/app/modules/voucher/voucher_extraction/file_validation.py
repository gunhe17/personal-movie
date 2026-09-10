"""업로드 파일 검증 + 확장자 결정 헬퍼.

(구 services/upload_voucher_file.py 의 validate_file / resolve_ext 를 옮긴 것.)
"""
from __future__ import annotations

from app.core.exceptions import InvalidOperationException


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "text/markdown",
    "text/plain",
    # 한컴 HWPX — IANA 비표준이라 브라우저별로 MIME이 다름. 알려진 변형 모두 허용.
    "application/vnd.hancom.hwpx",
    "application/haansoft-hwpx",
    "application/x-hwpx",
    "application/hwp+zip",
}

# 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

# content_type 화이트리스트 매치가 실패할 때 확장자로 보조 판정할 대상.
_FALLBACK_EXTENSIONS = {"hwpx"}

EXTENSION_MAP = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "text/markdown": "md",
    "text/plain": "txt",
    "application/vnd.hancom.hwpx": "hwpx",
    "application/haansoft-hwpx": "hwpx",
    "application/x-hwpx": "hwpx",
    "application/hwp+zip": "hwpx",
}


def validate_file(
    filename: str | None, content_type: str | None, data: bytes
) -> None:
    type_ok = content_type in ALLOWED_CONTENT_TYPES
    ext_ok = False
    if filename:
        ext = _ext_from_filename(filename)
        ext_ok = ext in _FALLBACK_EXTENSIONS
    if not type_ok and not ext_ok:
        raise InvalidOperationException(
            f"허용되지 않는 파일 형식입니다: {content_type} ({filename})"
        )
    if len(data) == 0:
        raise InvalidOperationException("빈 파일은 업로드할 수 없습니다")
    if len(data) > MAX_FILE_SIZE:
        raise InvalidOperationException(
            f"파일 크기가 너무 큽니다. 최대: {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )


def _ext_from_filename(filename: str | None) -> str | None:
    if not filename or "." not in filename:
        return None
    return filename.rsplit(".", 1)[1].lower()


def resolve_ext(filename: str | None, content_type: str | None) -> str:
    """확장자 결정 우선순위: 파일명 확장자 → content_type 매핑 → 'bin'."""
    ext = _ext_from_filename(filename)
    if ext:
        return ext
    if content_type:
        return EXTENSION_MAP.get(content_type, "bin")
    return "bin"
