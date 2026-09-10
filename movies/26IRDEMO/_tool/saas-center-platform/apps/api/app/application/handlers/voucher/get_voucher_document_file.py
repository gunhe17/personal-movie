# CORS 회피용 서버 프록시. 권한 체인은 voucher 가 검증(center_voucher → catalog
# → voucher_document), global_document 파일 메타/경로는 document 루트 facade 가 제공.
from urllib.parse import quote

from fastapi.responses import StreamingResponse

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade

# 내부 산출물 — 센터엔 노출하지 않는다.
_INTERNAL_FILE_TYPES = {"md"}

_EXT_MEDIA_TYPE = {
    "pdf": "application/pdf",
    "hwpx": "application/vnd.hancom.hwpx",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "md": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
}


def _media_type(file_type: str | None) -> str:
    return _EXT_MEDIA_TYPE.get((file_type or "").lower(), "application/octet-stream")


async def get_voucher_document_file_handler(
    center_id: str,
    center_voucher_id: str,
    global_document_id: str,
    uow: UnitOfWork,
) -> StreamingResponse:
    storage = get_storage_client()
    await CenterVoucherFacade(uow).verify_voucher_document_link(
        center_id=center_id,
        center_voucher_id=center_voucher_id,
        global_document_id=global_document_id,
    )
    docs = await GlobalDocumentFacade(uow).get_many([global_document_id])

    doc = docs[0] if docs else None
    if doc is None:
        raise EntityNotFoundException(f"GlobalDocument not found: {global_document_id}")
    if doc.file_type in _INTERNAL_FILE_TYPES:
        raise EntityNotFoundException("내부 산출물은 제공되지 않습니다")
    if not doc.storage_path:
        raise EntityNotFoundException("첨부 파일이 없는 자료입니다")

    file_data = await storage.download_file(path=doc.storage_path)

    file_type = doc.file_type or ""
    display_name = doc.original_name or doc.name
    if file_type and not display_name.lower().endswith(f".{file_type}"):
        display_name = f"{display_name}.{file_type}"

    encoded = quote(display_name, safe="")
    ascii_fallback = (
        display_name.encode("ascii", "ignore").decode("ascii") or "voucher-file"
    )

    return StreamingResponse(
        iter([file_data]),
        media_type=_media_type(file_type),
        headers={
            "Content-Disposition": (
                f"inline; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"
            ),
            "Content-Length": str(len(file_data)),
        },
    )


TOOL = {
    "name": "get_voucher_document_file_handler",
    "permission": "read:voucher",
    "purpose": "바우처에 첨부된 문서 파일을 내려받는다.",
    "keywords": [
        "get voucher document file",
        "바우처 문서 다운로드",
        "이용권 파일",
        "바우처 첨부 다운로드",
        "voucher document 파일",
    ],
    "boundaries": "바우처 첨부 문서 '파일'을 스트리밍 다운로드한다. 문서 목록은 get_voucher_documents_handler.",
    "output": "바우처 첨부 문서 파일 스트림 (StreamingResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터 바우처",
                "description": "센터 바우처의 UUID.",
            },
            "global_document_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 문서",
                "description": "내려받을 문서의 UUID.",
            },
        },
        "required": ["center_voucher_id", "global_document_id"],
    },
}
