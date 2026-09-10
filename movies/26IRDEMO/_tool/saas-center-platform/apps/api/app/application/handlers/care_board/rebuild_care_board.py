# 한 내담자의 케어보드 시간축(care_board_entries)을 원천 7종에서 재구축한다.
#
# 조립처를 하나로 둔 이유 — 반응(원천 변경)·백필(소급)·정합 크론이 전부 이 함수를 부른다.
# 원천마다 recorder를 따로 두면 세 경로가 조용히 갈라진다. source 키 upsert라 멱등이며,
# 한 내담자 범위(수십~수백 행)라 반응·크론 어디서 돌아도 비용이 갇힌다.
#
# 🔴 body는 표시용 절삭본이다. LLM 입력은 이 값이 아니라 source_id로 원본을 다시 읽는다
#    (docs/careboard/domain.md §10-1).

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentCaseFacade, AssessmentTaskFacade
from app.modules.billing.facade import BillableFacade
from app.modules.care_board.entry.models import CareBoardKind, CareBoardShareClass
from app.modules.care_board.facade import CareBoardFacade
from app.modules.client.facade import ClientFacade, ResourceFacade
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingNoteFacade,
    CounselingSessionFacade,
)
from app.modules.document.facade import DocumentFacade
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade

BODY_LIMIT = 120

# 케어보드는 "지금까지 무슨 일이 있었나"다 — 아직 일어나지 않은 예정 건은 싣지 않는다.
# (예정 회기가 완료로 바뀌면 counseling_session_updated 반응이 그때 채운다)
SESSION_HISTORY_STATUSES = frozenset({"completed", "cancelled", "no_show"})
TASK_HISTORY_STATUSES = frozenset({"completed", "submitted", "cancelled"})


def _clip(text: str | None, limit: int = BODY_LIMIT) -> str | None:
    """문장 경계 우선 절삭. 잘렸을 때만 말줄임을 붙인다."""
    if not text:
        return None
    flat = " ".join(text.split())
    if len(flat) <= limit:
        return flat
    head = flat[:limit]
    for mark in (". ", "! ", "? ", "다. "):
        cut = head.rfind(mark)
        if cut > limit // 2:
            return head[: cut + len(mark) - 1]
    return head.rstrip() + "…"


