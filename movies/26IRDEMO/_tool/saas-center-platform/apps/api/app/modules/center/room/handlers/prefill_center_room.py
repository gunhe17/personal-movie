"""상담실 관리 화면 prefill — 대상 상담실이 지정되면 수정 창까지 연다 (필드는 URL로, DB 미접근)."""

from urllib.parse import urlencode

_PAGE = "/center/room"

_REF = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    "required": ["name"],
}


def prefill_center_room_handler(**fields):
    room = fields.get("room") or {}
    target = {k: v for k, v in [("room_id", room.get("id")), ("room_name", room.get("name"))] if v}
    if target:
        params = {"action": "edit", **target}
        if fields.get("name"):
            params["name"] = fields["name"]
        return {"page_path": f"{_PAGE}?{urlencode(params)}", "fields": {}}

    # room 미지정 = 신규 등록 — 등록 모달 자동 오픈 + 아는 값 채움
    params = {"action": "create"}
    if fields.get("name"):
        params["name"] = fields["name"]
    if fields.get("description"):
        params["description"] = fields["description"]
    if fields.get("memo"):
        params["memo"] = fields["memo"]
    return {"page_path": f"{_PAGE}?{urlencode(params)}", "fields": {}}


TOOL = {
    "name": "prefill_center_room_handler",
    "permission": "write:room",
    "page_path": _PAGE,
    "purpose": "상담실 관리 화면으로 이동한다 — 수정할 상담실이 지정되면 그 상담실의 수정 창을, 아니면 등록 창을 연다.",
    "keywords": ["상담실 관리", "상담실 등록", "상담실 수정", "상담실 이름 변경", "방 관리", "장소 관리"],
    "boundaries": "DB에 저장하지 않는다 — 화면과 등록/수정 창을 열고 채우기만 하며 저장은 사용자가 화면에서 직접 한다. 수정할 상담실은 먼저 query_room_handler로 id를 확인해 room에 {id, name}으로 넣는다(미지정이면 신규 등록으로 처리). 수정 시 description·memo 변경은 지원하지 않는다(이름만). 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 상담실 등록·변경을 원하면 즉시 호출.",
    "output": "이동한 화면 경로. 상담실 저장은 사용자가 화면에서 한다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "room": {**_REF, "description": "수정할 상담실 {id, name} — 없으면 신규 등록으로 처리"},
            "name": {"type": "string", "description": "새 상담실 이름 (등록) 또는 바꿀 이름 (수정)"},
            "description": {"type": "string", "description": "설명 — 등록 시에만 채워진다"},
            "memo": {"type": "string", "description": "메모 — 등록 시에만 채워진다"},
        },
        "required": [],
    },
}


def demo() -> None:
    assert prefill_center_room_handler()["page_path"] == "/center/room?action=create"
    assert prefill_center_room_handler(name="상담실3")["page_path"] == (
        "/center/room?action=create&name=%EC%83%81%EB%8B%B4%EC%8B%A43"
    )
    edit = prefill_center_room_handler(room={"id": "abc", "name": "상담실1"}, name="새이름")
    assert edit["page_path"] == (
        "/center/room?action=edit&room_id=abc&room_name=%EC%83%81%EB%8B%B4%EC%8B%A41&name=%EC%83%88%EC%9D%B4%EB%A6%84"
    )


if __name__ == "__main__":
    demo()
    print("ok")
