"""총체 쿼리 감사 — ① 필터 커버리지 ② 투영 커버리지(D14) ③ 관계 필터 완결.

① 모델 컬럼 × 아키타입 유도 규칙 = 있어야 할 필터. 신규 컬럼 추가 시 누락이 여기서 잡힌다.
② 선언된 참조 간선(모델 info 마커, nav+다형)의 표시명이 기본 투영(facade DEFAULT ∪
   handler 인라인 PROJECTION 상수)에 동반돼야 한다(agent-query.md '행 적재 판정' D14).
③ 관계 필터 완결: 자기 FK 마커 ∪ 소유 관계 테이블 far-side ∪ 다형 마커 − accounts WAIVER
   가 TOOL 필터 id에 전부 있어야 한다(슬롯 혼동 구조 봉쇄).

  uv run python scripts/audit_query_filters.py            # 갭 리포트 (있으면 exit 1)
"""

import ast
import pathlib
import importlib
import sys

from app.runtime.assistant.context import TOOL_MODEL

# 시스템/주입 — 항상 제외
SYSTEM_COLS = {"id", "center_id", "created_at", "updated_at", "deleted_at"}

# 본문·파생·표시용 아키타입 — 필터 무의미 (naming.md 유도 규칙 '필터 없음' 행)
NON_FILTERABLE = {
    "schema", "definition", "participant_snapshot", "session_rule", "speaker_map",
    "refined_transcript", "nonverbal_markers", "analysis", "documents",
    "assessment_summary", "institution_summary", "set_summary",
    "checksum", "storage_path", "task_id", "reference_id",
    "profile_image_url", "thumbnail_url", "external_url", "logo_url",
    "careers", "certifications", "educations", "color",
    "cancel_reason", "inactive_reason", "description", "content",
    "failed_step", "processing_step",
    # 시각(time-of-day) — 근무·운영시간의 시:분 값. 질의 대상 아님(요일로 거름), 기본 투영에만
    "start_time", "end_time", "break_start_time", "break_end_time",
    "open_time", "close_time",
    # denorm 요약 JSONB (assessment_summary와 동류) — 필터·기본투영 무의미
    "center_member_summary",
    # 파이프라인 세부 상태 (status/processing_status가 대표)
    "diarization_status", "refine_status", "summary_status", "transcribe_status",
    "note_status", "refinement_model", "summary_model", "summary_generated_at",
    "note_template_type", "note_number", "total_duration",
    "submitted_by", "uploader_id", "recipient_id",
    # 참조 중 체이닝 수요 미실측 — 발화 확인 시 승격
    "person_id", "role_id", "member_id", "invited_by", "created_by",
}

# 의미 별칭 — TOOL의 이 param이 모델의 저 컬럼을 커버
ALIASES: dict[str, set[str]] = {
    "keyword": {
        "memo", "summary", "content", "chief_complaint", "title", "description", "body",
        "reason", "decision_note",  # 일정 변경 요청 사유·결정 메모
        "message", "error_message",  # 문자 발송 본문·오류 메시지
    },
    "date_from": {"start", "end", "billable_date", "date"},  # 무표 시간축
    "date_to": {"start", "end", "billable_date", "date"},
    "name": {"kor_name", "eng_name", "original_name"},
    "amount_min": {"total_amount"},
    "duration_min": {"duration_minutes", "duration"},
    "price_min": {"unit_price"},  # 수치 개념명(가격) — 컬럼 unit_price. _min/_max 쌍(시점 _from/_to 아님)
}

# 잔여 waiver — 구현 불가/부적격 사유 명시
WAIVERS: dict[str, set[str]] = {
    # age: 표기 텍스트("만 6세~") — 수치 아키타입 아님. duration: 동일(표기 텍스트)
    # status: private/public = 글로벌 공개범위(admin) — 센터 에이전트 무관(센터는 활성화한 검사만 봄)
    "query_assessment_handler": {"age", "duration", "status"},
    # paid/discount/subsidy: unpaid·total로 질의 충분 — 발화 실측 시 승격
    "query_billable_handler": {"discount_amount", "paid_amount", "subsidy_amount"},
    # 특수 표면 — 도메인 특정 본문·denorm(필터 무의미) + 판단성 필터(발화 실측 후 승격, 다시 논의 대상)
    "query_notice_handler": {"attachments", "is_published"},  # 첨부(본문) · is_published=센터 표면 발행분 고정(초안 비노출 스코프)
    "query_notification_handler": {"data", "event_ref", "read_at"},  # json meta·이벤트 시스템참조 · read_at=is_read로 충분(중복)
    # valid_from: 유효 시작일 — 발화 드묾(만료 valid_until이 대표 축). 발화 실측 시 승격
    "query_client_voucher_handler": {"valid_from"},
    # current_*/requested_end: 변경 전 현재 시각·요청 종료(대표 축=requested_start만 필터) · decided_*: 결재 시각/결재자로 거름 드묾
    "query_schedule_change_request_handler": {
        "current_start", "current_end", "requested_end", "decided_at", "decided_by_member_id",
    },
    # failed_at: 실패 시각(대표 축=sent_at) · lgu_message_id: 외부 게이트웨이 id(시스템) · send_*/form_send: 발송연계 참조(신원 WAIVER와 동류, 발화 무의미)
    "query_message_log_handler": {
        "failed_at", "lgu_message_id", "send_link_id", "send_result_id", "form_send_id",
    },
}


