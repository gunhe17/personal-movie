"""내담자 등록 화면 prefill — LLM 입력을 프론트 폼으로 중개한다 (DB 미접근)."""

_PAGE = "/clients/register"


def prefill_client_register_handler(**fields):
    return {"page_path": _PAGE, "fields": fields}


TOOL = {
    "name": "prefill_client_register_handler",
    "permission": "write:client",
    "page_path": _PAGE,
    "purpose": "내담자 등록 화면을 열고 입력값을 미리 채운다.",
    "keywords": ["내담자 등록", "내담자 추가", "환자 등록", "폼 프리필"],
    "boundaries": "DB에 저장하지 않는다 — 등록 화면을 열고 채우기만 하며 제출은 사용자가 화면에서 직접 한다. 아는 값만 채운다. 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 화면 열기를 원하면 즉시 호출.",
    "output": "이동한 화면 경로와 채운 필드 목록. 실제 저장은 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "이름"},
            "birth": {"type": "string", "format": "date", "description": "생년월일 YYYY-MM-DD"},
            "gender": {"type": "string", "enum": ["MALE", "FEMALE"]},
            "phone": {"type": "string", "description": "연락처"},
            "email": {"type": "string"},
            "address": {"type": "string", "description": "주소"},
            "addressDetail": {"type": "string", "description": "상세주소"},
            "memo": {"type": "string"},
        },
        "required": [],
    },
}
