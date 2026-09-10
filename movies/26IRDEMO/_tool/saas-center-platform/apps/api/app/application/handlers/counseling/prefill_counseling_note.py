"""상담 일지 작성 화면 prefill — 대상 회기는 서버가 정한다(읽기 전용, 저장 없음)."""

from urllib.parse import urlencode

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade import CounselingAgentFacade, CounselingNoteFacade

_PAGE = "/counseling/notes"

_REF = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    "required": ["name"],
}


async def prefill_counseling_note_handler(
    *,
    center_id: str,
    uow: UnitOfWork,
    client: dict | None = None,
    session_number: int | None = None,
    include_written: bool = False,
):
    client = client or {}
    if not client.get("id"):
        # 내담자 특정 실패 — 이름으로 거른 미작성 목록만 연다
        params = {"status": "missing"}
        if client.get("name"):
            params["keyword"] = client["name"]
        return {"page_path": f"{_PAGE}?{urlencode(params)}", "fields": {}}

    # 일지는 완료 회기에만 쓴다 — 제품의 미작성 판정과 동일 기준
    # (list_my_counseling_notes "missing: 완료 회기 × 내담자 중 노트 없는 페어")
    rows, _ = await CounselingAgentFacade(uow).query_session(
        center_id, client_id=client["id"], status="completed", limit=200
    )
    completed = list(rows)
    if session_number is not None:
        rows = [r for r in rows if r.get("session.session_number") == session_number]
    elif not include_written:
        written = await CounselingNoteFacade(uow).list_notes_by_sessions(
            [r["session.id"] for r in rows], center_id
        )
        done = {
            n.counseling_session_id
            for n in written
            if n.client_id == client["id"] and getattr(n, "deleted_at", None) is None
        }
        rows = [r for r in rows if r["session.id"] not in done]
        if not rows and completed:
            # 새로 쓸 건 없지만 고칠 건 있다 — 수정 의사는 사용자가 정한다(임의로 열지 않음)
            return {
                "error": {
                    "reason": f"{client.get('name', '해당 내담자')}의 완료 회기 "
                              f"{len(completed)}건은 일지가 모두 작성되어 있습니다.",
                    "next": "ask_user로 '이미 작성된 일지를 수정하시겠어요?'를 물으세요. "
                            "수정하겠다고 하면 include_written=true로 다시 호출하세요.",
                }
            }

    if not rows:
        # 빈 화면을 열고 "열었습니다"라고 하면 거짓 보고 — 사실을 돌려준다
        return {
            "error": {
                "reason": (
                    f"{client.get('name', '해당 내담자')}의 일지 작성 대상 회기가 없습니다."
                    if session_number is None
                    else f"{session_number}회기가 없거나 아직 완료되지 않았습니다."
                ),
                "note": "일지는 완료된 회기에만 씁니다.",
                "next": "사용자에게 그대로 알리세요. 화면은 열리지 않았습니다.",
            }
        }
    if len(rows) > 1:
        # 서버가 임의로 고르지 않는다 — 모호함은 사용자 몫(ask_user)
        return {
            "error": {
                "reason": (
                    "수정할 회기가 여럿이라 하나로 특정할 수 없습니다."
                    if include_written
                    else "일지 미작성 회기가 여럿이라 하나로 특정할 수 없습니다."
                ),
                "choices": [
                    {
                        "session_number": r.get("session.session_number"),
                        "label": r.get("session.schedule_name")
                        or f"{r.get('session.session_number')}회기",
                    }
                    for r in rows[:10]
                ],
                "next": "ask_user로 사용자에게 고르게 한 뒤 session_number로 다시 호출하세요.",
            }
        }

    row = rows[0]
    params = {
        "session_id": row["session.id"],
        "case_id": row["session.counseling_case_id"],
        "client_id": client["id"],
    }
    return {"page_path": f"{_PAGE}?{urlencode(params)}", "fields": {}}


TOOL = {
    "name": "prefill_counseling_note_handler",
    "permission": "write:counseling_note",
    "page_path": _PAGE,
    "purpose": "상담 일지(상담노트) 작성 화면을 연다 — 내담자를 넘기면 대상 회기는 서버가 정한다.",
    "keywords": ["상담 일지", "상담일지", "일지 작성", "상담노트 작성", "노트 작성", "회기 기록"],
    "boundaries": "DB에 저장하지 않는다 — 일지 작성 창을 열기만 하며 저장은 사용자가 화면에서 한다. 회기는 서버가 고른다(완료 회기 중 일지 미작성) — 회기를 직접 조회해 넘기지 않는다. 사용자가 회기 번호를 말했을 때만 session_number에 넣는다. 결과가 is_error면 그 안의 next 지시를 따른다 — 후보 다수면 ask_user로 회기를 고르게 하고, 이미 다 작성됐으면 ask_user로 수정 의사를 확인한 뒤에만 include_written=true로 다시 호출한다(확인 없이 쓰지 않는다). 상담 접수(새 상담 등록)는 prefill_counseling_receive_handler로 — 일지와 접수는 다른 화면이다.",
    "output": "이동한 화면 경로. 화면을 특정 못 하면 is_error로 reason·choices·next가 돌아온다. 일지 저장은 사용자 제출 시 일어난다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "client": {**_REF, "description": "일지 대상 내담자 {id, name}"},
            "session_number": {
                "type": "integer",
                "title": "회기 번호 — 사용자가 특정 회기를 말했을 때만",
            },
            "include_written": {
                "type": "boolean",
                "title": "이미 작성된 일지 수정 — 사용자가 수정하겠다고 답한 뒤에만 true",
            },
        },
        "required": [],
    },
}
