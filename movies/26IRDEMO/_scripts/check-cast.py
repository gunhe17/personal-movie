#!/usr/bin/env python3
"""배역 일치 점검 — python3 _scripts/check-cast.py

마인드봄의 촬영 배역(scripts/cast.py)이 마인드스코프 develop 시드와 같은 사람인지 본다.
한 영상에서 두 제품을 오가므로, 이름은 같은데 생년월일이 다르면 같은 사람이 아니게 된다.
저쪽(saas)이 정본이다 — 어긋나면 마인드봄 cast.py를 고친다.
"""
import ast
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAAS = ROOT / "_tool/saas-center-platform/apps/api/scripts/seed/develop"
CAST = ROOT / "_tool/mindbom/apps/api/scripts/cast.py"


def literals(path: Path) -> dict:
    """모듈을 실행하지 않고 최상위 대입값만 꺼낸다. date(y,m,d) 호출만 예외로 계산한다."""
    def value(node):
        if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "date":
            return date(*[ast.literal_eval(a) for a in node.args])
        if isinstance(node, (ast.List, ast.Tuple)):
            return [value(e) for e in node.elts]
        if isinstance(node, ast.Dict):
            return {ast.literal_eval(k): value(v) for k, v in zip(node.keys, node.values)}
        return ast.literal_eval(node)

    out = {}
    for stmt in ast.parse(path.read_text()).body:
        if isinstance(stmt, ast.Assign) and isinstance(stmt.targets[0], ast.Name):
            try:
                out[stmt.targets[0].id] = value(stmt.value)
            except (ValueError, TypeError, AttributeError):
                pass    # 계산이 필요한 값은 배역표가 아니다 — 넘어간다
    return out


for p in (SAAS, CAST):
    if not p.exists():
        sys.exit(f"없음: {p} — _tool 사본이 있어야 점검할 수 있다")

saas_center = literals(SAAS / "center.py")["CENTER_DATA"]
saas_accounts = {a["email"]: a for a in literals(SAAS / "account.py")["ACCOUNTS"]}
saas_clients = {c["name"]: c for c in literals(SAAS / "client.py")["CLIENTS"]}

# 배역의 두 번째 원천 — s01(접수)이 촬영 중에 만드는 인물. 시드에 없는 것이 그 장면의 논지라서
# saas 시드에는 못 넣는다. 대신 목 대본의 명단이 정본이고, 마인드봄은 그 이름·생년월일을 따른다.
MOCK = ROOT / "_mocks/s01-intake.json"
if MOCK.exists():
    import json as _json
    for _turn in _json.loads(MOCK.read_text())["turns"]:
        for _tool in _turn.get("tools", []):
            for _m in (_tool.get("args") or {}).get("fields", {}).get("group_members", []) or []:
                y, mo, d = (int(x) for x in _m["birthDate"].split("-"))
                saas_clients[_m["name"]] = {"birth_date": date(y, mo, d), "gender": None, "_from_mock": True}
saas_password = literals(SAAS / "__init__.py")["DEFAULT_PASSWORD"]
cast = literals(CAST)

bad = []
cast_center = cast["INSTITUTION"]["name"]      # INSTITUTION_NAME은 파생값이라 여기서 안 읽힌다
if cast_center != saas_center["name"]:
    bad.append(f"기관 이름: {cast_center!r} ≠ {saas_center['name']!r}")
if cast["PASSWORD"] != saas_password:
    bad.append(f"비밀번호: {cast['PASSWORD']!r} ≠ {saas_password!r}")

for a in cast["ACCOUNTS"]:
    other = saas_accounts.get(a["email"])
    if other is None:
        bad.append(f"계정 {a['email']} — 마인드스코프에 없다")
    elif other["name"] != a["name"]:
        bad.append(f"계정 {a['email']} 이름: {a['name']!r} ≠ {other['name']!r}")

for c in cast["CLIENTS"]:
    other = saas_clients.get(c["name"])
    if other is None:
        bad.append(f"내담자 {c['name']} — 마인드스코프 시드에도 s01 목 대본에도 없다")
        continue
    for field in ("birth_date", "gender"):
        if other.get("_from_mock") and field == "gender":
            continue      # 목 대본은 성별을 넣지 않는다(최소 정보) — 이름·생년월일만 대조한다
        if c[field] != other[field]:
            bad.append(f"내담자 {c['name']} {field}: {c[field]} ≠ {other[field]}")

# 마인드봄 시드가 쓰는 검사 상태가 앱이 아는 상태인가.
# ai_analyzing처럼 앱에서 없앤 값을 시드가 쓰면 목록 화면이 통째로 깨진다
# (EXAM_STATUS_VISUAL[status]가 undefined → 렌더 중 예외). 촬영 전에 여기서 잡는다.
SEED = ROOT / "_tool/mindbom/apps/api/scripts/seed.py"
CONST = ROOT / "_tool/mindbom/apps/web/src/lib/features/examination/common/constants.ts"
if SEED.exists() and CONST.exists():
    union = CONST.read_text().split("export type ExamStatus")[1].split("\n\n")[0]
    known = set(re.findall(r"'([a-z_]+)'", union))
    used = set(re.findall(r'"status":\s*"([a-z_]+)"', SEED.read_text()))
    for st in sorted(used - known):
        bad.append(f"검사 상태 {st!r} — 앱의 ExamStatus에 없다 (목록 화면이 깨진다)")

if bad:
    print("배역 불일치 — saas develop 시드가 정본이다:")
    for b in bad:
        print(f"  · {b}")
    sys.exit(1)

print(f"ok — {cast_center} · 계정 {len(cast['ACCOUNTS'])} · 내담자 {len(cast['CLIENTS'])} · 비번 {cast['PASSWORD']} · 검사 상태 {len(used) if SEED.exists() else 0}종")
