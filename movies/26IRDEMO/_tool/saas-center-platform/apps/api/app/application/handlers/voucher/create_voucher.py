# write 는 voucher 모듈(VoucherFacade)이 소유. admin 은 조율·감사만.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.voucher.facade.voucher_facade import VoucherFacade

from app.modules.platform_admin.voucher.schemas import (
    AdminVoucherCreateRequest,
    AdminVoucherDetailResponse,
    AdminVoucherDocumentRef,
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

async def create_voucher_handler(
    *,
    data: AdminVoucherCreateRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> AdminVoucherDetailResponse:
    facade = VoucherFacade(uow)

    voucher = await facade.create_voucher(
        **data.model_dump(exclude={"document_links"})
    )

    atomics = [AdminAuditAtomic(
        _act="created",
        _entity_name="voucher",
        _entity_id=voucher.id,
        _payload={"data": {"id": voucher.id, "name": voucher.name, "program_year": voucher.program_year}},
    )]

    # 멱등: 중복 링크는 스킵.
    for payload in data.document_links:
        link, created = await facade.link_document(
            voucher_id=voucher.id,
            global_document_id=payload.global_document_id,
            page_range=payload.page_range,
        )
        if created:
            atomics.append(AdminAuditAtomic(
                _act="created",
                _entity_name="voucher_document",
                _entity_id=link.id,
                _payload={"data": {"id": link.id, "voucher_id": voucher.id, "global_document_id": payload.global_document_id}},
            ))

    await emit(
        uow,
        "voucher_created",
        event_group_id=event_group_id,
        atomics=atomics,
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return await _build_voucher_detail(voucher, uow=uow)


TOOL = {
    "name": 'create_voucher_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '운영자가 바우처(이용권) 카탈로그 항목을 생성한다.',
    "keywords": ['create voucher', '바우처 정의 생성', '이용권 등록', '바우처 카탈로그 추가', 'voucher 정의'],
    "boundaries": "운영자 전용 — 바우처 '정의'를 만든다. 내담자 발급은 create_client_voucher_handler. 수정은 update_voucher_handler.",
    "output": '생성된 바우처 정의 (AdminVoucherDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'maxLength': 255, 'title': '바우처명', 'type': 'string', 'description': '바우처 이름.'},
            'program_name': {'maxLength': 255, 'title': '사업명', 'type': 'string', 'description': '지원 사업 이름.'},
            'program_organization': {'maxLength': 255, 'title': '주관 기관', 'type': 'string', 'description': '사업 주관 기관.'},
            'program_year': {'maximum': 2999, 'minimum': 1900, 'title': '사업 연도', 'type': 'integer', 'description': '사업 연도.'},
            'usage_start_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사용 시작일', 'description': '사용 가능 시작일(선택).'},
            'usage_end_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사용 종료일', 'description': '사용 가능 종료일(선택).'},
            'application_method': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '신청 방법', 'description': '신청 방법(선택).'},
            'application_start_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '신청 시작일', 'description': '신청 시작일(선택).'},
            'application_end_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '신청 종료일', 'description': '신청 종료일(선택).'},
            'support_amount': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '지원 금액', 'description': '지원 금액 정보(구조화, 선택).'},
            'support_scope': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '지원 범위', 'description': '지원 범위(선택).'},
            'support_target': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '지원 대상', 'description': '지원 대상(선택).'},
            'contact': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '문의처', 'description': '문의 연락처(선택).'},
            'document_links': {'items': {'$ref': '#/$defs/AdminVoucherCreateLinkPayload'}, 'title': '연결 문서', 'type': 'array', 'description': '연결할 안내 문서(global_document) 목록.'},
        },
        "$defs": {'AdminVoucherCreateLinkPayload': {'properties': {'global_document_id': {'title': 'Global Document Id', 'type': 'string'}, 'page_range': {'anyOf': [{'maxItems': 2, 'minItems': 2, 'prefixItems': [{'type': 'integer'}, {'type': 'integer'}], 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': 'Page Range'}}, 'required': ['global_document_id'], 'title': 'AdminVoucherCreateLinkPayload', 'type': 'object'}},
        "required": ['name', 'program_name', 'program_organization', 'program_year'],
    },
}
