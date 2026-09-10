from app.core.type import uuid_str
from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentPackageFacade
from app.modules.assessment.assessment_package.schemas import (
    AssessmentPackageUpdate,
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


async def update_package_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    package_id: str,
    data: AssessmentPackageUpdate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> AssessmentPackageResponse:
    center_member_summary = None
    if data.center_member_ids:
        center_member_summary = await _build_member_summary(
            uow, data.center_member_ids
        )

    facade = AssessmentPackageFacade(uow)
    atomic, assessment_package = await facade.update_package(
        center_id,
        package_id,
        name=data.name,
        description=data.description,
        assessment_ids=data.assessment_ids,
        center_member_ids=data.center_member_ids,
        center_member_summary=center_member_summary,
        package_price=data.package_price,
        is_active=data.is_active,
        changed=data.model_dump(mode="json", exclude_unset=True),
    )
    await emit(
        uow,
        "assessment_package_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentPackageResponse.model_validate(assessment_package)


TOOL = {
    "name": 'update_package_handler',
    "permission": "write:assessment_case",
    "purpose": '검사 패키지를 수정한다.',
    "keywords": ['update package', '패키지 수정', '검사 묶음 변경', 'package 편집', '번들 수정'],
    "boundaries": "검사 '패키지' 수정. 생성은 create_package_handler, 세트 수정은 update_set_handler.",
    "output": '수정된 검사 패키지 (AssessmentPackageResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'package_id': {'type': 'string', 'format': 'uuid', 'title': '대상 패키지', 'description': '수정할 검사 패키지의 UUID.'},
            'name': {'anyOf': [{'maxLength': 255, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '패키지명', 'description': '패키지 이름(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '설명(미지정 시 유지).'},
            'assessment_ids': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '검사 목록', 'description': '포함 검사 UUID 목록(전체 교체, 미지정 시 유지).'},
            'center_member_ids': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '공유 멤버', 'description': '공유 멤버 UUID 목록(미지정 시 유지).'},
            'package_price': {'anyOf': [{'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '패키지 가격', 'description': '패키지 가격(원, 미지정 시 유지).'},
            'is_active': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'title': '활성 여부', 'description': '활성 여부(미지정 시 유지).'},
        },
        "required": ['package_id'],
    },
}
