# 종단 분석 실행기 — target_id = counseling_case_analyses id(pre-create된 processing 행).
# reaction(enqueue_case_analysis)이 batch 큐로 던지고, 이 executor가 데이터 로드→프롬프트
# 조립→LLM→mark_completed/failed. reclaim 재배달 대비 status-skip 멱등(§6 필수).
import json
from uuid import uuid4

from app.behavior.action.event import Event
from app.core.logger import get_logger
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.infrastructure.persistence.unit_of_work import UnitOfWork, transactional_uow
from app.modules.event import emit

logger = get_logger(__name__)


async def process_case_analysis(
    analysis_id: str,
    center_id: str,
    *,
    member_id: str | None = None,
    session_take: int | None = None,
    **_params,
) -> None:
    from app.modules.llm.credit_balance.plan_config import AIPurpose
    from app.modules.llm.facade.ai_facade import create_ai_facade
    from app.modules.llm.gateway.schemas import AICallContext
    from app.modules.counseling.counseling_case_analysis.prompts import (
        CASE_ANALYSIS_SYSTEM_PROMPT,
    )
    from app.modules.client.facade import ClientFacade
    from app.modules.counseling.facade import CounselingCaseAnalysisFacade
    from app.modules.center.facade import ProgramFacade

    # load + 프롬프트 조립 (status-skip 멱등 포함)
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        async with uow:
            facade = CounselingCaseAnalysisFacade(uow)
            analysis = await facade.find_analysis(analysis_id)
            if analysis is None or analysis.status != "processing":
                logger.info("case_analysis skip(status): id=%s", analysis_id)
                return
            case_id = analysis.counseling_case_id

            source = await facade.load_analysis_source(case_id, center_id)
            case_entity = source["case"]
            data = source["data"]
            completed_total = data["session_count"]
            if session_take:
                data = _take_recent_sessions(data, session_take)
            case_meta = _extract_case_meta(case_entity)

            # 프로그램명·출석은 프롬프트 보강용 — 조회 실패는 non-fatal
            if case_entity and case_entity.program_id:
                try:
                    program = await ProgramFacade(uow).find_program(
                        case_entity.program_id
                    )
                    if program:
                        case_meta["program_name"] = program.name
                except Exception as e:
                    logger.debug("프로그램 정보 조회 실패 (non-fatal): %s", e)

            try:
                attendance_map = await facade.list_client_attendance_by_sessions(
                    [s.id for s in data["sessions"]]
                )
            except Exception:
                attendance_map = {}

            # ── 명단 ──
            # 그룹 판정의 근거는 **실제 인원수**다. 프로그램 유형(GROUP/INDIVIDUAL)은
            # 보조 신호로만 본다 — 그룹 프로그램에 한 명만 남은 케이스는 개인처럼
            # 다뤄야 하고, 반대로 유형이 개인인데 두 명이 붙은 케이스도 있다.
            try:
                client_ids = await facade.list_case_client_ids(case_id)
                client_names = await ClientFacade(uow).get_client_summaries_by_ids(
                    client_ids
                )
            except Exception as e:
                logger.debug("케이스 명단 조회 실패 (non-fatal): %s", e)
                client_ids, client_names = [], {}
            is_group = len(client_ids) > 1

            session_count = data["session_count"]
            per_session_chars = _per_session_budget(session_count)
            prompt_text, truncated_sessions = _build_analysis_prompt_text(
                data,
                case_meta,
                attendance_map,
                per_session_chars=per_session_chars,
                client_names=client_names,
                is_group=is_group,
            )
            schedule_ids = data["schedule_ids"]
            session_meta = _build_session_meta(data, attendance_map)
            coverage = _build_coverage(
                data,
                session_meta,
                completed_total,
                attendance_map=attendance_map,
                is_group=is_group,
            )
            coverage["is_group"] = is_group
            coverage["client_count"] = len(client_ids)
            coverage["truncated_notes"] = len(truncated_sessions)
            coverage["per_session_chars"] = per_session_chars

    field_note_summaries = await _fetch_field_note_summaries(schedule_ids, center_id)
    if field_note_summaries:
        prompt_text += "\n\n--- 필드노트 AI 요약 ---\n" + field_note_summaries

    gateway = create_ai_facade()
    config = await gateway.resolve_config(
        "case_analysis",
        module="counseling",
        default_prompt=CASE_ANALYSIS_SYSTEM_PROMPT,
    )
    system_prompt = config.get("system_prompt") or CASE_ANALYSIS_SYSTEM_PROMPT

    try:
        if is_group:
            roster = " · ".join(client_names.get(cid, "이름 미상") for cid in client_ids)
            subject = (
                f"{len(client_ids)}명이 함께 참여하는 **그룹** 상담 케이스"
                f"\n내담자: {roster}"
                "\n일지 블록 앞의 [이름]은 그 일지의 주인입니다."
                " [전원 공통]은 회기 녹음에서 자동 생성돼 내담자 전체에 같은 내용으로"
                " 저장된 일지라, 개인차를 담고 있지 않습니다."
                "\n아래 '그룹 케이스 규칙'을 반드시 따르세요."
            )
        else:
            subject = "한 내담자의 상담 케이스"

        user_prompt = f"""다음은 {subject}에 포함된 {session_count}개 회기의 상담 기록입니다.
전체 흐름을 분석하여 종단적 분석 결과를 JSON으로 제공해주세요.
session_track은 아래 회기 블록에 나온 회기 번호만 사용하고, {session_count}개 회기를 빠짐없이 다루세요.

{prompt_text}"""

        ctx = AICallContext(
            center_id=center_id,
            source_type="counseling",
            source_id=case_id,
            purpose=AIPurpose.CASE_ANALYSIS,
            pipeline_step="case_analysis",
            member_id=member_id,
        )
        result = await gateway.generate_json(
            ctx,
            system_prompt,
            user_prompt,
            max_tokens=_output_budget(session_count),
            resolved_config=config,
        )
        content = json.loads(result.content)
        content = _merge_server_facts(content, session_meta, coverage)

        # persist
        event_group_id = str(uuid4())
        async with transactional_uow() as uow:
            atomic, _ = await CounselingCaseAnalysisFacade(uow).mark_analysis_completed(
                analysis_id,
                content=content,
                session_count=session_count,
                model_used=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
            )
            await emit(
                uow,
                "case_analysis_completed",
                event_group_id=event_group_id,
                atomics=[atomic],
                center_id=center_id,
                actor_id=member_id,
            )
        await _dispatch_event(event_group_id)

        logger.info(
            "case_analysis completed: id=%s case=%s sessions=%d",
            analysis_id,
            case_id,
            session_count,
        )

    except Exception as e:
        logger.error(
            "case_analysis failed: id=%s case=%s error=%s",
            analysis_id,
            case_id,
            e,
            exc_info=True,
        )
        event_group_id = str(uuid4())
        async with transactional_uow() as uow:
            atomic, _ = await CounselingCaseAnalysisFacade(uow).mark_analysis_failed(
                analysis_id, error_message=str(e)
            )
            await emit(
                uow,
                "case_analysis_failed",
                event_group_id=event_group_id,
                atomics=[atomic],
                center_id=center_id,
                actor_id=member_id,
            )
        await _dispatch_event(event_group_id)


