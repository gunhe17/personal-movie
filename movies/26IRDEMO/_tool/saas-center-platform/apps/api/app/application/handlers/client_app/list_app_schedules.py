from datetime import datetime

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.assessment.facade.assessment_session_facade import AssessmentSessionFacade
from app.modules.billing.facade.billable_facade import BillableFacade
from app.modules.center.facade import (
    CenterFacade,
    MemberFacade,
    ProgramFacade,
    RoomFacade,
)
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppPendingChangeRequest, AppScheduleItem
from app.modules.counseling.facade.counseling_case_facade import CounselingCaseFacade
from app.modules.counseling.facade.counseling_session_facade import CounselingSessionFacade
from app.modules.family.facade import FamilyFacade
from app.modules.person.facade import PersonFacade
from app.modules.schedule.facade.schedule_change_request_facade import ScheduleChangeRequestFacade
from app.modules.schedule.facade.schedule_facade import ScheduleFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade

_PROGRAM_TYPE_LABEL = {"INDIVIDUAL": "개인", "GROUP": "그룹"}


def _assessment_title(case) -> str:
    if case.set_summary and case.set_summary.get("name"):
        return case.set_summary["name"]
    names = [
        item.get("kor_name") or item.get("eng_name")
        for item in (case.assessment_summary or [])
        if item.get("kor_name") or item.get("eng_name")
    ]
    return ", ".join(names) if names else "검사"


async def list_app_schedules_handler(
    *,
    person_id: uuid_str,
    start: datetime,
    end: datetime,
    uow: UnitOfWork,
) -> list[AppScheduleItem]:
    async with uow:
        family_id = await FamilyFacade(uow).find_family_id(person_id=person_id)
        if family_id is None:
            return []

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family_id, alive_only=True
        )
        links = [link for link in links if link.status == "active"]
        if not links:
            return []

        centers = await CenterFacade(uow).get_active_by_ids(
            list({link.center_id for link in links})
        )

        counseling_case_facade = CounselingCaseFacade(uow)
        counseling_session_facade = CounselingSessionFacade(uow)
        assessment_case_facade = AssessmentCaseFacade(uow)
        assessment_session_facade = AssessmentSessionFacade(uow)
        schedule_facade = ScheduleFacade(uow)

        # 케이스별 제목 소스 — counseling=프로그램(치료명+개인/그룹), assessment=검사 표시명.
        # schedule.title은 uuid·회기 자동생성이라 쓰지 않는다.
        counseling_cases: dict[str, object] = {}
        assessment_title_by_case: dict[str, str] = {}

        pending: list[tuple] = []
        for link in links:
            case_ids = await counseling_case_facade.list_case_ids_by_participant_ids(
                [link.client_id], link.center_id
            )
            counseling_sessions = await counseling_session_facade.get_sessions_by_case_ids(case_ids)
            for case in await counseling_case_facade.get_cases_by_ids(case_ids):
                counseling_cases[case.id] = case

            assessment_cases = await assessment_case_facade.get_cases_by_client(
                link.center_id, link.client_id
            )
            for case in assessment_cases:
                assessment_title_by_case[case.id] = _assessment_title(case)
            assessment_sessions = await assessment_session_facade.get_sessions_by_case_ids(
                [case.id for case in assessment_cases]
            )

            schedule_ids = [s.schedule_id for s in counseling_sessions if s.schedule_id]
            schedule_ids += [s.schedule_id for s in assessment_sessions if s.schedule_id]
            schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
            schedule_map = {s.id: s for s in schedules}

            for session, kind, default_title in [
                *[(s, "counseling", "상담") for s in counseling_sessions],
                *[(s, "assessment", "검사") for s in assessment_sessions],
            ]:
                schedule = schedule_map.get(session.schedule_id)
                if schedule is None or not (start <= schedule.start <= end):
                    continue
                pending.append((link, kind, default_title, session, schedule))

        # 담당자·상담실 이름 — 링크 루프 밖에서 1회 배치 조회(N+1 방지)
        member_ids = list({p[4].member_id for p in pending if p[4].member_id})
        room_ids = list({p[4].room_id for p in pending if p[4].room_id})
        members = await MemberFacade(uow).get_members_by_ids(member_ids) if member_ids else {}
        persons = (
            await PersonFacade(uow).get_persons_by_ids(
                list({m.person_id for m in members.values()})
            )
            if members
            else {}
        )
        rooms = await RoomFacade(uow).get_rooms_by_ids(room_ids)

        # counseling 케이스 → 치료명-개인/그룹 제목 (프로그램 배치 조회)
        program_ids = list(
            {c.program_id for c in counseling_cases.values() if c.program_id}
        )
        programs = (
            await ProgramFacade(uow).get_programs_by_ids(program_ids)
            if program_ids
            else {}
        )
        counseling_title_by_case: dict[str, str] = {}
        for case_id, case in counseling_cases.items():
            program = programs.get(case.program_id) if case.program_id else None
            if program is None:
                continue
            label = _PROGRAM_TYPE_LABEL.get(program.program_type)
            counseling_title_by_case[case_id] = (
                f"{program.name}-{label}" if label else program.name
            )

        # 회기 → 청구된 바우처 이름 (바우처 청구가 있는 회기만). session→client_voucher→제도명 2단.
        session_ids = [p[3].id for p in pending]
        session_voucher = await BillableFacade(uow).map_session_to_client_voucher(
            session_ids=session_ids
        )
        voucher_names = await VoucherFacade(uow).get_names_by_client_voucher_ids(
            list(set(session_voucher.values()))
        )

        change_requests = await ScheduleChangeRequestFacade(uow).list_pending_by_schedule_ids(
            [schedule.id for _, _, _, _, schedule in pending]
        )
        pending_change = {request.schedule_id: request for request in change_requests}

        # 완전 중복 방어 — 같은 (일정, 프로필)이 중복 case_id 등으로 두 번 들어오면 1개만.
        # (그룹 세션이 여러 프로필에 걸치는 건 정상 — profile_id가 다르므로 유지된다.)
        seen: set[tuple[str, str]] = set()
        items: list[AppScheduleItem] = []
        for link, kind, default_title, session, schedule in pending:
            dedupe_key = (schedule.id, link.profile_id)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            center = centers.get(link.center_id)
            member = members.get(schedule.member_id) if schedule.member_id else None
            person = persons.get(member.person_id) if member else None
            room = rooms.get(schedule.room_id) if schedule.room_id else None
            cv_id = session_voucher.get(session.id)
            if kind == "counseling":
                title = counseling_title_by_case.get(
                    session.counseling_case_id, default_title
                )
            else:
                title = assessment_title_by_case.get(session.case_id, default_title)
            items.append(
                AppScheduleItem(
                    schedule_id=schedule.id,
                    profile_id=link.profile_id,
                    center_id=link.center_id,
                    center_name=center.name if center else None,
                    kind=kind,
                    title=title,
                    start_time=schedule.start,
                    end_time=schedule.end,
                    status=session.status,
                    counselor_name=person.name if person else None,
                    room_name=room.name if room else None,
                    memo=schedule.memo,
                    voucher_name=voucher_names.get(cv_id) if cv_id else None,
                    pending_change_request=(
                        AppPendingChangeRequest(
                            request_id=change.id,
                            requested_start=change.requested_start,
                            requested_end=change.requested_end,
                        )
                        if (change := pending_change.get(schedule.id))
                        else None
                    ),
                )
            )

        items.sort(key=lambda item: item.start_time)
        return items
