# 케이스의 최종 상태(내담자/담당자/장소/시간/회기 날짜)를 한 트랜잭션에 반영 — 순차 5~6 call을
# 단일 엔드포인트로 흡수해 원자성 보장(중간 실패 시 전체 롤백, 부분 업데이트 잔존 방지)
from datetime import date, datetime, time as dt_time, timedelta

from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)
from app.modules.counseling.counseling_session_participant.schemas import (
    ParticipantType,
)
from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.type import unset, uuid_str
from app.core.datetime_utils import kst_to_utc_naive
from app.modules.event import emit
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade
from app.application.schemas import ApplyCaseEditsRequest, ApplyCaseEditsResponse


def _parse_time(time_str: str) -> dt_time:
    h, m = time_str.split(":")
    return dt_time(int(h), int(m))


def _utc_to_kst_date_str(utc_naive: datetime) -> str:
    kst = utc_naive + timedelta(hours=9)
    return kst.strftime("%Y-%m-%d")


def _parse_kst_date(date_str: str) -> date:
    y, m, d = date_str.split("-")
    return date(int(y), int(m), int(d))


async def apply_case_edits_handler(
    event_group_id: uuid_str,
    center_id: str,
    member_id: str,
    owner_scope: str | None,
    case_id: str,
    data: ApplyCaseEditsRequest,
    uow: UnitOfWork,
) -> ApplyCaseEditsResponse:
    # owner_scope: 본인 소유 케이스만 접근 제한 시 member_id, 관리자면 None
    start_t = _parse_time(data.start_time)
    end_t = _parse_time(data.end_time)
    target_counselor_id = data.counselor_ids[0]

    warnings: list[str] = []
    schedule_atomics: list = []
    created_session_atomics: list = []
    deleted_session_atomics: list = []
    schedule_deleted_atomics: list = []
    clients_added_count = 0
    clients_removed_count = 0
    sessions_added_count = 0
    sessions_removed_count = 0
    sessions_updated_count = 0

    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    # owner_scope 가 있으면 본인 소유 케이스인지 여기서 검증(불일치 시 404).
    # 이후 facade 호출은 None 으로 전달 (이미 검증 완료).
    case = await case_facade.get_case_by_id(case_id, center_id, owner_scope)

    participants_response = await case_facade.list_participants_with_response(
        case_id=case_id,
        center_id=center_id,
        counselor_id=None,  # 권한 검증 생략 (Application Handler)
        active_only=True,
    )
    # client_id -> CaseParticipant.id
    current_client_pids: dict[str, str] = {}
    # member_id -> CaseParticipant.id (담당자)
    current_counselor_pids: dict[str, str] = {}
    for p in participants_response.items:
        if p.participant_type.value == CaseParticipantType.CLIENT.value:
            current_client_pids[p.participant_id] = p.id
        elif p.participant_type.value == CaseParticipantType.COUNSELOR.value:
            current_counselor_pids[p.participant_id] = p.id

    all_sessions = await session_facade.get_sessions_by_case_ids([case_id])
    scheduled_sessions = [
        s for s in all_sessions if s.status == CounselingSessionStatus.SCHEDULED
    ]
    non_scheduled_count = len(all_sessions) - len(scheduled_sessions)

    schedule_ids = [s.schedule_id for s in scheduled_sessions]
    schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
    schedule_map = {sch.id: sch for sch in schedules}

    current_dates_map: dict[str, tuple] = {}  # "YYYY-MM-DD" -> (session, schedule)
    for session in scheduled_sessions:
        sched = schedule_map.get(session.schedule_id)
        if sched is None:
            continue
        kst_date_str = _utc_to_kst_date_str(sched.start)
        current_dates_map[kst_date_str] = (session, sched)

    target_client_ids = set(data.client_ids)
    current_client_id_set = set(current_client_pids.keys())
    clients_to_add = target_client_ids - current_client_id_set
    clients_to_remove = current_client_id_set - target_client_ids

    # 담당자 diff — set 변경(추가/제거) + primary 변경 모두 counselor_changed 로 취급.
    # 둘 중 하나라도 바뀌면 기존 scheduled 세션의 schedule.member_id +
    # session_participants(counselor) 도 자동으로 동기화한다.
    target_counselor_id_set = set(data.counselor_ids)
    current_counselor_id_set = set(current_counselor_pids.keys())
    counselors_to_add = target_counselor_id_set - current_counselor_id_set
    counselors_to_remove = current_counselor_id_set - target_counselor_id_set
    counselor_set_changed = bool(counselors_to_add) or bool(counselors_to_remove)
    primary_counselor_changed = case.counselor_id != target_counselor_id
    counselor_changed = primary_counselor_changed or counselor_set_changed

    target_dates = set(data.session_dates)
    current_date_set = set(current_dates_map.keys())
    dates_to_add = sorted(target_dates - current_date_set)
    dates_to_remove = current_date_set - target_dates

    case_updated_atomics = []
    if primary_counselor_changed:
        c_atomic, _ = await case_facade.update_case(
            case_id,
            center_id,
            None,
            changed={"counselor_id": target_counselor_id},
            counselor_id=target_counselor_id,
        )
        case_updated_atomics.append(c_atomic)

    participant_added_atomics = []
    participant_left_atomics = []
    session_participant_removed_atomics = []
    session_participant_added_atomics = []

    for client_id in clients_to_add:
        p_atomics, _ = await case_facade.add_participant(
            case_id=case_id,
            center_id=center_id,
            counselor_id=None,
            participant_id=client_id,
            participant_type=CaseParticipantType.CLIENT,
        )
        participant_added_atomics.extend(p_atomics)
        clients_added_count += 1

    for client_id in clients_to_remove:
        case_participant_id = current_client_pids[client_id]
        p_atomics, _ = await case_facade.leave_participant(
            case_id=case_id,
            participant_id=case_participant_id,
            center_id=center_id,
            counselor_id=None,
        )
        participant_left_atomics.extend(p_atomics)
        clients_removed_count += 1

    # 신규 회기 생성 시 InitializeSessionParticipantsService 가 case_participants
    # 를 복사해서 session_participants 를 초기화하므로, 새 세션이 정확한
    # 담당자 목록을 갖도록 여기서 먼저 동기화한다.
    for counselor_id in counselors_to_add:
        p_atomics, _ = await case_facade.add_participant(
            case_id=case_id,
            center_id=center_id,
            counselor_id=None,
            participant_id=counselor_id,
            participant_type=CaseParticipantType.COUNSELOR,
        )
        participant_added_atomics.extend(p_atomics)

    for counselor_id in counselors_to_remove:
        case_participant_id = current_counselor_pids[counselor_id]
        p_atomics, _ = await case_facade.leave_participant(
            case_id=case_id,
            participant_id=case_participant_id,
            center_id=center_id,
            counselor_id=None,
        )
        participant_left_atomics.extend(p_atomics)

    # delete_session 은 counseling_sessions 레코드만 삭제하므로
    # 해당 schedules 도 별도로 soft delete 해야 캘린더 뷰에서 사라진다.
    # 이게 없으면 캘린더에 "[상담] -" 형태의 고아 schedule 이 남는다.
    schedule_ids_to_delete: list[str] = []
    for date_str in dates_to_remove:
        session, sched = current_dates_map[date_str]
        deleted_atomics, _ = await session_facade.delete_session(
            session_id=session.id,
            center_id=center_id,
            counselor_id=None,
        )
        deleted_session_atomics.extend(deleted_atomics)
        schedule_ids_to_delete.append(sched.id)
        sessions_removed_count += 1

    if schedule_ids_to_delete:
        schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
            schedule_ids_to_delete
        )

    remaining_pairs = [
        (s, sch)
        for date_str, (s, sch) in current_dates_map.items()
        if date_str not in dates_to_remove
    ]

    for session, sched in remaining_pairs:
        current_kst_date = (sched.start + timedelta(hours=9)).date()
        new_start = kst_to_utc_naive(current_kst_date, start_t)
        new_end = kst_to_utc_naive(current_kst_date, end_t)

        time_diff = sched.start != new_start or sched.end != new_end
        room_diff = data.room_id is not None and sched.room_id != data.room_id

        if time_diff or room_diff:
            await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=sched.id,
                start=new_start if time_diff else unset,
                end=new_end if time_diff else unset,
                room_id=data.room_id if room_diff else unset,
            )
            sessions_updated_count += 1

            check_room = data.room_id if room_diff else sched.room_id
            if check_room:
                conflicts = await schedule_facade.validate_schedule(
                    center_id=center_id,
                    room_id=check_room,
                    start=new_start,
                    end=new_end,
                    exclude_id=sched.id,
                )
                if conflicts:
                    conflict_titles = [c.title or "일정" for c in conflicts]
                    warnings.append(
                        f"{new_start.strftime('%Y-%m-%d %H:%M')} - "
                        f"동일 장소에 겹치는 일정: {', '.join(conflict_titles)}"
                    )

        if counselor_changed:
            await schedule_facade.update_schedule(
                center_id=center_id,
                schedule_id=sched.id,
                member_id=target_counselor_id,
            )
            (
                removed_atomics,
                _,
            ) = await session_facade.delete_session_participants_by_type(
                session_id=session.id,
                participant_type=CaseParticipantType.COUNSELOR,
            )
            session_participant_removed_atomics.extend(removed_atomics)
            sp_atomics, _ = await session_facade.add_session_participants(
                session_id=session.id,
                center_id=center_id,
                counselor_id=None,
                client_ids=None,
                counselor_ids=list(data.counselor_ids),
            )
            session_participant_added_atomics.extend(sp_atomics)

        # 내담자 변경 sync (옵션 — 유저 확인 후 true 일 때만)
        if data.sync_clients_to_scheduled_sessions and (
            clients_to_add or clients_to_remove
        ):
            (
                removed_atomics,
                _,
            ) = await session_facade.delete_session_participants_by_type(
                session_id=session.id,
                participant_type=CaseParticipantType.CLIENT,
            )
            session_participant_removed_atomics.extend(removed_atomics)
            if data.client_ids:
                sp_atomics, _ = await session_facade.add_session_participants(
                    session_id=session.id,
                    center_id=center_id,
                    counselor_id=None,
                    client_ids=list(data.client_ids),
                    counselor_ids=None,
                )
                session_participant_added_atomics.extend(sp_atomics)

    # session_number = non_scheduled(완료/취소 등) + 삭제 후 남은 scheduled + 새로 추가되는 순번
    remaining_scheduled_count = len(remaining_pairs)
    base_session_number = non_scheduled_count + remaining_scheduled_count

    for idx, date_str in enumerate(dates_to_add):
        session_number = base_session_number + idx + 1
        kst_date = _parse_kst_date(date_str)
        new_start = kst_to_utc_naive(kst_date, start_t)
        new_end = kst_to_utc_naive(kst_date, end_t)

        schedule_atomic, new_schedule = await schedule_facade.create_schedule(
            center_id=center_id,
            schedule_type="counseling",
            start=new_start,
            end=new_end,
            member_id=target_counselor_id,
            room_id=data.room_id,
            title=f"{case.case_code} - {session_number}회기",
            memo=None,
        )
        schedule_atomics.append(schedule_atomic)
        conflicts = await schedule_facade.list_conflicting_schedules(
            center_id=center_id,
            start=new_schedule.start,
            end=new_schedule.end,
            room_id=new_schedule.room_id,
            member_id=new_schedule.member_id,
            exclude_id=new_schedule.id,
        )
        if conflicts:
            conflict_titles = [c.title or "일정" for c in conflicts]
            warnings.append(
                f"{session_number}회기 ({new_start.strftime('%Y-%m-%d %H:%M')}) - "
                f"동일 장소에 겹치는 일정: {', '.join(conflict_titles)}"
            )

        session_atomics, _ = await session_facade.create_session(
            center_id=center_id,
            counselor_id=None,
            counseling_case_id=case_id,
            schedule_id=new_schedule.id,
            session_number=session_number,
        )
        created_session_atomics.extend(session_atomics)
        sessions_added_count += 1

    await emit(
        uow,
        "counseling_case_edits_applied",
        event_group_id=event_group_id,
        atomics=[
            *schedule_atomics,
            *created_session_atomics,
            *deleted_session_atomics,
            *schedule_deleted_atomics,
            *participant_added_atomics,
            *case_updated_atomics,
            *session_participant_added_atomics,
            *session_participant_removed_atomics,
            *participant_left_atomics,
        ],
        center_id=center_id,
        actor_id=member_id,
    )

    return ApplyCaseEditsResponse(
        case_id=case_id,
        clients_added=clients_added_count,
        clients_removed=clients_removed_count,
        sessions_added=sessions_added_count,
        sessions_removed=sessions_removed_count,
        sessions_updated=sessions_updated_count,
        warnings=warnings,
    )


