# prefill 표면 — LLM 입력을 프론트 폼으로 중개만 한다 (DB 미접근, 제출은 사용자 몫)
_PAGE = "/assessment/receive"

_REF = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    "required": ["name"],
}


def prefill_assessment_receive_handler(**fields):
    return {"page_path": _PAGE, "fields": fields}


TOOL = {
    "name": "prefill_assessment_receive_handler",
    "permission": "write:assessment_case",
    "page_path": _PAGE,
    "purpose": "검사 접수 화면을 열고 입력값을 미리 채운다.",
    "keywords": ["검사 접수", "검사 예약", "심리검사 등록", "폼 프리필"],
    "boundaries": "DB에 저장하지 않는다 — 접수 화면을 열고 채우기만 한다. 검사 항목·패키지 선택은 화면에서 사용자가 직접 한다. 기존 내담자·검사자·장소는 먼저 조회 도구로 id를 확인해 {id, name}으로 넣는다. 아직 등록되지 않은 사람은 client_type=group + group_members에 이름·생년월일·성별·보호자연락처로 넣는다(조회 불필요). 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 화면 열기를 원하면 즉시 호출.",
    "output": "이동한 화면 경로와 채운 필드 목록. 실제 접수는 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_type": {
                "type": "string",
                "enum": ["individual", "group"],
                "description": "개인 접수(individual) / 단체·기관 접수(group). 미지정 시 개인",
            },
            "organization": {
                **_REF,
                "description": "기관/단체 {id, name} — client_type=group일 때. 신규 기관이면 name만",
            },
            "group_members": {
                "type": "array",
                "description": "단체 명단 — 기존 내담자가 아니어도 된다(신규는 id 없이 이름만으로 얹힌다)",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "birthDate": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
                        "gender": {"type": "string", "enum": ["male", "female"]},
                        "guardianPhone": {"type": "string", "description": "보호자 연락처"},
                    },
                    "required": ["name"],
                },
            },
            "client": {**_REF, "description": "내담자 {id, name} — 개인 접수일 때"},
            "counselor": {**_REF, "description": "담당 검사자 {id, name}"},
            "room": {**_REF, "description": "장소 {id, name}"},
            "date": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
            "start_time": {"type": "string", "description": "HH:MM"},
            "end_time": {"type": "string", "description": "HH:MM"},
            "memo": {"type": "string"},
        },
        "required": [],
    },
}
