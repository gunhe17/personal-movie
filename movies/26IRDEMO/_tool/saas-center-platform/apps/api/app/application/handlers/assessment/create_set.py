from app.core.type import uuid_str
from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentSetFacade
from app.modules.assessment.assessment_set.schemas import (
    AssessmentSetCreate,
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


async def create_set_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: AssessmentSetCreate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> AssessmentSetResponse:
    center_member_summary = await _build_member_summary(
        uow, data.center_member_ids
    )

    facade = AssessmentSetFacade(uow)
    atomic, assessment_set = await facade.create_set(
        center_id,
        name=data.name,
        assessment_ids=data.assessment_ids,
        description=data.description,
        center_member_ids=data.center_member_ids,
        center_member_summary=center_member_summary,
    )
    await emit(
        uow,
        "assessment_set_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return AssessmentSetResponse.model_validate(assessment_set)


TOOL = {
    "name": 'create_set_handler',
    "permission": "write:assessment_case",
    "purpose": '여러 검사를 묶은 검사 세트를 생성한다.',
    "keywords": ['create set', '세트 생성', '검사 세트 만들기', '검사 그룹', 'set 생성', '검사 모음 추가', '세트 등록'],
    "boundaries": "검사 '세트' 생성. 검사 '패키지'는 create_package_handler. 수정은 update_set_handler.",
    "output": '생성된 검사 세트 (AssessmentSetResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'maxLength': 255, 'minLength': 1, 'title': '세트명', 'type': 'string', 'description': '검사 세트 이름.'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '세트 설명(선택).'},
            'assessment_ids': {'items': {'type': 'string'}, 'minItems': 1, 'title': '검사 목록', 'type': 'array', 'description': '세트에 포함할 검사 UUID 목록(최소 1개).'},
            'center_member_ids': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '공유 멤버', 'description': '세트를 공유할 멤버 UUID 목록(선택).'},
        },
        "required": ['name', 'assessment_ids'],
    },
}
