"""센터 정보 수정 화면 prefill — LLM 입력을 프론트 폼으로 중개한다 (DB 미접근)."""

_PAGE = "/center/info"


def prefill_center_info_handler(**fields):
    return {"page_path": _PAGE, "fields": fields}


TOOL = {
    "name": "prefill_center_info_handler",
    "permission": "write:center",
    "page_path": _PAGE,
    "purpose": "센터 정보 수정 화면을 열고 입력값을 미리 채운다.",
    "keywords": ["센터 정보", "센터 수정", "센터 설정", "폼 프리필"],
    "boundaries": "DB에 저장하지 않는다 — 화면을 열고 채우기만 하며 제출은 사용자가 화면에서 직접 한다. 아는 값만 채운다. 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 화면 열기를 원하면 즉시 호출.",
    "output": "이동한 화면 경로와 채운 필드 목록. 실제 저장은 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "centerName": {"type": "string", "description": "센터명"},
            "ownerName": {"type": "string", "description": "대표자"},
            "businessNumber": {"type": "string", "description": "사업자등록번호"},
            "zipCode": {"type": "string", "description": "우편번호"},
            "address": {"type": "string"},
            "addressDetail": {"type": "string"},
            "phonePrefix": {"type": "string", "description": "전화 지역번호"},
            "phoneBody": {"type": "string", "description": "전화 뒷자리"},
        },
        "required": [],
    },
}
