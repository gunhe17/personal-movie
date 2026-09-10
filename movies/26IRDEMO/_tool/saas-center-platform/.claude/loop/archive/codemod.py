"""behavior 전환 codemod — 라우터의 레거시 인증(dependencies/security)을 behavior flow로 일괄 치환.

사용: 모듈 라우터 경로를 인자로. 항상 적용 후 import-check + 라이브 reload + smoke(401) 검증.
한계(수동 처리): 이 스크립트는 정규식 기반이라 아래는 못 잡는다 —
  - ctx와 uow가 비인접(사이에 storage 등 다른 dep) → paired regex 미스 → unpaired uow가 use_public ctx로 바뀌어 duplicate ctx 발생.
    → fix_duplicate_ctx()가 ast로 후처리(중요: ast.parse는 dup arg를 안 잡고 compile만 잡으니, import-check 말고 compile()로 검증).
  - current_center(X, mode=...) 같은 추가 인자 → _auth(\\1)이 mode= 통과 못함.
  - 라우터레벨 dependencies=[...] gate, ctx-object 핸들러(permissions_version/access_level 필요).

flow 선택:
  - center-CRUD(current_center)              → convert_center()  (use_auth, system no-auth endpoint은 use_public)
  - account(current_account)                 → 수동 use_account (handler가 current_user.X 쓰면 ctx.X로)
  - admin 1A(get_current_admin 게이트, 핸들러 전달 안함) → convert_admin_gate()  (use_admin, role 데코 레거시 유지)
  - admin 1B(require_admin_role 데코만, 파라미터에 uow만)  → convert_admin_role_only()  (uow dep을 use_admin ctx로)
  - admin cat2(current_admin을 핸들러에 전달)  → convert_admin_keep_dict()  (get_current_admin 유지 + use_admin ctx만 추가)
"""
import sys, re, ast, pathlib

CENTER_HELPER = '''def _auth(permission=None, feature=None):
    requires = [server.require_authentication(), server.require_center(), server.require_permission_version()]
    if permission:
        requires.append(server.require_permission(permission))
    if feature:
        requires.append(server.require_feature(feature))
    return server.use_auth(*requires)


'''


def _add_import(s):
    if "from app.behavior.server import Context, server" not in s:
        s = s.replace("from fastapi import",
                      "from app.behavior.server import Context, server\nfrom fastapi import", 1)
    return s


def _uow_to_ctx(s):
    # uow= (kwarg) 보호하며 bare uow -> ctx.uow
    s = s.replace("uow=", "\x00=")
    s = re.sub(r"\buow\b", "ctx.uow", s)
    return s.replace("\x00=", "uow=")


def convert_center(s):
    s = re.sub(r"from app\.dependencies\.common\.context import CenterContext\n", "", s)
    s = re.sub(r"from app\.dependencies\.current\.center import current_center\n", "", s)
    s = re.sub(r"from app\.infrastructure\.persistence\.unit_of_work import UnitOfWork, get_uow\n", "", s)
    s = _add_import(s)
    # 1) paired ctx+uow -> _auth (인접한 uow만 제거)
    s = re.sub(r": CenterContext = Depends\(current_center\(([^)]*)\)\),\n[ \t]*uow: UnitOfWork = Depends\(get_uow\),",
               r": Context = Depends(_auth(\1)),", s)
    # 2) 비인접 center ctx (uow 다른 줄) fallback
    s = s.replace(": CenterContext = Depends(current_center(", ": Context = Depends(_auth(")
    # 3) 남은 unpaired uow (system/no-auth endpoint) -> use_public
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\),", "ctx: Context = Depends(server.use_public()),", s)
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\)", "ctx: Context = Depends(server.use_public())", s)
    s = _uow_to_ctx(s)
    s = s.replace("ctx.member_id", "ctx.actor_id")
    if "_auth(" in s and "def _auth(" not in s:
        s = re.sub(r"(?m)^([A-Za-z_]\w* = APIRouter\()", CENTER_HELPER + r"\1", s, count=1)
    return s


def convert_admin_gate(s):
    """1A: get_current_admin이 게이트로만 쓰임(핸들러 전달 안함)."""
    s = _add_import(s)
    s = s.replace("current_admin: dict = Depends(get_current_admin),",
                  "ctx: Context = Depends(server.use_admin(server.require_admin_auth())),")
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\),", "ctx: Context = Depends(server.use_admin(server.require_admin_auth())),", s)
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\)", "ctx: Context = Depends(server.use_admin(server.require_admin_auth()))", s)
    return _uow_to_ctx(s)


def convert_admin_role_only(s):
    """1B: require_admin_role 데코만, 파라미터엔 uow뿐. uow dep을 use_admin ctx로(role 데코는 레거시 유지)."""
    s = _add_import(s)
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\),", "ctx: Context = Depends(server.use_admin(server.require_admin_auth())),", s)
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\)", "ctx: Context = Depends(server.use_admin(server.require_admin_auth()))", s)
    return _uow_to_ctx(s)


def convert_admin_keep_dict(s):
    """cat2: current_admin을 핸들러에 넘김 → get_current_admin 유지, uow만 use_admin ctx로."""
    s = _add_import(s)
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\),", "ctx: Context = Depends(server.use_admin(server.require_admin_auth())),", s)
    s = re.sub(r"uow: UnitOfWork = Depends\(get_uow\)", "ctx: Context = Depends(server.use_admin(server.require_admin_auth()))", s)
    return _uow_to_ctx(s)


def fix_duplicate_ctx(path):
    """paired regex가 비인접 ctx/uow를 놓쳐 ctx 인자가 2개 생긴 함수에서 use_public ctx 줄 제거."""
    src = pathlib.Path(path).read_text()
    lines = src.split("\n")
    drop = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
            names = [a.arg for a in node.args.args + node.args.kwonlyargs]
            if names.count("ctx") >= 2:
                start = node.lineno - 1
                end = max(n.lineno for n in ast.walk(node) if hasattr(n, "lineno"))
                for i in range(start, end):
                    if "ctx: Context = Depends(server.use_public())" in lines[i]:
                        drop.add(i)
    if drop:
        pathlib.Path(path).write_text("\n".join(l for i, l in enumerate(lines) if i not in drop))
    return len(drop)


CONVERTERS = {
    "center": convert_center,
    "admin-gate": convert_admin_gate,
    "admin-role": convert_admin_role_only,
    "admin-keep-dict": convert_admin_keep_dict,
}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"usage: python codemod.py <{'|'.join(CONVERTERS)}> <router.py> [router2.py ...]")
        sys.exit(1)
    fn = CONVERTERS[sys.argv[1]]
    for p in sys.argv[2:]:
        src = pathlib.Path(p).read_text()
        pathlib.Path(p).write_text(fn(src))
        d = fix_duplicate_ctx(p)
        try:
            compile(pathlib.Path(p).read_text(), p, "exec")
            print(f"OK   {p} (dup-fixed {d})")
        except SyntaxError as e:
            print(f"ERR  {p}: {e}")
