# prefill 표면 — LLM 입력을 프론트 폼으로 중개만 한다 (DB 미접근, 제출은 사용자 몫)
_PAGE = "/counseling/receive"

# 조회로 id를 확인한 뒤 {id, name}으로 넣는 참조형 필드
_REF = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    "required": ["name"],
}


def prefill_counseling_receive_handler(**fields):
    return {"page_path": _PAGE, "fields": fields}


TOOL = {
    "name": "prefill_counseling_receive_handler",
    "permission": "write:counseling",
    "page_path": _PAGE,
    # 종결-시멘틱 표면 — "행동"이 아니라 "턴 마무리"로 선언. 페어드 실측: 자발 완주 55%→85%
    # (Δ+30%p·p=.031·날조 0), 이름 변경(C팔)은 무효 (screen-claim-fabrication E3, 2026-07-29)
    "purpose": "등록·접수 요청의 턴 마무리 — 상담 접수 화면을 열고 아는 값을 미리 채운다. 조회를 마쳤으면 텍스트 보고로 끝내지 말고 이 도구를 호출한다.",
    "keywords": ["상담 접수", "상담 예약", "상담 등록", "폼 프리필"],
    "boundaries": "DB에 저장하지 않는다 — 접수 화면을 열고 채우기만 하며 제출은 화면에서 사용자 몫. 내담자·프로그램·상담사·상담실은 먼저 조회 도구로 id를 확인해 {id, name}으로 넣는다. 값이 부족해도 즉시 호출한다 — 빈 화면이 텍스트 안내보다 낫다.",
    "output": "이동한 화면 경로와 채운 필드 목록 — 이 호출의 결과 화면이 곧 사용자가 보는 완료 상태. 실제 접수는 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "client": {**_REF, "description": "내담자 {id, name}"},
            "program": {**_REF, "description": "프로그램 {id, name}"},
            "counselor": {**_REF, "description": "담당 상담사 {id, name}"},
            "room": {**_REF, "description": "상담실 {id, name}"},
            "date": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
            "start_time": {"type": "string", "description": "HH:MM"},
            "end_time": {"type": "string", "description": "HH:MM"},
            "memo": {"type": "string"},
        },
        "required": [],
    },
}
