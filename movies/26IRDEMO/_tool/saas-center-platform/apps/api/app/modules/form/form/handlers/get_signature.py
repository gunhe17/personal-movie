from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.signature.schemas import SignatureResponse


async def get_signature_handler(
    signature_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> SignatureResponse:
    facade = FormFacade(uow)
    response = await facade.get_signature_with_response(
        signature_id=signature_id,
        center_id=center_id,
    )
    return response


TOOL = {
    "name": "get_signature_handler",
    "permission": "read:form_instance",
    "purpose": "폼 서명 한 건을 조회한다.",
    "keywords": ["서명 조회", "사인 확인", "signature 조회"],
    "boundaries": "단건 서명 조회(읽기). 등록은 create_signature_handler.",
    "output": "폼 서명 상세 (SignatureResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "signature_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 서명",
                "description": "조회할 서명의 UUID.",
            },
        },
        "required": ["signature_id"],
    },
}
