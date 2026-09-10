"""청구 결제 화면 prefill — 청구서가 지정되면 납부 등록 창까지 연다 (URL로만, DB 미접근)."""

from urllib.parse import urlencode

_PAGE = "/billing"

_REF = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    "required": ["name"],
}


def prefill_billable_payment_handler(**fields):
    billable = fields.get("billable") or {}
    if billable.get("id"):
        params = {"billable_id": billable["id"], "action": "pay"}
        return {"page_path": f"{_PAGE}?{urlencode(params)}", "fields": {}}

    # id 미확보 = 청구서 특정 실패 — 이름으로 거른 목록만 열어 사용자가 고르게 한다
    params = {"search": billable["name"]} if billable.get("name") else {}
    path = f"{_PAGE}?{urlencode(params)}" if params else _PAGE
    return {"page_path": path, "fields": {}}


TOOL = {
    "name": "prefill_billable_payment_handler",
    "permission": "write:billing",
    "page_path": _PAGE,
    "purpose": "결제(납부) 화면을 연다 — 결제할 청구서가 지정되면 그 청구서의 납부 등록 창을 연다.",
    "keywords": ["결제", "결제 창", "결제하기", "납부", "수납", "미납 결제", "청구서 결제"],
    "boundaries": "DB에 저장하지 않는다 — 납부 등록 창을 열기만 하며 결제 확정은 사용자가 화면에서 한다. 결제할 청구서는 먼저 query_billable_handler로 id를 확인해 billable에 {id, name}으로 넣는다 — id가 없으면 이름으로 거른 청구 목록 화면만 연다. 납부 금액·수단·일시는 화면에서 정한다(금액 기본값 = 미수금 전액). 값이 없어도 호출해 화면만 열 수 있다 — 사용자가 결제를 원하면 즉시 호출.",
    "output": "이동한 화면 경로. 실제 납부 등록은 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "billable": {
                **_REF,
                "description": "결제할 청구서 {id, name} — name은 내담자 이름",
            },
        },
        "required": [],
    },
}


def demo() -> None:
    assert prefill_billable_payment_handler()["page_path"] == "/billing"
    assert prefill_billable_payment_handler(billable={"name": "윤서준"})["page_path"] == (
        "/billing?search=%EC%9C%A4%EC%84%9C%EC%A4%80"
    )
    pay = prefill_billable_payment_handler(billable={"id": "c2ba526c", "name": "윤서준"})
    assert pay["page_path"] == "/billing?billable_id=c2ba526c&action=pay"
    assert pay["fields"] == {}


if __name__ == "__main__":
    demo()
    print("ok")
