from app.core.type import uuid_str
from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentSetFacade
from app.modules.assessment.assessment_set.schemas import (
    AssessmentSetUpdate,
    AssessmentSetResponse,
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


async def update_set_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    set_id: str,
    data: AssessmentSetUpdate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> AssessmentSetResponse:
    center_member_summary = None
    if data.center_member_ids:
        center_member_summary = await _build_member_summary(
            uow, data.center_member_ids
        )

    facade = AssessmentSetFacade(uow)
    atomic, assessment_set = await facade.update_set(
        center_id,
        set_id,
        name=data.name,
        description=data.description,
        assessment_ids=data.assessment_ids,
        center_member_ids=data.center_member_ids,
        center_member_summary=center_member_summary,
        changed=data.model_dump(mode="json", exclude_unset=True),
    )
    await emit(
        uow,
        "assessment_set_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSetResponse.model_validate(assessment_set)


TOOL = {
    "name": 'update_set_handler',
    "permission": "write:assessment_case",
    "purpose": '검사 세트를 수정한다.',
    "keywords": ['update set', '세트 수정', '검사 세트 변경', 'set 편집', '검사 모음 수정'],
    "boundaries": "검사 '세트' 수정. 생성은 create_set_handler, 패키지 수정은 update_package_handler.",
    "output": '수정된 검사 세트 (AssessmentSetResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'set_id': {'type': 'string', 'format': 'uuid', 'title': '대상 세트', 'description': '수정할 검사 세트의 UUID.'},
            'name': {'anyOf': [{'maxLength': 255, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '세트명', 'description': '세트 이름(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '설명(미지정 시 유지).'},
            'assessment_ids': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '검사 목록', 'description': '포함 검사 UUID 목록(전체 교체, 미지정 시 유지).'},
            'center_member_ids': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '공유 멤버', 'description': '공유 멤버 UUID 목록(미지정 시 유지).'},
        },
        "required": ['set_id'],
    },
}