def covered(
    col: str,
    props: set[str],
) -> bool:
    if col in props:
        return True
    stem = col.removesuffix("_at").removesuffix("_date")
    pairs = [f"{stem}_from", f"{col}_min", f"{stem}_min", col.rstrip("s") + "_ids", f"{col}s"]
    if any(p in props for p in pairs):
        return True
    return any(alias in props and col in cols for alias, cols in ALIASES.items())


# ── ② 투영 커버리지 (D14) ─────────────────────────────────────────────────

# tool → (handler 모듈 경로 — 인라인 PROJECTION 상수 소유, facade 기본투영 상수 접근자 (module, attr[, dict key]))
# handler_mod = app.query.* (SQL 슬라이스). accessor의 DEFAULT_FIELDS는 대개 없음 →
# _defaults_of가 select() 라벨 − opt_in 으로 기본 투영을 AST 복원(query.md §1-1).
TOOL_PROJECTION = {
    "query_client_handler": ("app.query.client", ("app.query.client", "DEFAULT_FIELDS", None)),
    "query_member_handler": ("app.query.member", ("app.query.member", "DEFAULT_FIELDS", None)),
    "query_schedule_handler": ("app.query.schedule", ("app.query.schedule", "DEFAULT_FIELDS", None)),
    "query_case_handler": ("app.query.counseling_case", ("app.query.counseling_case", "DEFAULT_FIELDS", None)),
    "query_counseling_session_handler": ("app.query.counseling_session", ("app.query.counseling_session", "DEFAULT_FIELDS", None)),
    "query_counseling_note_handler": ("app.query.counseling_note", ("app.query.counseling_note", "DEFAULT_FIELDS", None)),
    "query_assessment_handler": ("app.query.assessment", ("app.query.assessment", "DEFAULT_FIELDS", None)),
    "query_assessment_case_handler": ("app.query.assessment_case", ("app.query.assessment_case", "DEFAULT_FIELDS", None)),
    "query_assessment_session_handler": ("app.query.assessment_session", ("app.query.assessment_session", "DEFAULT_FIELDS", None)),
    "query_billable_handler": ("app.query.billable", ("app.query.billable", "DEFAULT_FIELDS", None)),
    "query_price_list_handler": ("app.query.price_list", ("app.query.price_list", "DEFAULT_FIELDS", None)),
    "query_document_handler": ("app.query.document", ("app.query.document", "DEFAULT_FIELDS", None)),
    "query_form_template_handler": ("app.query.form_template", ("app.query.form_template", "DEFAULT_FIELDS", None)),
    "query_form_instance_handler": ("app.query.form_instance", ("app.query.form_instance", "DEFAULT_FIELDS", None)),
    "query_field_note_handler": ("app.query.field_note", ("app.query.field_note", "DEFAULT_FIELDS", None)),
    "query_institution_handler": ("app.query.institution", None),  # 간선 0
    "query_room_handler": ("app.query.room", None),  # 간선 0
    "query_program_handler": ("app.query.program", ("app.query.program", "DEFAULT_FIELDS", None)),
    "query_member_invitation_handler": ("app.query.member_invitation", ("app.query.member_invitation", "DEFAULT_FIELDS", None)),
    # 신설 참조 도구 (2026-07-31). scr은 "ref" 마커라 감사 미인식으로 제외(런타임 보장)
    "query_payment_handler": ("app.query.payment", ("app.query.payment", "DEFAULT_FIELDS", None)),
    "query_member_working_time_handler": ("app.query.member_working_time", ("app.query.member_working_time", "DEFAULT_FIELDS", None)),
    "query_client_voucher_handler": ("app.query.client_voucher", ("app.query.client_voucher", "DEFAULT_FIELDS", None)),
    "query_center_voucher_handler": ("app.query.center_voucher", ("app.query.center_voucher", "DEFAULT_FIELDS", None)),
}