async def rebuild_care_board_handler(
    *,
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
) -> int:
    board = CareBoardFacade(uow)
    client = await ClientFacade(uow).get_client_in_center(
        center_id=center_id, client_id=client_id
    )
    person_id = client.person_id

    recorded = 0
    # 한 바퀴에서 만난 원천 — 여기 없는 행은 원천에서 사라졌거나 이력이 아니게 된 것이다(정리 §)
    kept: set[tuple[str, str]] = set()
    excluded: set[tuple[str, str]] = set()

    async def record(**kwargs) -> None:
        nonlocal recorded
        await board.record_entry(
            center_id=center_id, client_id=client_id, person_id=person_id, **kwargs
        )
        kept.add((kwargs["source_table"], kwargs["source_id"]))
        recorded += 1

    # ── 상담: 케이스 + 회기(+일지 요약) ──
    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)

    case_ids = await case_facade.list_case_ids_by_participant_ids([client_id], center_id)
    cases = await case_facade.get_cases_by_ids(case_ids) if case_ids else []
    program_names = await _program_names(uow, [c.program_id for c in cases])

    for case in cases:
        program = program_names.get(case.program_id) or "상담"
        total = f" · 총 {case.total_sessions}회기" if case.total_sessions else ""
        await record(
            kind=CareBoardKind.COUNSELING.value,
            occurred_at=case.created_at,
            source_table="counseling_cases",
            source_id=case.id,
            share_class=CareBoardShareClass.FACT.value,
            case_id=case.id,
            actor_id=case.counselor_id,
            # 화면 어휘를 따른다 — 이 동작의 제품 이름은 '상담 접수'(counseling/receive)이고
            # 번호 라벨은 다른 화면과 같은 '케이스번호'다('사례번호'는 여기서만 쓰던 말)
            title=f"{program} 접수",
            meta=f"케이스번호 {case.case_code}{total}",
        )

    sessions = await session_facade.get_sessions_by_case_ids(case_ids) if case_ids else []
    schedule_map = await _schedules_by_ids(uow, [s.schedule_id for s in sessions])
    notes = (
        await CounselingNoteFacade(uow).list_notes_by_sessions(
            [s.id for s in sessions], center_id
        )
        if sessions
        else []
    )
    # 일지는 회기×내담자 단위다 — 그룹 회기면 한 회기에 여러 건이라 이 내담자 것만 고른다
    note_by_session = {
        n.counseling_session_id: n for n in notes if n.client_id == client_id
    }
    case_by_id = {c.id: c for c in cases}

    for session in sessions:
        if session.status not in SESSION_HISTORY_STATUSES:
            excluded.add(("counseling_sessions", session.id))
            continue
        schedule = schedule_map.get(session.schedule_id)
        occurred = (
            schedule.start
            if schedule is not None
            else (session.completed_at or session.created_at)
        )
        case = case_by_id.get(session.counseling_case_id)
        program = program_names.get(case.program_id) if case else None
        note = note_by_session.get(session.id)
        await record(
            kind=CareBoardKind.COUNSELING.value,
            occurred_at=occurred,
            source_table="counseling_sessions",
            source_id=session.id,
            # 일지 요약이 실리면 임상 기록이 된다 — 사실만 있는 행과 등급이 다르다
            share_class=(
                CareBoardShareClass.CLINICAL.value
                if note is not None and note.summary
                else CareBoardShareClass.FACT.value
            ),
            case_id=session.counseling_case_id,
            actor_id=case.counselor_id if case else None,
            title=program or "상담 회기",
            subtitle=f"{session.session_number}회기" if session.session_number else None,
            body=_clip(note.summary if note else None),
            meta=_session_meta(session.status),
        )

    # ── 검사: task ──
    assessment_cases = await AssessmentCaseFacade(uow).get_cases_by_client(
        center_id=center_id, client_id=client_id
    )
    for a_case in assessment_cases:
        tasks = await AssessmentTaskFacade(uow).get_tasks_by_case_id(a_case.id)
        display = await AssessmentTaskFacade(uow).get_tasks_display_info_by_ids(
            [t.id for t in tasks]
        )
        for task in tasks:
            if task.status not in TASK_HISTORY_STATUSES:
                excluded.add(("assessment_tasks", task.id))
                continue
            info = display.get(task.id) or {}
            await record(
                kind=CareBoardKind.ASSESSMENT.value,
                occurred_at=task.completed_at or task.created_at,
                source_table="assessment_tasks",
                source_id=task.id,
                share_class=(
                    CareBoardShareClass.CLINICAL.value
                    if task.opinion
                    else CareBoardShareClass.FACT.value
                ),
                case_id=a_case.id,
                actor_id=a_case.counselor_id,
                title=info.get("assessment_kor_name") or info.get("assessment_code") or "심리검사",
                subtitle=_task_subtitle(task.status),
                body=_clip(task.opinion),
                meta=None,
            )

    # ── 문서 ──
    resources = await ResourceFacade(uow).list_documents_by_client(
        center_id, client_id
    )
    document_ids = [r.resource_id for r in resources]
    documents = (
        await DocumentFacade(uow).get_documents_by_ids(document_ids, center_id)
        if document_ids
        else []
    )
    doc_by_id = {d.id: d for d in documents}
    for resource in resources:
        document = doc_by_id.get(resource.resource_id)
        if document is None:
            continue
        await record(
            kind=CareBoardKind.DOCUMENT.value,
            occurred_at=resource.created_at,
            source_table="documents",
            source_id=document.id,
            share_class=CareBoardShareClass.FACT.value,
            actor_id=document.uploader_id,
            title=f"{document.name} 등록",
            meta=_document_meta(document.file_type),
        )

    # ── 필드노트 (내담자 직결 컬럼이 없어 회기 schedule로 역산) ──
    schedule_ids = [s.schedule_id for s in sessions if s.schedule_id]
    field_notes = await FieldNoteFacade(uow).get_summaries_by_schedule_ids(
        schedule_ids, center_id
    )
    for note in field_notes:
        await record(
            kind=CareBoardKind.FIELDNOTE.value,
            occurred_at=note.created_at,
            source_table="field_notes",
            source_id=note.id,
            # 녹음·전사 계열은 센터 내부 자료다 — 인계 대상이 아니다(§16-3)
            share_class=CareBoardShareClass.INTERNAL.value,
            actor_id=note.author_id,
            title=f"필드노트 {note.note_number}" if note.note_number else "필드노트",
            body=_clip(note.summary),
        )

    # ── 바우처 차감 (billable_items가 사실상의 차감 원장 — §9-3) ──
    voucher_page = await ClientVoucherFacade(uow).list_client_vouchers_with_response(
        center_id=center_id, client_id=client_id
    )
    vouchers = voucher_page.items
    voucher_names = await VoucherFacade(uow).get_names_by_client_voucher_ids(
        [v.id for v in vouchers]
    )
    for voucher in vouchers:
        usages = await BillableFacade(uow).list_usage_by_voucher(
            center_id=center_id, client_voucher_id=voucher.id
        )
        name = voucher_names.get(voucher.id) or "바우처"
        for item, billable in usages:
            await record(
                kind=CareBoardKind.VOUCHER.value,
                occurred_at=item.provided_at or billable.created_at,
                source_table="billable_items",
                source_id=item.id,
                share_class=CareBoardShareClass.FACT.value,
                title=f"{name} {item.quantity}회 차감",
                meta=_voucher_meta(item.subsidy_amount),
            )

    # ── 메모 ──
    memos = await board.list_memos_for_client(center_id=center_id, client_id=client_id)
    for memo in memos:
        await record(
            kind=CareBoardKind.MEMO.value,
            occurred_at=memo.created_at,
            source_table="care_memos",
            source_id=memo.id,
            # 다른 상담사에게 하는 내부 발화 — 내담자에게도 타 센터에도 나가지 않는다
            share_class=CareBoardShareClass.INTERNAL.value,
            actor_id=memo.author_id,
            body=_clip(memo.body, 300),
        )

    # 원천에서 사라진 행 닫기 · 이력이 아니게 된 행 치우기.
    # 재구축은 upsert만 하므로 이 단계가 없으면 지워진 회기가 스트림에 살아남아
    # 없는 페이지로 가는 링크가 된다(domain.md §9-2).
    await board.prune_entries(
        center_id=center_id, client_id=client_id, kept=kept, excluded=excluded
    )

    return recorded