TOOL = {
    "name": "apply_case_edits_handler",
    "permission": "write:counseling",
    "purpose": "상담 케이스의 최종 상태(내담자·담당자·장소·시간·회기 날짜)를 한 번에 받아 현재 상태와의 차이를 계산해 통째로 반영한다.",
    "keywords": [
        "apply case edits",
        "케이스 통합 수정",
        "상담 일괄 편집",
        "한번에 수정",
        "내담자 담당자 변경",
        "회기 날짜 조정",
        "전체 반영",
        "케이스 편집 저장",
        "수정 모달 저장",
    ],
    "boundaries": "상담 편집 화면(CounselingCaseEditModal)의 전체 폼 상태를 받아 추가·삭제·수정을 서버가 diff로 알아서 처리하는 종합 수정 도구다. 내담자/담당자/회기 날짜를 따로따로 고민하지 않고 '최종 모습'만 던지면 된다. 단순히 케이스 메타(주호소·메모·상태)만 바꾸려면 update_case_handler를, 여러 회기의 시간만 일괄 이동하려면 bulk_update_sessions_handler를, 회기를 새로 덧붙이기만 하려면 add_sessions_to_case_handler를 쓴다.",
    "output": "케이스 통합 수정 결과 (ApplyCaseEditsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "통합 수정할 상담 케이스의 UUID.",
            },
            "client_ids": {
                "description": "최종 내담자 UUID 목록(전체 교체).",
                "items": {"type": "string"},
                "title": "내담자 목록",
                "type": "array",
            },
            "counselor_ids": {
                "description": "최종 담당자 member_id 목록(전체 교체, 첫 번째가 대표 담당자).",
                "items": {"type": "string"},
                "minItems": 1,
                "title": "담당자 목록",
                "type": "array",
            },
            "room_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "상담실 UUID(null 허용).",
                "title": "상담실",
            },
            "start_time": {
                "description": "회기 시작 시간 HH:MM(KST).",
                "pattern": "^\\d{2}:\\d{2}$",
                "title": "시작 시간",
                "type": "string",
            },
            "end_time": {
                "description": "회기 종료 시간 HH:MM(KST).",
                "pattern": "^\\d{2}:\\d{2}$",
                "title": "종료 시간",
                "type": "string",
            },
            "session_dates": {
                "description": "최종 회기 날짜(YYYY-MM-DD, KST) 목록. 기존 예약 회기와 diff 후 추가/삭제.",
                "items": {"type": "string"},
                "title": "회기 날짜 목록",
                "type": "array",
            },
            "sync_clients_to_scheduled_sessions": {
                "default": False,
                "description": "True면 내담자 변경을 기존 예약 회기 참여자에도 반영(기본 False).",
                "title": "내담자 동기화",
                "type": "boolean",
            },
        },
        "required": [
            "case_id",
            "client_ids",
            "counselor_ids",
            "start_time",
            "end_time",
            "session_dates",
        ],
    },
}
