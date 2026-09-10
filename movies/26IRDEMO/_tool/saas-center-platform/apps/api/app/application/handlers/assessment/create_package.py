from app.core.type import uuid_str
from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentPackageFacade
from app.modules.assessment.assessment_package.schemas import (
    AssessmentPackageCreate,
    AssessmentPackageResponse,
)



async def _build_member_summary(
    uow: UnitOfWork,
    center_member_ids: list[str] | None,
) -> list[dict] | None:
    if not center_member_ids:
        return None

    from app.modules.center.facade import MemberFacade
    from app.modules.person.facade import PersonFacade

    member_map = await MemberFacade(uow).get_members_by_ids(center_member_ids)
    person_ids = [m.person_id for m in member_map.values()]
    person_map = await PersonFacade(uow).get_persons_by_ids(person_ids)

    summary = []
    for member_id in center_member_ids:
        member = member_map.get(member_id)
        if not member:
            continue
        person = person_map.get(member.person_id)
        if not person:
            continue
        summary.append({
            "member_id": member.id,
            "name": person.name,
            "snapshot_at": utc_now().isoformat(),
        })
    return summary


async def create_package_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: AssessmentPackageCreate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> AssessmentPackageResponse:
    center_member_summary = await _build_member_summary(
        uow, data.center_member_ids
    )

    facade = AssessmentPackageFacade(uow)
    atomic, assessment_package = await facade.create_package(
        center_id,
        name=data.name,
        assessment_ids=data.assessment_ids,
        description=data.description,
        center_member_ids=data.center_member_ids,
        center_member_summary=center_member_summary,
        package_price=data.package_price,
        is_active=data.is_active,
    )
    await emit(
        uow,
        "assessment_package_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentPackageResponse.model_validate(assessment_package)


TOOL = {
    "name": 'create_package_handler',
    "permission": "write:assessment_case",
    "purpose": '여러 검사를 묶은 검사 패키지를 생성한다.',
    "keywords": ['create package', '패키지 생성', '검사 묶음 만들기', '검사 패키지 추가', '세트 묶음', '검사 번들', 'package 생성'],
    "boundaries": "여러 검사를 하나로 묶는 '패키지' 생성. 검사 '세트'는 create_set_handler, 단일 검사 정의는 create_admin_assessment_handler. 수정은 update_package_handler.",
    "output": '생성된 검사 패키지 (AssessmentPackageResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'maxLength': 255, 'minLength': 1, 'title': '패키지명', 'type': 'string', 'description': '검사 패키지 이름.'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '패키지 설명(선택).'},
            'assessment_ids': {'items': {'type': 'string'}, 'minItems': 1, 'title': '검사 목록', 'type': 'array', 'description': '패키지에 포함할 검사 UUID 목록(최소 1개).'},
            'center_member_ids': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '공유 멤버', 'description': '패키지를 공유할 멤버 UUID 목록(선택).'},
            'package_price': {'anyOf': [{'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '패키지 가격', 'description': '패키지 가격(원, 선택).'},
            'is_active': {'default': True, 'title': '활성 여부', 'type': 'boolean', 'description': '활성 여부(기본 True).'},
        },
        "required": ['name', 'assessment_ids'],
    },
}