async def _dispatch_event(event_group_id: str) -> None:
    try:
        await Event.dispatch_event(event_group_id)
    except Exception as e:
        logger.warning(
            "case_analysis event dispatch failed: group=%s error=%s", event_group_id, e
        )


async def _fetch_field_note_summaries(
    schedule_ids: list[str],
    center_id: str,
) -> str:
    from app.modules.field_note.facade import FieldNoteFacade

    if not schedule_ids:
        return ""
    try:
        async with AsyncSessionLocal() as fn_session:
            uow = UnitOfWork(fn_session)
            async with uow:
                field_notes = await FieldNoteFacade(uow).get_summaries_by_schedule_ids(
                    schedule_ids, center_id
                )
        return "\n".join(f"- {fn.summary}" for fn in field_notes if fn.summary)
    except Exception as e:
        logger.warning("필드노트 요약 수집 실패 (non-fatal): %s", e)
        return ""


def _extract_case_meta(case_entity) -> dict:
    if not case_entity:
        return {}
    meta = {}
    if case_entity.chief_complaint:
        meta["chief_complaint"] = case_entity.chief_complaint
    if case_entity.total_sessions:
        meta["total_sessions"] = case_entity.total_sessions
    if case_entity.status:
        meta["case_status"] = case_entity.status
    if case_entity.memo:
        meta["memo"] = case_entity.memo
    return meta


