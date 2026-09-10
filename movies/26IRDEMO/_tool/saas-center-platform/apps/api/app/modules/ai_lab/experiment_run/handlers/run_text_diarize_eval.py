from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentFacade
from ..schemas import TextDiarizeEvalRequest, TextDiarizeEvalResponse
from app.modules.llm.facade.ai_facade import create_ai_facade


async def run_text_diarize_eval_handler(
    data: TextDiarizeEvalRequest,
    uow: UnitOfWork,
) -> TextDiarizeEvalResponse:
    result = await ExperimentFacade(uow, create_ai_facade()).run_text_diarize_eval(
        segments=[s.model_dump() for s in data.segments],
        input_segments=(
            [s.model_dump() for s in data.input_segments]
            if data.input_segments
            else None
        ),
        merge_gap=data.merge_gap,
        model_name=data.model_name,
        provider=data.provider,
        system_prompt=data.system_prompt,
    )
    return TextDiarizeEvalResponse(**result)


TOOL = {
    "name": 'run_text_diarize_eval_handler',
    "permission": None,
    "purpose": '텍스트 기반 화자분리 평가를 실행한다.',
    "keywords": ['텍스트 화자분리', 'diarize 평가', '화자 구분 평가', 'text diarize'],
    "boundaries": "텍스트 화자분리 '평가' 실행. 음성 화자분리 정확도는 calculate_diarization_accuracy_handler.",
    "output": '텍스트 화자분리 평가 결과 (TextDiarizeEvalResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'segments': {'items': {'$ref': '#/$defs/TextDiarizeEvalSegment'}, 'title': '정답 세그먼트', 'type': 'array', 'description': '화자·텍스트가 라벨된 정답(reference) 세그먼트 목록.'},
            'input_segments': {'anyOf': [{'items': {'$ref': '#/$defs/TextDiarizeEvalInputSegment'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'title': '입력 세그먼트', 'description': '화자분리 대상 입력 세그먼트(선택).'},
            'merge_gap': {'default': 0.0, 'title': '병합 간격', 'type': 'number', 'description': '인접 세그먼트 병합 허용 간격(초, 기본 0).'},
            'model_name': {'default': 'gpt-4.1', 'title': '모델', 'type': 'string', 'description': 'LLM 모델명(기본 gpt-4.1).'},
            'provider': {'default': 'openai', 'title': '제공자', 'type': 'string', 'description': '모델 제공자(기본 openai).'},
            'system_prompt': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시스템 프롬프트', 'description': '시스템 프롬프트(선택).'},
        },
        "$defs": {'TextDiarizeEvalInputSegment': {'properties': {'text': {'title': 'Text', 'type': 'string'}, 'start': {'default': 0.0, 'title': 'Start', 'type': 'number'}, 'end': {'default': 0.0, 'title': 'End', 'type': 'number'}}, 'required': ['text'], 'title': 'TextDiarizeEvalInputSegment', 'type': 'object'}, 'TextDiarizeEvalSegment': {'properties': {'speaker': {'title': 'Speaker', 'type': 'string'}, 'text': {'title': 'Text', 'type': 'string'}, 'start': {'default': 0.0, 'title': 'Start', 'type': 'number'}, 'end': {'default': 0.0, 'title': 'End', 'type': 'number'}}, 'required': ['speaker', 'text'], 'title': 'TextDiarizeEvalSegment', 'type': 'object'}},
        "required": ['segments'],
    },
}