# 간선 컬럼 → 표시명 필드 (기본 유도: {stem}_name — case류만 case_code 정본)
PROJECTION_NAME_OVERRIDES = {
    "counseling_case_id": "case_code",
    "case_id": "case_code",
}

# 정당 예외 — 사유 명시 (D14 WAIVERS)
PROJECTION_WAIVERS: dict[str, dict[str, str]] = {
    "query_client_handler": {"person_id": "name 자기 컬럼 보유 — person은 계정 연결용, 표시 평탄화 불요"},
    "query_member_handler": {"person_id": "name·phone 등 person 필드를 handler가 행에 직접 평탄화"},
    "query_billable_handler": {"created_by": "감사성 참조 — created_by_name은 available(발화 드묾)"},
    "query_price_list_handler": {"created_by": "감사성 참조 — created_by_name은 available"},
    "query_form_instance_handler": {"created_by": "감사성 참조 — 제출자(submitted_by)가 기본, created_by_name은 available"},
    "query_member_invitation_handler": {"member_id": "수락 후 자기 결과 참조 — invitation.name이 그 사람 표시명"},
    # created_by = accounts 신원 참조 — created_by_name은 available(발화 드묾), billable·price_list와 동일 관례
    "query_client_voucher_handler": {"created_by": "감사성 참조(accounts) — 발화 드묾"},
    "query_center_voucher_handler": {"created_by": "감사성 참조(accounts) — 발화 드묾"},
    "query_payment_handler": {"created_by": "감사성 참조(accounts) — 발화 드묾"},
    # event_ref류 개방 집합 다형(활동 대상)은 TOOL_MODEL 밖(activity·notification) — 여기 미등장
}


def _expected_name(col: str) -> str:
    if col in PROJECTION_NAME_OVERRIDES:
        return PROJECTION_NAME_OVERRIDES[col]
    return (col.removesuffix("_id") if col.endswith("_id") else col) + "_name"