def _build_analysis_prompt_text(
    data: dict,
    case_meta: dict,
    attendance_map: dict[str, list[tuple[str, str]]],
    *,
    per_session_chars: int,
    client_names: dict[str, str] | None = None,
    is_group: bool = False,
) -> tuple[str, list[int]]:
    truncated: list[int] = []
    names = client_names or {}
    roster_size = len(names)
    lines = []

    if case_meta:
        lines.append("=== 사례 개요 ===")
        if case_meta.get("chief_complaint"):
            lines.append(f"주호소: {case_meta['chief_complaint']}")
        if case_meta.get("program_name"):
            lines.append(f"상담 프로그램: {case_meta['program_name']}")
        if case_meta.get("total_sessions"):
            lines.append(f"계획 회기: {case_meta['total_sessions']}회")
        lines.append(f"완료 회기: {data['session_count']}회")
        if case_meta.get("total_sessions"):
            progress = round(data["session_count"] / case_meta["total_sessions"] * 100)
            lines.append(f"진행률: {progress}%")
        if case_meta.get("case_status"):
            status_labels = {
                "active": "진행 중",
                "completed": "종결",
                "cancelled": "취소",
            }
            lines.append(
                f"사례 상태: {status_labels.get(case_meta['case_status'], case_meta['case_status'])}"
            )
        if case_meta.get("memo"):
            lines.append(f"메모: {case_meta['memo']}")
        lines.append("")

    for session in data["sessions"]:
        sn = session.session_number or "?"
        completed = (
            session.completed_at.strftime("%Y-%m-%d")
            if session.completed_at
            else "미완료"
        )
        lines.append(f"\n=== 회기 {sn} ({completed}) ===")

        pairs = attendance_map.get(session.id, [])
        if pairs:
            status_labels = {
                "attended": "출석",
                "no_show": "무단결석",
                "late": "지각",
                "absent": "결석",
                "excused": "사유결석",
                "cancelled": "취소",
            }
            # 그룹은 **누가** 왔는지까지 적는다 — 이름 없이 상태만 늘어놓으면
            # 5명 중 누가 빠졌는지 알 수 없어 '결석'이 통계로만 남는다.
            if is_group:
                attendance_str = ", ".join(
                    f"{names.get(cid, '이름 미상')}({status_labels.get(st, st)})"
                    for cid, st in pairs
                )
            else:
                attendance_str = ", ".join(status_labels.get(st, st) for _, st in pairs)
            lines.append(f"  출석: {attendance_str}")

        notes = data["notes_by_session"].get(session.id, [])
        if notes:
            lines.append(f"  일지 출처: {_NOTE_SOURCE_LABEL[_note_source(notes)]}")
            note_lines: list[str] = []
            for owners, note in _group_notes_by_content(notes, names, roster_size):
                if is_group:
                    note_lines.append(f"[{owners}]")
                if note.summary:
                    note_lines.append(f"[회기 요약] {note.summary}")
                if note.content:
                    content = note.content
                    if isinstance(content, str):
                        try:
                            content = json.loads(content)
                        except (json.JSONDecodeError, TypeError):
                            content = {}

                    structured_keys = (
                        # default 포맷
                        "mood",
                        "main_topic",
                        "intervention",
                        "progress",
                        "homework",
                        "next_goal",
                        # SOAP
                        "subjective",
                        "objective",
                        "assessment",
                        "plan",
                        # DAP
                        "data",
                        # BIRP
                        "behavior",
                        "response",
                        # family_center
                        "presenting_problem",
                        "family_dynamics",
                        "outcome",
                        "follow_up",
                    )
                    for key in structured_keys:
                        val = content.get(key)
                        if val:
                            if isinstance(val, list):
                                val = ", ".join(str(v) for v in val)
                            note_lines.append(f"  {key}: {val}")

                    raw = content.get("raw_notes")
                    if raw and isinstance(raw, str) and raw.strip():
                        note_lines.append(f"  [관찰 기록] {raw.strip()}")

            note_text, was_trimmed = _fit_note_lines(note_lines, per_session_chars)
            if was_trimmed:
                truncated.append(sn if isinstance(sn, int) else 0)
            lines.append(note_text)
        else:
            lines.append("  (상담일지 없음)")

    return "\n".join(lines), truncated


