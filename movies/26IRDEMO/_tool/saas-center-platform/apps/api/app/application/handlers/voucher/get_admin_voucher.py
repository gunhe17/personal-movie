# 운영자 바우처 상세 — voucher + global_document 크로스모듈 조립(_compose)이라 application 소유
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.voucher.models import Voucher
from app.modules.platform_admin.voucher.schemas import (
    AdminVoucherDetailResponse,
    AdminVoucherDocumentRef,
)
from app.infrastructure.persistence.range import to_tuple


async def _build_voucher_detail(
    voucher: Voucher,
    *,
    uow: UnitOfWork,
) -> AdminVoucherDetailResponse:
    # voucher의 연결 문서는 voucher_documents → global_documents로 조회. 서식(부속 서식)도
    # 별도 개념 없이 연결된 자료의 한 종류(이미지 global_document)로 documents에 그대로 포함.
    links = await VoucherFacade(uow).list_documents_by_voucher(voucher.id)

    docs_by_id = {}
    if links:
        ids = [link.global_document_id for link in links]
        gdoc_facade = GlobalDocumentFacade(uow)
        rows = await gdoc_facade.get_many(ids)
        docs_by_id = {d.id: d for d in rows}

    refs: list[AdminVoucherDocumentRef] = []
    for link in links:
        doc = docs_by_id.get(link.global_document_id)
        if doc is None:
            continue
        refs.append(
            AdminVoucherDocumentRef(
                id=doc.id,
                name=doc.name,
                file_type=doc.file_type,
                page_range=to_tuple(link.page_range),
                deleted_at=doc.deleted_at,
            )
        )

    response = AdminVoucherDetailResponse.model_validate(voucher)
    response.documents = refs
    return response


async def get_admin_voucher_handler(
    voucher_id: str,
    uow: UnitOfWork,
) -> AdminVoucherDetailResponse:
    voucher = await VoucherFacade(uow).verify_voucher_exists(voucher_id)
    return await _build_voucher_detail(voucher, uow=uow)