def _opt_in_of(tree) -> tuple[str, ...]:
    """기본 출력에서 빼는 필드 — handler 안 `opt_in = (...)` 지역변수."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "opt_in" for t in node.targets):
            return tuple(e.value for e in node.value.elts)
    return ()


def _defaults_of(acc_mod: str, attr: str, key=None):
    """기본 투영 목록. 모듈 상수가 없으면 handler의 select() 라벨을 AST로 뽑는다.

    app/query/**는 출력 필드를 select()가 소유한다(query.md §1-1) — 상수 참조로는
    "무엇이 나오는가"가 반환부에서 안 읽히기 때문. 기본 투영 = 스키마 키 − opt_in.
    """
    module = importlib.import_module(acc_mod)
    const = getattr(module, attr, None)
    if const is not None:
        return const[key] if key is not None else const

    tree = ast.parse(pathlib.Path(module.__file__).read_text())
    for node in ast.walk(tree):
        # 출력 필드의 정본은 handler의 select() — 라벨이 곧 나갈 수 있는 전부(query.md §1-1)
        if not isinstance(node, ast.Call) or getattr(node.func, "id", "") != "select":
            continue
        labels = []
        for arg in node.args:
            if isinstance(arg, ast.Call) and getattr(arg.func, "attr", "") == "label":
                labels.append(arg.args[0].value)
            elif isinstance(arg, ast.Attribute):
                labels.append(arg.attr)
        if len(labels) < 3:  # 스코프 서브쿼리 등 작은 select는 건너뛴다
            continue
        opt_in = _opt_in_of(tree)
        return tuple(label for label in labels if label not in opt_in)
    raise AttributeError(f"{acc_mod}: {attr} 상수도 select() 라벨도 없다")


def projection_gaps() -> int:
    gaps = 0
    for name, (mod_path, cls) in TOOL_MODEL.items():
        model = getattr(importlib.import_module(mod_path), cls)
        ref_cols = [
            c.name for c in model.__table__.columns
            if c.info.get("reference_table_name") or c.info.get("reference_type_field")
        ]
        if not ref_cols:
            continue
        if name not in TOOL_PROJECTION:  # 투영 미등록 tool(신규 편입) — 투영 축은 별도 배선 대기
            continue
        handler_mod, accessor = TOOL_PROJECTION[name]
        if accessor is None:
            print(f"[투영갭] {name}: 간선 {ref_cols} 있으나 기본투영 접근자 미등록")
            gaps += len(ref_cols)
            continue
        acc_mod, attr, key = accessor
        defaults = _defaults_of(acc_mod, attr, key)
        # handler 인라인 계약 — 각 query handler 파일의 PROJECTION 상수(agent-query.md 조립 위치)
        spec_defaults = set(getattr(importlib.import_module(handler_mod), "PROJECTION", {}))
        waived = PROJECTION_WAIVERS.get(name, {})
        for col in ref_cols:
            if col in waived:
                continue
            want = _expected_name(col)
            if want not in defaults and want not in spec_defaults:
                print(f"[투영갭] {name.removesuffix('_handler'):32} {col} → {want} 기본투영/SPECS에 없음")
                gaps += 1
    return gaps


# ── ③ 계층 방향 (agent facade — 조립 위치 규칙) ──────────────────────────────

def layering_gaps() -> int:
    import pathlib
    import re

    gaps = 0
    root = pathlib.Path(__file__).resolve().parent.parent / "app" / "modules"
    for path in sorted(root.glob("*/facade/*agent_facade*.py")):
        owner = path.relative_to(root).parts[0]
        if owner == "agent":
            continue  # 구 agent 대화 모듈 — new-agent-rebuild 소관
        for i, line in enumerate(path.read_text().splitlines(), 1):
            if re.match(r"\s*from\s+app\.runtime\b", line):
                print(f"[계층갭] {path.name}:{i} 모듈→runtime 역방향: {line.strip()}")
                gaps += 1
            m = re.match(r"\s*from\s+app\.modules\.([a-z0-9_]+)\.facade\b", line)
            if m and m.group(1) != owner:
                print(f"[계층갭] {path.name}:{i} 타 모듈 facade import: {line.strip()}")
                gaps += 1

    # 모듈→application 역행 — router의 App Handler 배선(cross-module-write.md §1)만 정당
    for path in sorted(root.rglob("*.py")):
        rel = path.relative_to(root).as_posix()
        if (
            rel.startswith("agent/")           # 구 agent 대화 모듈 — new-agent-rebuild 소관
            or path.name in ("router.py", "router_legacy.py")
        ):
            continue
        for i, line in enumerate(path.read_text().splitlines(), 1):
            if re.match(r"\s*from\s+app\.application\b", line):
                print(f"[계층갭] modules/{rel}:{i} 모듈→application 역행: {line.strip()}")
                gaps += 1
    return gaps


# ── ④ facade 경계 (facade.md §4·eventing.md §4 — tx·Atomic 생성·private import) ──

FACADE_TX_WAIVERS: set[str] = set()  # send_result reject 이관 완료(2026-07-14)로 소진


def facade_boundary_gaps() -> int:
    import pathlib
    import re

    gaps = 0
    root = pathlib.Path(__file__).resolve().parent.parent / "app" / "modules"
    for path in sorted(root.glob("*/facade/*.py")):
        owner = path.relative_to(root).parts[0]
        if owner == "agent":
            continue  # F6 — 구 agent 대화 모듈(turn_store aow commit = F2 명문 예외 포함)
        for i, line in enumerate(path.read_text().splitlines(), 1):
            if (
                re.search(r"\.(flush|commit|rollback)\(", line)
                and path.name not in FACADE_TX_WAIVERS
            ):
                print(f"[경계갭] {path.name}:{i} facade tx 호출(호출자 소유): {line.strip()}")
                gaps += 1
            if re.search(r"\b[A-Z][A-Za-z]*Atomic(\.[a-z_]+)?\(", line):
                print(f"[경계갭] {path.name}:{i} facade Atomic 생성(service 소유): {line.strip()}")
                gaps += 1
            if re.search(r"from\s+[\w.]*\bservices\._", line):
                print(f"[경계갭] {path.name}:{i} service private import: {line.strip()}")
                gaps += 1
    return gaps


# ── ⑤ facade repo 위임 (facade.md §1 — repo 직접 호출 금지, Service 경유) ──────

# ── ⑥ 관계 필터 완결 (agent-query.md — 마커 유도 id 필터) ────────────────────

# accounts/admin_accounts 참조 — 신원 계층, 에이전트 무관
ACCOUNT_WAIVER_TABLES = {"accounts", "admin_accounts"}

# 참조 대상이 안정 enum code 보유 → raw id 아니라 code로 필터(agent-query.md 안정 식별자 이중키).
# 분류가 참조를 이긴다 — 모델은 코드(MANAGER)를 쥐지 UUID를 쥐지 않는다. handler가 code→id 해소.
CODE_REFERENCE = {"roles": "role_code"}

# 소유 관계 테이블 far-side — 자기 컬럼이 아니라 junction/participant가 보유.
# 키 = TOOL name, 값 = 노출해야 할 필터 id(단수 형태). counselor_id = program_members.member_id 어휘.
OWNED_RELATION_FAR_SIDE: dict[str, set[str]] = {
    "query_case_handler": {"client_id"},  # counseling_case_participants
    "query_counseling_session_handler": {"client_id"},  # participant → case 경유 (J2)
    "query_assessment_case_handler": {"client_id"},  # assessment_case_participants
    "query_assessment_session_handler": {"client_id"},  # case_participants 경유
    "query_field_note_handler": {"client_id"},  # J6 schedule→case/participant 경유 흡수
    "query_program_handler": {"counselor_id"},  # program_members.member_id
}

# 관계 필터 예외 — accounts 외 사유 명시 (필터 유도 대상에서 제외)
RELATION_FILTER_WAIVERS: dict[str, dict[str, str]] = {
    "query_client_handler": {
        "person_id": "프로필 연결 — 표시/조회는 name 필터, person_id 직접 필터 아님",
    },
    "query_member_handler": {
        "person_id": "프로필 연결 — name 필터 + person 평탄화",
    },
    "query_member_invitation_handler": {
        "member_id": "수락 후 결과 참조 — 초대 필터 대상 아님",
    },
    "query_message_log_handler": {
        "send_link_id": "발송연계 참조(검사 발송) — 발화 무의미, 신원 WAIVER 동류",
        "send_result_id": "발송연계 참조(검사 결과) — 발화 무의미",
        "form_send_id": "발송연계 참조(서식 발송) — 발화 무의미",
    },
}


def _has_relation_filter(col: str, props: set[str]) -> bool:
    if col in props:
        return True
    if col.endswith("_id"):
        plural = col.removesuffix("_id") + "_ids"
        if plural in props:
            return True
    return False


def relation_filter_gaps() -> int:
    """각 query 엔티티: (자기 FK 마커 ∪ 소유 far-side ∪ 다형 마커) − WAIVER ⊆ TOOL 필터."""
    from app.core.tool_registry import load_agent_tools

    reads, _ = load_agent_tools()
    tools = {t["name"]: t for t in reads if t["name"].startswith("query_")}
    gaps = 0

    for name, (mod_path, cls) in TOOL_MODEL.items():
        tool = tools.get(name)
        if tool is None:
            continue
        model = getattr(importlib.import_module(mod_path), cls)
        props = set(tool["input_schema"]["properties"])
        waived = RELATION_FILTER_WAIVERS.get(name, {})

        required: set[str] = set()
        for c in model.__table__.columns:
            info = c.info or {}
            ref = info.get("reference_table_name")
            rtf = info.get("reference_type_field")
            rts = info.get("reference_tables") or {}
            if not ref and not rtf:
                continue
            if ref in ACCOUNT_WAIVER_TABLES:
                continue
            if rts and set(rts.values()) <= ACCOUNT_WAIVER_TABLES:
                continue
            if c.name in waived:
                continue
            if ref in CODE_REFERENCE:
                required.add(CODE_REFERENCE[ref])  # role_code(안정 코드) — raw id 노출 금지
            else:
                required.add(c.name)

        for far in OWNED_RELATION_FAR_SIDE.get(name, set()):
            if far not in waived:
                required.add(far)

        missing = sorted(r for r in required if not _has_relation_filter(r, props))
        for col in missing:
            print(f"[관계갭] {name.removesuffix('_handler'):32} {col} 필터 없음")
            gaps += 1
    return gaps


# ── ⑦ 투영 완결 (agent-query.md — 필터 가능 핵심 스칼라는 기본 출력) ──────────

BODY_TEXT_COLS = ALIASES["keyword"]  # 짧은 텍스트 = opt-in, 기본 출력 아님

PROJECTION_SCALAR_WAIVERS: dict[str, dict[str, str]] = {
    "query_assessment_handler": {
        "version": "내부 버전 번호 — AVAILABLE 밖, 표시 무의미",
        "age": "표기 텍스트('만 6세~') — 수치 아키타입 아님(필터 WAIVER 동일)",
        "duration": "표기 텍스트 — 필터 WAIVER 동일",
        "kor_name": "name이 대표 표시 — 이름 변형",
        "eng_name": "name이 대표 표시 — 이름 변형",
    },
    "query_assessment_case_handler": {"completed_at": "AVAILABLE 밖 — 발화 실측 시 승격"},
    "query_billable_handler": {
        "discount_amount": "unpaid·total로 충분(필터 WAIVER 동일) — AVAILABLE 밖",
        "subsidy_amount": "unpaid·total로 충분 — AVAILABLE 밖",
    },
    "query_price_list_handler": {"source": "provenance(manual/import) — 내부 표식"},
    "query_form_template_handler": {
        "status": "AVAILABLE 밖 — is_active가 대표",
        "version": "내부 버전 번호",
    },
}


def projection_completeness_gaps() -> int:
    """수치·분류·시점·이름·불리언 = 기본 출력 포함. 필터엔 있는데 기본 출력에 없으면 갭."""
    gaps = 0
    for name, (mod_path, cls) in TOOL_MODEL.items():
        entry = TOOL_PROJECTION.get(name)
        if entry is None or entry[1] is None:
            continue
        acc_mod, attr, key = entry[1]
        defaults = _defaults_of(acc_mod, attr, key)
        default_set = set(defaults)
        model = getattr(importlib.import_module(mod_path), cls)
        cols = {c.name for c in model.__table__.columns}
        ref_cols = {
            c.name for c in model.__table__.columns
            if c.info.get("reference_table_name") or c.info.get("reference_type_field")
        }
        waived = PROJECTION_SCALAR_WAIVERS.get(name, {})
        required = cols - SYSTEM_COLS - NON_FILTERABLE - ref_cols - BODY_TEXT_COLS - set(waived)
        for col in sorted(required):
            if col not in default_set:
                print(f"[투영완결갭] {name.removesuffix('_handler'):28} {col} 기본 출력에 없음")
                gaps += 1
    return gaps


# ── ⑧ 정렬 완결 (naming.md — 아키타입 유도 sort, limit⇒sort) ─────────────────
# 표준 = core/query_sort.resolve_sort. latest/oldest(대표 시간축) + 수치 _high/_low(순번 제외).

SORT_ORDINAL_SKIP = ("_number", "_index", "_order")
SORT_ORDINAL_EXACT = {"sequence", "version"}


def sort_completeness_gaps() -> int:
    """모든 query: latest/oldest + 기본 투영 수치(순번 제외) {noun}_high/_low. limit⇒sort."""
    import sqlalchemy as sa

    from app.core.tool_registry import load_agent_tools

    reads, _ = load_agent_tools()
    tools = {t["name"]: t for t in reads if t["name"].startswith("query_")}
    gaps = 0
    for name, (mp, cls) in TOOL_MODEL.items():
        tool = tools.get(name)
        if tool is None:
            continue
        props = tool["input_schema"]["properties"]
        entry = TOOL_PROJECTION.get(name)
        defaults: set = set()
        if entry and entry[1]:
            am, at, k = entry[1]
            d = _defaults_of(am, at)
            defaults = set(d[k] if k is not None else d)
        model = getattr(importlib.import_module(mp), cls)
        nums = [
            c.name for c in model.__table__.columns
            if c.name in defaults
            and isinstance(c.type, (sa.Integer, sa.Numeric, sa.Float))
            and not c.name.endswith(SORT_ORDINAL_SKIP)
            and c.name not in SORT_ORDINAL_EXACT
        ]
        required = {"latest", "oldest"} | {f"{n}_high" for n in nums} | {f"{n}_low" for n in nums}
        # 사건축 정렬 완결 (naming.md — 시점 필터 완결의 짝): 필터 {event}_from ⇒ 정렬 {event}_earliest/_latest
        events = sorted({p[:-5] for p in props if p.endswith("_from") and p != "date_from"})
        required |= {f"{e}_earliest" for e in events} | {f"{e}_latest" for e in events}
        have = set(props.get("sort", {}).get("enum", []))
        for miss in sorted(required - have):
            print(f"[정렬갭] {name.removesuffix('_handler'):28} {miss}")
            gaps += 1
        if "limit" in props and "sort" not in props:
            print(f"[정렬갭] {name.removesuffix('_handler'):28} limit⇒sort (limit 있는데 sort 없음)")
            gaps += 1
    return gaps


# ── ⑨ 시점 필터 완결 (정렬 완결의 짝 — 대표 시간축은 필터도) ──────────────────
# 정렬이 latest/oldest로 쓰는 대표 시간축은 필터(date_from/to 또는 {event}_from/to)로도 노출.
# created_at은 SYSTEM이나 대표 축 필터는 예외적 요구 — sort/filter 비대칭이 알림 '이번주' 에러의 원인.

DATE_FILTER_WAIVERS: dict[str, str] = {
    # 예외 없음 — 모든 query가 대표 시간축(정렬이 쓰는 축)에 date 필터 보유. 카탈로그도 포함(정렬 대칭).
}


def date_filter_completeness_gaps() -> int:
    """모든 query: 대표 시간축에 date 필터(*_from) 필수. 정렬 완결의 짝."""
    from app.core.tool_registry import load_agent_tools

    reads, _ = load_agent_tools()
    tools = {t["name"]: t for t in reads if t["name"].startswith("query_")}
    gaps = 0
    for name, _mc in TOOL_MODEL.items():
        tool = tools.get(name)
        if tool is None or name in DATE_FILTER_WAIVERS:
            continue
        props = tool["input_schema"]["properties"]
        if not any(p.endswith("_from") for p in props):
            print(f"[시점갭] {name.removesuffix('_handler'):28} date 필터 없음 (대표 시간축 date_from/to 노출)")
            gaps += 1
    return gaps


# ── ⑩ 스코프-락 고지 (negative 완결 — 못 하는 것도 선언) ──────────────────────
# 필터를 일부러 막으면(발행분만·활성만·다홉 미지원) boundaries에 명시 — waiver는 감사 면제일 뿐
# 모델엔 침묵 → 거짓 나레이션·환각·flail. positive(파라미터)만큼 negative(락)도 선언한다.
# 값 = boundaries에 반드시 들어갈 고지 부분문자열(도구별 고유).

SCOPE_LOCKS: dict[str, str] = {
    "query_notice_handler": "미발행",           # 발행 공지만 — 초안 조회 불가
    "query_assessment_handler": "활성 검사만",   # 활성(센터 활성화) 검사만 — 비활성 대상 아님
    # query_field_note: J6 흡수 등재 후 client_id 지원 — 다홉 락 SCOPE 제거
    "query_room_handler": "내담자를 거를 수 없",   # 역방향 — 상담실로 내담자 못 거름
    "query_schedule_handler": "내담자를 직접 거를 수 없",  # J4 다홉
}


def scope_lock_declaration_gaps() -> int:
    """스코프-락 도구는 boundaries에 '무엇을 못 하나'를 명시한다."""
    from app.core.tool_registry import load_agent_tools

    reads, _ = load_agent_tools()
    tools = {t["name"]: t for t in reads if t["name"].startswith("query_")}
    gaps = 0
    for name, phrase in SCOPE_LOCKS.items():
        tool = tools.get(name)
        if tool is None:
            continue
        if phrase not in (tool.get("boundaries") or ""):
            print(f"[락고지갭] {name.removesuffix('_handler'):28} boundaries에 '{phrase}' 없음")
            gaps += 1
    return gaps


def facade_repo_delegation_gaps() -> int:
    import ast
    import pathlib

    def is_repo_getter(node) -> bool:
        # self._uow.repo(X) / self._xxx_repo() — repo 취득 표현
        if not isinstance(node, ast.Call):
            return False
        f = node.func
        return isinstance(f, ast.Attribute) and (
            f.attr == "repo" or f.attr == "_repo" or f.attr.endswith("_repo")
        )

    gaps = 0
    root = pathlib.Path(__file__).resolve().parent.parent / "app" / "modules"
    for path in sorted(root.glob("*/facade/*.py")):
        if path.relative_to(root).parts[0] == "agent":
            continue  # F6 — 구 agent 대화 모듈
        tree = ast.parse(path.read_text())
        for fn in (
            n for n in ast.walk(tree)
            if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef))
        ):
            repo_vars: set[str] = set()
            for n in ast.walk(fn):
                if isinstance(n, ast.Assign) and is_repo_getter(n.value):
                    repo_vars |= {
                        t.id for t in n.targets if isinstance(t, ast.Name)
                    }
            for n in ast.walk(fn):
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
                    base = n.func.value
                    if is_repo_getter(base) or (
                        isinstance(base, ast.Name) and base.id in repo_vars
                    ):
                        print(
                            f"[위임갭] {path.name}:{n.lineno} {fn.name}: "
                            f"repo 직접 호출 .{n.func.attr}() — Service 경유"
                        )
                        gaps += 1
    return gaps


# ── ⑧ 커스텀 파라미터 봉쇄 (surjectivity — 전 param이 아키타입/레버에서 유도) ──
# forward(누락 0)의 짝. 유도표 밖 param = 커스텀 = 갭. 발명 파라미터의 구조적 차단.

# 보편 레버 — 트림·정렬·절삭 + 무표 시점(created, 전 엔티티) + 자기 PK 단건/배치(브리지 랜딩)
UNIVERSAL_PARAMS = {"fields", "sort", "limit", "date_from", "date_to", "ids", "id"}


def _ref_forms(c) -> set[str]:
    n, info = c.name, (c.info or {})
    if not (n.endswith("_id") or info.get("reference_type_field")):
        return set()
    if info.get("reference_table_name") in ACCOUNT_WAIVER_TABLES:
        return set()
    ent = n.removesuffix("_id")
    out = {n, f"{ent}_id", f"{ent}_ids"}
    if info.get("reference_table_name") in CODE_REFERENCE:
        out.add(CODE_REFERENCE[info["reference_table_name"]])
    return out


def _scalar_forms(c) -> set[str]:
    from sqlalchemy import BigInteger, Boolean, Date, DateTime, Integer, Numeric

    n, t, out = c.name, c.type, {c.name}
    if isinstance(t, (DateTime, Date)):
        ev = n.removesuffix("_at").removesuffix("_date")
        out |= {f"{ev}_from", f"{ev}_to", "date_from", "date_to"}
    if isinstance(t, (Integer, Numeric, BigInteger)) and not isinstance(t, Boolean):
        out |= {f"{n}_min", f"{n}_max"}
    return out


def _legit_params(
    name: str,
    model,
) -> set[str]:
    cols = {c.name for c in model.__table__.columns}
    waived = WAIVERS.get(name, set())
    ok = set(UNIVERSAL_PARAMS)
    for c in model.__table__.columns:
        ok |= _ref_forms(c)  # 참조/코드 = 전 컬럼(NON_FILTERABLE 연기 무관 — 유도 가능)
    for c in model.__table__.columns:
        if c.name not in SYSTEM_COLS and c.name not in NON_FILTERABLE and c.name not in waived:
            ok |= _scalar_forms(c)
    for alias, targets in ALIASES.items():
        if targets & cols:
            ok.add(alias)
            if alias.endswith("_from"):
                ok.add(alias[:-5] + "_to")
            if alias.endswith("_min"):
                ok.add(alias[:-4] + "_max")
    if ALIASES["keyword"] & cols:
        ok.add("keyword")
    if "person_id" in cols and "name" not in cols:  # client·member 이름은 person 경유
        ok |= {"name", "search"}
    for f in OWNED_RELATION_FAR_SIDE.get(name, set()):
        ok |= {f, f.removesuffix("_id") + "_ids"}
    if getattr(model, "AGENT_DERIVED_STATUS", None) is not None:  # 파생 생명주기 = 분류
        ok.add("status")
    return ok


def custom_param_gaps() -> int:
    """유도표 밖 param(커스텀) 검출. 모든 param은 아키타입/레버에서 유도돼야 한다."""
    from app.core.tool_registry import load_agent_tools

    reads, _ = load_agent_tools()
    tools = {t["name"]: t for t in reads if t["name"].startswith("query_")}
    gaps = 0
    for name, (mod_path, cls) in TOOL_MODEL.items():
        tool = tools.get(name)
        if tool is None:
            continue
        model = getattr(importlib.import_module(mod_path), cls)
        ok = _legit_params(name, model)
        for p in tool["input_schema"]["properties"]:
            if p not in ok:
                print(f"[커스텀] {name.removesuffix('_handler'):30} {p} 유도표 밖")
                gaps += 1
    return gaps


def main() -> int:
    from app.core.tool_registry import load_agent_tools

    reads, _ = load_agent_tools()
    tools = {t["name"]: t for t in reads if t["name"].startswith("query_")}
    gaps = 0
    for name, (mod_path, cls) in TOOL_MODEL.items():
        tool = tools.get(name)
        if tool is None:
            print(f"[감사] {name}: TOOL 미수집")
            gaps += 1
            continue
        model = getattr(importlib.import_module(mod_path), cls)
        cols = {c.name for c in model.__table__.columns}
        props = set(tool["input_schema"]["properties"])
        waived = WAIVERS.get(name, set())
        missing = sorted(
            c for c in cols - SYSTEM_COLS - NON_FILTERABLE - waived
            if not covered(c, props)
        )
        if missing:
            print(f"[갭] {name.removesuffix('_handler'):32} {', '.join(missing)}")
            gaps += len(missing)

    gaps += projection_gaps()
    gaps += projection_completeness_gaps()
    gaps += sort_completeness_gaps()
    gaps += date_filter_completeness_gaps()
    gaps += scope_lock_declaration_gaps()
    gaps += relation_filter_gaps()
    gaps += custom_param_gaps()
    gaps += layering_gaps()
    gaps += facade_boundary_gaps()
    gaps += facade_repo_delegation_gaps()

    print(f"\n{'통과 — 갭 0' if gaps == 0 else f'갭 {gaps}건'}")
    return 1 if gaps else 0


if __name__ == "__main__":
    sys.exit(main())
