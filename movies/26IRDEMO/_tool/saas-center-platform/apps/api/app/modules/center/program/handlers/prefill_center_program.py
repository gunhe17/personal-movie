"""프로그램 관리 화면 prefill — 등록 모달 자동 오픈 + 입력값 채움 (URL 쿼리파라미터로 전달, DB 미접근)."""

from urllib.parse import urlencode

# ?action=create — 도착 페이지 afterNavigate가 등록 모달을 자동 오픈하며 아래 파라미터를 읽어 채운다
# (web +page.svelte 계약). 도착 직후 replaceState로 쿼리 제거 — history에 안 남는다.
_PAGE = "/center/program"


def prefill_center_program_handler(**fields):
    params = {"action": "create"}
    if fields.get("name"):
        params["name"] = fields["name"]
    if fields.get("program_type"):
        params["program_type"] = fields["program_type"]
    if fields.get("price") is not None:
        params["price"] = fields["price"]
    if fields.get("duration_minutes") is not None:
        params["duration_minutes"] = fields["duration_minutes"]
    return {"page_path": f"{_PAGE}?{urlencode(params)}", "fields": {}}


TOOL = {
    "name": "prefill_center_program_handler",
    "permission": "write:program",
    "page_path": f"{_PAGE}?action=create",
    "purpose": "프로그램 등록 화면을 열고 입력값을 미리 채운다.",
    "keywords": ["프로그램 관리", "프로그램 등록", "프로그램 화면", "폼 프리필"],
    "boundaries": "DB에 저장하지 않는다 — 등록 모달을 열고 채우기만 하며 저장은 사용자가 화면에서 직접 한다. 수정 대상 지정은 지원하지 않는다(신규 등록만). 아는 값만 채운다. 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 화면 열기를 원하면 즉시 호출.",
    "output": "이동한 화면 경로와 채운 필드 목록. 실제 저장은 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "프로그램명"},
            "program_type": {"type": "string", "enum": ["INDIVIDUAL", "GROUP"], "description": "개별/그룹"},
            "price": {"type": "integer", "description": "가격 (원)"},
            "duration_minutes": {"type": "integer", "description": "소요 시간 (분)"},
        },
        "required": [],
    },
}


def demo() -> None:
    assert prefill_center_program_handler()["page_path"] == "/center/program?action=create"
    filled = prefill_center_program_handler(
        name="집단상담A", program_type="GROUP", price=50000, duration_minutes=60
    )
    assert filled["page_path"] == (
        "/center/program?action=create&name=%EC%A7%91%EB%8B%A8%EC%83%81%EB%8B%B4A"
        "&program_type=GROUP&price=50000&duration_minutes=60"
    )


if __name__ == "__main__":
    demo()
    print("ok")