# 상담사가 손으로 쓰는 일지 편집기는 main_topic·progress·next_goal만 저장한다.
# 아래 키가 하나라도 있으면 녹음(필드노트) 기반으로 생성된 일지다 — 정서·개입·과제는
# 그 경로에서만 나온다. 이 구분이 없으면 LLM이 "비어 있음"을 "기록 안 함"으로 오해한다.
_AI_ONLY_NOTE_KEYS = (
    "mood",
    "intervention",
    "homework",
    "raw_notes",
    "subjective",
    "objective",
    "assessment",
    "plan",
    "data",
    "behavior",
    "response",
    "presenting_problem",
    "family_dynamics",
    "outcome",
    "follow_up",
)
_NOTE_SOURCE_LABEL = {"ai": "녹음 기반", "manual": "직접 작성", "none": "없음"}


def _note_content(note) -> dict:
    content = note.content
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return {}
    return content if isinstance(content, dict) else {}


def _group_notes_by_content(
    notes: list, names: dict[str, str], roster_size: int
) -> list[tuple[str, object]]:
    """같은 내용의 일지를 하나로 접고, 주인 이름을 붙여 돌려준다.

    🔴 녹음(필드노트) 기반 일지는 **한 번 생성해 내담자 전원에게 복사**된다
    (`app/runtime/field_note/counseling_note/service.py`). 그래서 5명 그룹이면
    글자까지 똑같은 일지가 5벌 저장돼 있고, 그대로 프롬프트에 실으면 같은 내용이
    다섯 번 반복돼 ① 입력 예산을 5배로 먹고 ② LLM이 '다섯 명이 다 그랬다'는
    강한 신호로 오독한다. 내용이 같으면 한 번만 싣고 [전원 공통]으로 표시한다.

    손으로 쓴 일지는 내담자마다 내용이 달라 그대로 각자의 이름이 붙는다.
    """
    buckets: dict[str, tuple[list[str], object]] = {}
    for note in notes:
        key = json.dumps(_note_content(note), sort_keys=True, ensure_ascii=False)
        key += "|" + (note.summary or "")
        owner = names.get(getattr(note, "client_id", None), "이름 미상")
        if key in buckets:
            buckets[key][0].append(owner)
        else:
            buckets[key] = ([owner], note)

    out: list[tuple[str, object]] = []
    for owners, note in buckets.values():
        if roster_size > 1 and len(owners) == roster_size:
            label = "전원 공통"
        else:
            label = " · ".join(owners)
        out.append((label, note))
    return out


def _note_source(notes: list) -> str:
    if not notes:
        return "none"
    for note in notes:
        content = _note_content(note)
        if any(content.get(key) for key in _AI_ONLY_NOTE_KEYS):
            return "ai"
    return "manual"


def _take_recent_sessions(data: dict, take: int) -> dict:
    sessions = data["sessions"][-take:]
    ids = {s.id for s in sessions}
    notes_by_session = {
        sid: notes for sid, notes in data["notes_by_session"].items() if sid in ids
    }
    return {
        "sessions": sessions,
        "notes_by_session": notes_by_session,
        "schedule_ids": [s.schedule_id for s in sessions if s.schedule_id],
        "session_count": len(sessions),
        "note_count": sum(len(n) for n in notes_by_session.values()),
    }


