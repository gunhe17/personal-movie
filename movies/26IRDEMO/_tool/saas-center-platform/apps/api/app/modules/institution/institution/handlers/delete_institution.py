from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ... import DeleteInstitutionService
from ..repository import InstitutionRepository


async def delete_institution_handler(
    institution_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> None:
    repo = uow.repo(InstitutionRepository)
    service = DeleteInstitutionService(repo)
    atomic, _institution = await service.execute(institution_id)
    await emit(
        uow,
        "institution_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_institution_handler",
    "permission": None,
    "purpose": "지정한 기관 한 곳을 전역 참조 테이블에서 삭제한다.",
    "keywords": ["기관 삭제", "병원 삭제", "기관 제거", "거래처 삭제", "협력기관 빼기", "institution 삭제", "기관 마스터 삭제", "등록 취소"],
    "boundaries": "기관 레코드를 '없애는' 전용 도구다. 정보만 바꾸려면 update_institution_handler, 존재·내용 확인은 get_institution_handler, 목록은 list_institutions_handler를 쓴다. 삭제는 되돌릴 수 없으니 institution_id를 정확히 지정해야 하며 로그인한 사용자만 호출할 수 있다.",
    "output": "없음 (기관 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "institution_id": {"type": "string", "format": "uuid", "title": "대상 기관", "description": "삭제할 기관의 UUID."},
        },
        "required": ["institution_id"],
    },
}
