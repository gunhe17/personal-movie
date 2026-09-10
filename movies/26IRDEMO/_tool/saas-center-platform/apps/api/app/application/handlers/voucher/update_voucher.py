from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.voucher.schemas import (
    AdminVoucherDetailResponse,
    AdminVoucherDocumentRef,
    AdminVoucherUpdateRequest,
)
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.voucher.models import Voucher
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

async def update_voucher_handler(
    *,
    voucher_id: str,
    data: AdminVoucherUpdateRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminVoucherDetailResponse:
    voucher = await VoucherFacade(uow).update_voucher(
        voucher_id,
        # 미전달 필드는 facade unset 기본값 적용(omit vs None 구분)
        **data.model_dump(exclude_unset=True),
    )

    await emit(
        uow,
        "voucher_updated",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="updated",
            _entity_name="voucher",
            _entity_id=voucher.id,
            _payload={"data": {"id": voucher.id, "name": voucher.name}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return await _build_voucher_detail(voucher, uow=uow)


TOOL = {
    "name": 'update_voucher_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '운영자가 바우처 카탈로그 항목을 수정한다.',
    "keywords": ['update voucher', '바우처 수정', '이용권 수정', '바우처 정의 변경', 'voucher 수정'],
    "boundaries": "운영자 전용 — 바우처 '정의' 수정. 생성은 create_voucher_handler, 삭제는 delete_voucher_handler.",
    "output": '수정된 바우처 정의 (AdminVoucherDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'voucher_id': {'type': 'string', 'format': 'uuid', 'title': '대상 바우처', 'description': '수정할 바우처 정의의 UUID.'},
            'name': {'anyOf': [{'maxLength': 255, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '바우처명', 'description': '바우처 이름(미지정 시 유지).'},
            'program_name': {'anyOf': [{'maxLength': 255, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사업명', 'description': '지원 사업 이름(미지정 시 유지).'},
            'program_organization': {'anyOf': [{'maxLength': 255, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '주관 기관', 'description': '주관 기관(미지정 시 유지).'},
            'program_year': {'anyOf': [{'maximum': 2999, 'minimum': 1900, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '사업 연도', 'description': '사업 연도(미지정 시 유지).'},
            'usage_start_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사용 시작일', 'description': '사용 시작일(미지정 시 유지).'},
            'usage_end_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사용 종료일', 'description': '사용 종료일(미지정 시 유지).'},
            'application_method': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '신청 방법', 'description': '신청 방법(미지정 시 유지).'},
            'application_start_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '신청 시작일', 'description': '신청 시작일(미지정 시 유지).'},
            'application_end_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '신청 종료일', 'description': '신청 종료일(미지정 시 유지).'},
            'support_amount': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '지원 금액', 'description': '지원 금액 정보(미지정 시 유지).'},
            'support_scope': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '지원 범위', 'description': '지원 범위(미지정 시 유지).'},
            'support_target': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '지원 대상', 'description': '지원 대상(미지정 시 유지).'},
            'contact': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '문의처', 'description': '문의 연락처(미지정 시 유지).'},
        },
        "required": ['voucher_id'],
    },
}
