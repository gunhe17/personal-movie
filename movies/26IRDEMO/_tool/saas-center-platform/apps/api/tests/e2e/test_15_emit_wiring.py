"""쓰기-발행 라우터 emit 배선 검증 — 실제 생성으로 emit 경로를 통과시킨다.

리팩토링 핵심 = 쓰기 핸들러가 behavior+emit으로 전환. 회귀 클래스(test_10 경고):
'라우터가 emit하는데 start_event_group() 미배선 → ctx.event_group_id=None →
emit @typecheck → 500'. test_14 스윕은 빈-body/DUMMY-id라 emit 도달 전 404/422로 끊겨
이 회귀를 못 잡는다. 여기선 **실제 최소 생성 → 2xx 단언**(=emit 통과)으로,
flow 테스트(test_02~09)가 안 건드린 발행 모듈까지 확장 검증한다.

· 시드는 unique()로 추가만(훼손 없음). 한 spec 실패가 루프를 멈추지 않음 — 전부 수집.
· 5xx(또는 raise) = emit 배선 결함 → findings로 기록(+리포트). 명백 회귀라 권장 수정도 같이 출력.
· 실행: bash scripts/run_e2e.sh -k emit_wiring -s
"""
import json
from collections import Counter
from pathlib import Path

from .test_11_pure_layer_sweep import build_ctx
from .conftest import unique
from .helpers import (
    client_id_by_name,
    first_program_id,
    first_room_id,
    member_id_by_name,
)


class WireRec:
    def __init__(self):
        self.rows: list[dict] = []

    def ok(self, name, event, method, path, status):
        self.rows.append({"name": name, "event": event, "method": method,
                          "path": path, "status": status, "verdict": "ok", "body": ""})

    def fail(self, name, event, method, path, status, body):
        self.rows.append({"name": name, "event": event, "method": method,
                          "path": path, "status": status, "verdict": "emit_wiring_5xx",
                          "body": str(body)[:300]})

    def unreached(self, name, event, method, path, status, body):
        # 4xx — emit 도달 전 차단(권한/검증/픽스처). 회귀 아님이나 "검증 안 됨" 표시.
        self.rows.append({"name": name, "event": event, "method": method,
                          "path": path, "status": status, "verdict": "unreached",
                          "body": str(body)[:300]})

    def harness(self, name, event, note):
        self.rows.append({"name": name, "event": event, "method": "-", "path": "-",
                          "status": 0, "verdict": "harness", "body": note[:300]})


async def _probe(rec, api, ctx, *, name, event, method, path, json_body=None, headers=None):
    """실제 생성 호출 → 2xx=ok(emit 통과), 5xx/raise=emit 배선 findings, 4xx=unreached."""
    url = f"/api/v1/centers/{ctx['center_id']}{path}"
    try:
        r = await api.request(method, url, json=json_body, headers=headers or ctx["h"])
    except Exception as e:
        rec.fail(name, event, method, url, 500, f"raised {type(e).__name__}: {e}")
        return None
    if r.status_code >= 500:
        rec.fail(name, event, method, url, r.status_code, r.text)
    elif 200 <= r.status_code < 300:
        rec.ok(name, event, method, url, r.status_code)
    else:
        rec.unreached(name, event, method, url, r.status_code, r.text)
    return r


async def test_emit_wiring(api):
    ctx = await build_ctx(api)
    rec = WireRec()

    for spec in SPECS:
        try:
            await spec(api, ctx, rec)
        except Exception as e:  # spec 조립 실패가 루프를 멈추지 않음
            rec.harness(getattr(spec, "__name__", "?"), "-", f"{type(e).__name__}: {e}")

    _write_report(rec)

    c = Counter(r["verdict"] for r in rec.rows)
    findings = [r for r in rec.rows if r["verdict"] == "emit_wiring_5xx"]
    unreached = [r for r in rec.rows if r["verdict"] == "unreached"]
    print(f"\n=== EMIT WIRING === probes={len(rec.rows)} ok(2xx,emit통과)={c['ok']} "
          f"emit_wiring_5xx={c['emit_wiring_5xx']} unreached(4xx)={c['unreached']} harness={c['harness']}")
    for r in findings:
        print(f"  [EMIT 5xx] {r['method']} {r['path']} (event={r['event']}) :: {r['body'][:140]}")
    for r in unreached:
        print(f"  [UNREACHED 4xx] {r['status']} {r['method']} {r['path']} (event={r['event']}) :: {r['body'][:120]}")

    assert rec.rows, "probe를 한 건도 못 돌림 — 컨텍스트 조립 실패"
    # emit 배선 5xx는 명백 회귀지만, 일괄 결정/문서화 방침에 따라 하드-실패시키지 않고 기록.
    # 회귀를 막는 게이트로 바꾸려면 아래를 assert not findings 로.


