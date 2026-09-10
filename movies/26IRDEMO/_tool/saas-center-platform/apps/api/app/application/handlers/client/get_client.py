from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.facade.profile_facade import ProfileFacade
from app.modules.client.profile.schemas import ClientResponse


async def get_client_scoped_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    viewer_person_id: str | None = None,
    owner_scope: str | None = None,
) -> ClientResponse:
    # access_level=own이면 담당 내담자만 열람 — 목록 필터와 동일 기준으로 단건 접근도 막는다.
    # (목록에서 안 보이는 내담자를 URL 직접 접근으로 여는 격리 우회 차단)
    if owner_scope is not None:
        assigned = await _resolve_assigned_client_ids(center_id, owner_scope, uow)
        if client_id not in assigned:
            raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {client_id}")

    facade = ProfileFacade(uow)
    return await facade.get_with_response(
        center_id, client_id, viewer_person_id=viewer_person_id
    )


async def _resolve_assigned_client_ids(
    center_id: str,
    counselor_id: str,
    uow: UnitOfWork,
) -> set[str]:
    # 상담 + 검사 모듈의 담당 내담자(주담당+보조, 종료/탈퇴 포함) 집합을 union.
    # list_clients_handler와 동일 로직 인라인 — application 공유 `_` 파일 금지(§1-1, 중복 감수)
    from app.modules.counseling.facade import CounselingCaseFacade
    from app.modules.assessment.facade import AssessmentCaseFacade

    counseling_ids = await CounselingCaseFacade(uow).list_client_ids_by_counselor(
        center_id, counselor_id
    )
    assessment_ids = await AssessmentCaseFacade(uow).list_client_ids_by_counselor(
        center_id, counselor_id
    )
    return set(counseling_ids) | set(assessment_ids)


TOOL = {
    "name": "get_client_scoped_handler",
    "permission": None,
    "purpose": "내담자 한 건의 상세를 담당 범위(access_level) 검증과 함께 조회한다.",
    "keywords": ["내담자 조회", "고객 상세", "client 상세", "담당 내담자 조회"],
    "boundaries": "단건 내담자 조회(읽기, own 스코프 차단 포함). 목록은 list_clients_handler.",
    "output": "내담자 상세 (ClientResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자",
                          "description": "조회할 내담자의 UUID."},
        },
        "required": ["client_id"],
    },
}