_ATTENDED = ("attended", "late")


def _statuses(pairs: list[tuple[str, str]]) -> list[str]:
    """(id, 상태) 쌍에서 상태만. id를 버리는 지점은 여기 하나뿐이다."""
    return [st for _, st in pairs]


def _reduce_attendance(statuses: list[str]) -> str | None:
    if not statuses:
        return None
    if "attended" in statuses or "late" in statuses:
        return "attended"
    if "no_show" in statuses:
        return "no_show"
    if {"absent", "excused", "cancelled"} & set(statuses):
        return "absent"
    return None


def _build_session_meta(data: dict, attendance_map: dict[str, list[str]]) -> list[dict]:
    meta = []
    for session in data["sessions"]:
        notes = data["notes_by_session"].get(session.id, [])
        meta.append(
            {
                "session": session.session_number,
                "date": (
                    session.completed_at.strftime("%m.%d")
                    if session.completed_at
                    else None
                ),
                "attendance": _reduce_attendance(
                    _statuses(attendance_map.get(session.id, []))
                ),
                # 그룹 표시용 — 접힌 한 값('참석')만으로는 5명 중 3명 온 회기와
                # 전원 온 회기가 구분되지 않는다. 인원을 그대로 함께 싣는다.
                "attended_count": sum(
                    1
                    for st in _statuses(attendance_map.get(session.id, []))
                    if st in _ATTENDED
                ),
                "participant_count": len(attendance_map.get(session.id, [])),
                "note_source": _note_source(notes),
            }
        )
    return meta


def _build_coverage(
    data: dict,
    session_meta: list[dict],
    completed_total: int,
    *,
    attendance_map: dict[str, list[tuple[str, str]]] | None = None,
    is_group: bool = False,
) -> dict:
    mood_notes = 0
    intervention_notes = 0
    for notes in data["notes_by_session"].values():
        content_keys = [_note_content(n) for n in notes]
        if any(c.get("mood") or c.get("behavior") or c.get("subjective") for c in content_keys):
            mood_notes += 1
        if any(c.get("intervention") or c.get("plan") for c in content_keys):
            intervention_notes += 1

    analyzed = len(session_meta)

    # 「읽은 기록」의 일지 건수는 **실제로 프롬프트에 실린 블록 수**여야 한다.
    # 녹음 일지는 내담자 수만큼 복사돼 있어서 raw 개수를 그대로 쓰면 5명 그룹의
    # 12회기가 "상담일지 60건"으로 부풀고, 상담사는 자기가 쓴 적 없는 숫자를 본다.
    if is_group:
        note_count = 0
        for notes in data["notes_by_session"].values():
            keys = {
                json.dumps(_note_content(n), sort_keys=True, ensure_ascii=False)
                + "|"
                + (n.summary or "")
                for n in notes
            }
            note_count += len(keys)
    else:
        note_count = data["note_count"]

    # 참석률의 분모가 케이스 유형으로 갈린다.
    #   개인 — 회기 단위. "12회기 중 11회 참석" (한 명뿐이라 회기=사람)
    #   그룹 — **인원 단위**. "12회기 × 5명 = 60칸 중 52칸 참석"
    # 그룹에 회기 단위를 쓰면 `_reduce_attendance`가 '한 명이라도 오면 참석'으로
    # 접기 때문에, 5명 중 1명만 나온 회기도 100%로 잡혀 지표가 무의미해진다.
    if is_group and attendance_map:
        slots = [st for pairs in attendance_map.values() for _, st in pairs]
        attended = sum(1 for st in slots if st in _ATTENDED)
        total_slots = len(slots)
        attendance_rate = (
            round(attended / total_slots * 100) if total_slots else None
        )
    else:
        attended = sum(1 for m in session_meta if m["attendance"] == "attended")
        attendance_rate = round(attended / analyzed * 100) if analyzed else None

    return {
        "completed_sessions": completed_total,
        "analyzed_sessions": analyzed,
        "note_count": note_count,
        "manual_notes": sum(1 for m in session_meta if m["note_source"] == "manual"),
        "ai_notes": sum(1 for m in session_meta if m["note_source"] == "ai"),
        "mood_notes": mood_notes,
        "intervention_notes": intervention_notes,
        "attendance_rate": attendance_rate,
    }