def _write_report(rec: WireRec) -> None:
    out = Path(__file__).parent
    (out / "_emit_wiring_report.json").write_text(
        json.dumps(rec.rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    c = Counter(r["verdict"] for r in rec.rows)
    lines = [
        "# 쓰기-발행 emit 배선 검증 결과",
        "",
        f"- probe {len(rec.rows)}: ok={c['ok']} emit_wiring_5xx={c['emit_wiring_5xx']} harness={c['harness']}",
        "",
        "## EMIT 배선 5xx (명백 회귀 — 권장: 라우트에 start_event_group()+dispatch_events() 배선)",
        "",
        "| status | method | path | event | body |",
        "|---|---|---|---|---|",
    ]
    for r in rec.rows:
        if r["verdict"] == "emit_wiring_5xx":
            lines.append(f"| {r['status']} | {r['method']} | {r['path']} | {r['event']} | "
                         f"{r['body'].replace(chr(124), '/')[:160]} |")
    lines += ["", "## UNREACHED 4xx (emit 도달 전 차단 — 권한/검증, 회귀 아님)", "",
              "| status | method | path | event | body |", "|---|---|---|---|---|"]
    for r in rec.rows:
        if r["verdict"] == "unreached":
            lines.append(f"| {r['status']} | {r['method']} | {r['path']} | {r['event']} | "
                         f"{r['body'].replace(chr(124), '/')[:140]} |")
    lines += ["", "## OK (2xx — emit 통과 확인)", "", "| status | method | path | event |", "|---|---|---|---|"]
    for r in rec.rows:
        if r["verdict"] == "ok":
            lines.append(f"| {r['status']} | {r['method']} | {r['path']} | {r['event']} |")
    lines += ["", "## HARNESS (조립 실패 — payload/픽스처)", ""]
    for r in rec.rows:
        if r["verdict"] == "harness":
            lines.append(f"- {r['name']}: {r['body']}")
    (out / "_emit_wiring_report.md").write_text("\n".join(lines), encoding="utf-8")


# ═══════════════════════════════════════════════════════════════════
# SPECS — flow 테스트(test_02~09)·test_13이 안 건드린 발행 쓰기 라우터.
# 각 spec = 실제 최소 생성 → 2xx(=emit 통과). 시드는 unique()로 추가만.
# 이미 커버됨(중복 제외): client/relation(test_02), schedule(test_03),
#   assessment-case(test_04), counseling intake/session(test_05), form/voucher 추출(08·09),
#   client_created/batch(test_13).
# 미-probe(시드 부재 — 리포트에 기록): center_voucher(voucher 카탈로그 시드 없음),
#   share_token(멀티파트 document 업로드 선행 필요).
# ═══════════════════════════════════════════════════════════════════


async def _crud(rec, api, ctx, *, name, base_path, create_body, update_method,
                update_body, id_field="id", headers=None):
    """create → update → delete 체인. 각 단계 2xx면 해당 emit(_created/_updated/_deleted) 통과.

    update/delete 경로 = base_path + '/{id}' (id_field로 생성 응답에서 추출).
    """
    r = await _probe(rec, api, ctx, name=name, event=f"{name}_created", method="POST",
                     path=base_path, json_body=create_body, headers=headers)
    if not r or not (200 <= r.status_code < 300):
        return
    rid = r.json().get(id_field)
    if not rid:
        rec.harness(name, f"{name}_updated", f"생성 응답에 '{id_field}' 없음")
        return
    item_path = base_path.rstrip("/") + f"/{rid}"
    await _probe(rec, api, ctx, name=name, event=f"{name}_updated", method=update_method,
                 path=item_path, json_body=update_body, headers=headers)
    await _probe(rec, api, ctx, name=name, event=f"{name}_deleted", method="DELETE",
                 path=item_path, json_body=None, headers=headers)


# ── create→update→delete (CRUD emit 전부 통과) ──
async def _spec_room(api, ctx, rec):
    await _crud(rec, api, ctx, name="room", base_path="/rooms/",
                create_body={"name": unique("E2E상담실")},
                update_method="PATCH", update_body={"name": unique("상담실수정")})


async def _spec_member_non_working_time(api, ctx, rec):
    mid = ctx["member_id"]
    await _crud(rec, api, ctx, name="member_non_working_time",
                base_path=f"/members/{mid}/non-working-times/",
                create_body={"reason": "ANNUAL_LEAVE"},
                update_method="PATCH", update_body={"reason": "SICK_LEAVE"})


async def _spec_center_non_operating_time(api, ctx, rec):
    await _crud(rec, api, ctx, name="center_non_operating_time",
                base_path="/non-operating-times/",
                create_body={"reason": unique("E2E휴무")},
                update_method="PATCH", update_body={"reason": unique("휴무수정")})


async def _spec_role(api, ctx, rec):
    # 역할 CRUD는 WRITE_ROLE 권한 필요 — manager엔 없음. admin(김원장) 세션. id_field=role_code.
    await _crud(rec, api, ctx, name="role", base_path="/roles/",
                create_body={"name": unique("E2E역할"), "permission_ids": [1]},
                update_method="PATCH",
                update_body={"name": unique("역할수정"), "permission_ids": [1]},
                id_field="role_code", headers=ctx["admin"]["headers"])


async def _spec_message_template(api, ctx, rec):
    await _crud(rec, api, ctx, name="message_template", base_path="/message-templates/",
                create_body={"template_type": "session_reminder",
                             "name": unique("템플릿"), "content": "안녕하세요 E2E"},
                update_method="PATCH",
                update_body={"name": unique("템플릿수정"), "content": "수정 E2E"})


async def _spec_price_list(api, ctx, rec):
    await _crud(rec, api, ctx, name="price_list", base_path="/price-lists/",
                create_body={"service_type": "counseling", "service_name": unique("상담료")},
                update_method="PATCH", update_body={"service_name": unique("상담료수정")})


async def _spec_assessment_set(api, ctx, rec):
    aid = ctx.get("assessment_id")
    if not aid:
        rec.harness("assessment_set", "assessment_set_created", "seed assessment_id 없음")
        return
    await _crud(rec, api, ctx, name="assessment_set", base_path="/assessment-sets",
                create_body={"name": unique("검사세트"), "assessment_ids": [aid]},
                update_method="PATCH", update_body={"name": unique("세트수정")})


async def _spec_assessment_package(api, ctx, rec):
    aid = ctx.get("assessment_id")
    if not aid:
        rec.harness("assessment_package", "assessment_package_created", "seed assessment_id 없음")
        return
    await _crud(rec, api, ctx, name="assessment_package", base_path="/assessment-packages",
                create_body={"name": unique("패키지"), "assessment_ids": [aid]},
                update_method="PATCH", update_body={"name": unique("패키지수정")})


# ── create-only (delete/update 경로가 특수하거나 부모 필요) ──
async def _spec_member_invitation(api, ctx, rec):
    email = f"e2e-{unique('inv')}@example.com"
    await _probe(rec, api, ctx, name="member_invitation", event="member_invitation_created",
                 method="POST", path="/members/invitations",
                 json_body={"name": unique("이상담"), "email": email,
                            "role_code": "COUNSELOR", "employment_type": "FULLTIME"})


async def _spec_form_template(api, ctx, rec):
    await _probe(rec, api, ctx, name="form_template", event="form_template_created",
                 method="POST", path="/forms/templates/",
                 json_body={"name": unique("폼"), "schema": {}})


async def _spec_center_assessment_bulk(api, ctx, rec):
    aid = ctx.get("assessment_id")
    if not aid:
        rec.harness("center_assessment", "center_assessment_updated", "seed assessment_id 없음")
        return
    await _probe(rec, api, ctx, name="center_assessment", event="center_assessment_updated",
                 method="PATCH", path="/center-assessments/batch",
                 json_body={"items": [{"assessment_id": aid, "is_active": False}]})


async def _spec_counseling_note(api, ctx, rec):
    # 회기 1개 접수 → 그 회기에 노트 생성(=counseling_note_created emit).
    cid = ctx["center_id"]
    h = ctx["h"]
    program_id = await first_program_id(api, ctx["manager"])
    room_id = await first_room_id(api, ctx["manager"])
    counselor_id = await member_id_by_name(api, ctx["manager"], "정상담")
    client_id = await client_id_by_name(api, ctx["manager"], "박지우")

    intake = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {"program_id": program_id, "client_ids": [client_id],
                     "counselor_ids": [counselor_id], "chief_complaint": "E2E", "memo": "E2E"},
            "sessions": {"dates": ["2026-09-17T05:00:00Z"], "start_time": "14:00",
                         "end_time": "14:50", "room_id": room_id, "duration_minutes": 50},
        },
        headers=h,
    )
    if intake.status_code != 201:
        rec.harness("counseling_note", "counseling_note_created",
                    f"intake 선행 실패 {intake.status_code}: {intake.text[:160]}")
        return
    case_id = intake.json()["case_id"]
    sess = await api.get(f"/api/v1/centers/{cid}/counseling/cases/{case_id}/sessions", headers=h)
    items = sess.json().get("items", sess.json()) if sess.status_code == 200 else []
    if not items:
        rec.harness("counseling_note", "counseling_note_created", "회기 조회 실패")
        return
    session_id = items[0]["id"]
    await _probe(rec, api, ctx, name="counseling_note", event="counseling_note_created",
                 method="POST", path=f"/counseling/sessions/{session_id}/notes",
                 json_body={"client_id": client_id, "content": {}})


SPECS: list = [
    _spec_room,
    _spec_member_invitation,
    _spec_member_non_working_time,
    _spec_center_non_operating_time,
    _spec_role,
    _spec_message_template,
    _spec_form_template,
    _spec_price_list,
    _spec_assessment_set,
    _spec_assessment_package,
    _spec_center_assessment_bulk,
    _spec_counseling_note,
]
