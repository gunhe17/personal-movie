from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import CounselingNoteCreate, CounselingNoteResponse
from ...facade import CounselingNoteFacade


async def create_note_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    client_id: str,
    center_id: str,
    author_id: str,
    counselor_id: str | None,
    data: CounselingNoteCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingNoteResponse:
    facade = CounselingNoteFacade(uow)

    atomic, note = await facade.create_note(
        session_id=session_id,
        client_id=client_id,
        center_id=center_id,
        author_id=author_id,
        counselor_id=counselor_id,
        mood=data.content.mood if data.content else None,
        main_topic=data.content.main_topic if data.content else None,
        intervention=data.content.intervention if data.content else None,
        progress=data.content.progress if data.content else None,
        homework=data.content.homework if data.content else None,
        next_goal=data.content.next_goal if data.content else None,
        raw_notes=data.content.raw_notes if data.content else None,
        private_notes=data.content.private_notes if data.content else None,
        summary=data.summary,
    )
    await emit(
        uow,
        "counseling_note_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


    return CounselingNoteResponse.model_validate(note)


TOOL = {
    "name": 'create_note_handler',
    "permission": "write:counseling_note",
    "purpose": '상담 회기에 대한 상담 일지를 작성한다.',
    "keywords": ['create note', '상담 일지 작성', '노트 생성', '상담 기록', 'counseling note 생성'],
    "boundaries": "상담 일지 '작성'. 수정은 update_note_handler, 조회는 get_note_handler.",
    "output": '작성된 상담 일지 (CounselingNoteResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'session_id': {'type': 'string', 'format': 'uuid', 'title': '대상 회기', 'description': '일지를 작성할 상담 회기(세션)의 UUID.'},
            'client_id': {'type': 'string', 'format': 'uuid', 'title': '대상 내담자', 'description': '일지 대상 내담자의 UUID (그룹 회기면 특정 내담자).'},
            'content': {'$ref': '#/$defs/NoteContent', 'description': '상담 일지 내용(기분·주제·개입·과제 등 구조화 필드).'},
            'summary': {'anyOf': [{'maxLength': 1000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '일지 요약(선택).', 'title': '요약'},
        },
        "$defs": {'NoteContent': {'example': {'homework': '사고 기록지 작성', 'intervention': ['인지 재구성', '역할극'], 'main_topic': '직장 내 대인관계 갈등', 'mood': '우울감, 불안', 'next_goal': '대안적 사고 연습', 'progress': '자동적 사고 인식 향상', 'raw_notes': '오늘 상담에서...'}, 'properties': {'mood': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '내담자 기분/정서', 'title': 'Mood'}, 'main_topic': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '주요 주제', 'title': 'Main Topic'}, 'intervention': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'description': '사용한 개입 기법', 'title': 'Intervention'}, 'progress': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '진전 사항', 'title': 'Progress'}, 'homework': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '과제', 'title': 'Homework'}, 'next_goal': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '다음 회기 목표', 'title': 'Next Goal'}, 'raw_notes': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '자유 형식 노트', 'title': 'Raw Notes'}, 'private_notes': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '비공개 메모 (작성자만 열람)', 'title': 'Private Notes'}}, 'title': 'NoteContent', 'type': 'object'}},
        "required": ['session_id', 'client_id', 'content'],
    },
}
