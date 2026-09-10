_PAGE = "/operation/receive"

_REF = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    "required": ["name"],
}


def prefill_operation_receive_handler(**fields):
    return {"page_path": _PAGE, "fields": fields}


TOOL = {
    "name": "prefill_operation_receive_handler",
    "permission": "write:schedule",
    "page_path": _PAGE,
    "purpose": "운영 일정(회의·공간차단) 접수 화면을 열고 입력값을 미리 채운다.",
    "keywords": ["운영 일정", "회의 등록", "공간 차단", "폼 프리필"],
    "boundaries": "DB에 저장하지 않는다 — 화면을 열고 채우기만 한다. 상담·검사 일정이 아닌 회의/공간차단 등 운영 일정용. 장소는 먼저 조회 도구로 id를 확인해 {id, name}으로 넣는다. 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 화면 열기를 원하면 즉시 호출.",
    "output": "이동한 화면 경로와 채운 필드 목록. 실제 등록은 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "제목"},
            "room": {**_REF, "description": "장소 {id, name}"},
            "date": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
            "start_time": {"type": "string", "description": "HH:MM"},
            "end_time": {"type": "string", "description": "HH:MM"},
            "memo": {"type": "string"},
        },
        "required": [],
    },
}