def _session_meta(status: str) -> str | None:
    return {"cancelled": "취소됨", "no_show": "노쇼"}.get(status)


def _task_subtitle(status: str) -> str | None:
    return {"cancelled": "취소", "submitted": "응답 완료"}.get(status)


def _document_meta(file_type: str | None) -> str | None:
    if not file_type:
        return None
    return file_type.rsplit("/", 1)[-1].upper()


def _voucher_meta(subsidy_amount: int | None) -> str | None:
    if not subsidy_amount:
        return None
    return f"지원금 {subsidy_amount:,}원"


async def _program_names(uow: UnitOfWork, program_ids: list[str]) -> dict[str, str]:
    from app.modules.center.facade import ProgramFacade

    unique = [pid for pid in dict.fromkeys(program_ids) if pid]
    if not unique:
        return {}
    return await ProgramFacade(uow).get_program_summaries_by_ids(unique)


async def _schedules_by_ids(uow: UnitOfWork, schedule_ids: list[str]) -> dict:
    unique = [sid for sid in dict.fromkeys(schedule_ids) if sid]
    if not unique:
        return {}
    schedules = await ScheduleFacade(uow).list_schedules_by_ids(unique)
    return {s.id: s for s in schedules}


TOOL = {
    "name": "rebuild_care_board_handler",
    "permission": "write:client",
    "purpose": "한 내담자의 케어보드 시간축을 원천(상담·검사·문서·필드노트·바우처·메모)에서 재구축한다.",
    "keywords": ["케어보드 재구축", "care board rebuild", "타임라인 재생성"],
    "boundaries": "쓰기 — care_board_entries를 source 키로 upsert한다(멱등). 조회는 list_care_board_stream_handler.",
    "output": "기록한 항목 수 (int).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "케어보드를 재구축할 내담자의 UUID.",
            }
        },
        "required": ["client_id"],
    },
}