def _merge_server_facts(
    content: dict, session_meta: list[dict], coverage: dict
) -> dict:
    # 해석은 LLM, 사실은 서버 — 회기 번호·날짜·출석·출처는 지어낼 여지를 남기지 않는다.
    llm_rows = {
        row.get("session"): row
        for row in content.get("session_track") or []
        if isinstance(row, dict)
    }
    track = []
    for meta in session_meta:
        row = dict(llm_rows.get(meta["session"]) or {})
        row.update(meta)
        if meta["note_source"] != "ai":
            # 손 작성 일지에는 정서·개입·과제 입력 칸 자체가 없다.
            row["mood"] = None
            row["intervention"] = None
            row["homework"] = None
        track.append(row)

    content["session_track"] = track
    content["coverage"] = coverage
    return content


# ── 입력·출력 예산 ────────────────────────────────────────────────────────
#
# 옛 코드는 조립된 프롬프트 전체를 `[:12000]`으로 잘랐다. 회기 블록이 오래된 순서로
# 쌓이므로 잘려나가는 쪽은 **가장 최근 회기**였다 — 경과 분석에서 최악의 절단이다.
# 실측(회기당 3필드 800자 = 흔한 분량): 12회기 프롬프트 29,879자 → 5회기만 통과.
#
# 그래서 전역 절단 대신 **회기별 예산**을 준다. 긴 일지 하나가 다른 회기를 밀어내지
# 못하고, 잘린 회기는 coverage.truncated_sessions로 화면에 고지된다.
TOTAL_INPUT_CHARS = 36_000  # 한글 1자 ≈ 1.3~1.5 토큰 → 약 24K 입력 토큰
MIN_PER_SESSION_CHARS = 600
MAX_PER_SESSION_CHARS = 4_000

# 출력도 회기 수에 비례한다. 기본값(SUMMARY_MAX_TOKENS=2048)으로는 12회기 리포트
# (session_track 12행 + 국면·주제·개입·방향)가 중간에 잘려 JSON 파싱이 실패한다.
BASE_OUTPUT_TOKENS = 2_000
OUTPUT_TOKENS_PER_SESSION = 250
MAX_OUTPUT_TOKENS = 8_000


def _per_session_budget(session_count: int) -> int:
    if session_count <= 0:
        return MAX_PER_SESSION_CHARS
    return max(
        MIN_PER_SESSION_CHARS,
        min(MAX_PER_SESSION_CHARS, TOTAL_INPUT_CHARS // session_count),
    )


def _output_budget(session_count: int) -> int:
    return min(
        MAX_OUTPUT_TOKENS,
        BASE_OUTPUT_TOKENS + OUTPUT_TOKENS_PER_SESSION * max(0, session_count),
    )


def _fit_note_lines(note_lines: list[str], budget: int) -> tuple[str, bool]:
    # 예산을 넘을 때 뒤에서부터 자르면 순서상 뒤에 오는 필드(progress·next_goal)가
    # 통째로 사라진다 — 경과 분석에서 가장 필요한 필드다. 그래서 줄 단위가 아니라
    # **필드별로 균등 배분**해 모든 필드가 앞부분이라도 남게 한다.
    text = "\n".join(note_lines)
    if len(text) <= budget or not note_lines:
        return text, False

    per_line = max(150, budget // len(note_lines))
    fitted = [
        line if len(line) <= per_line else line[:per_line] + " …(생략)"
        for line in note_lines
    ]
    return "\n".join(fitted), True
