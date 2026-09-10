from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.assessment.facade.task_facade import AssessmentTaskFacade
from app.modules.billing.facade.billable_facade import BillableFacade
from app.modules.center.facade import CenterFacade, MemberFacade, ProgramFacade, RoomFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import (
    AppAssessmentItem,
    AppAssessmentTaskItem,
    AppCounselingProgressItem,
    AppCounselingSessionItem,
    AppProfileProgressResponse,
    AppSessionShareItem,
)
from app.modules.counseling.facade.counseling_case_facade import CounselingCaseFacade
from app.modules.counseling.facade.counseling_note_share_facade import (
    CounselingNoteShareFacade,
)
from app.modules.counseling.facade.counseling_session_facade import CounselingSessionFacade
from app.modules.family.facade import FamilyFacade
from app.modules.person.facade import PersonFacade
from app.modules.schedule.facade.schedule_facade import ScheduleFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade

CONSUMED_SESSION_STATUSES = ("completed", "no_show")


async def get_profile_progress_handler(
    *,
    person_id: uuid_str,
    profile_id: uuid_str,
    uow: UnitOfWork,
) -> AppProfileProgressResponse:
    async with uow:
        family_facade = FamilyFacade(uow)
        family = await family_facade.ensure_family(person_id=person_id)
        await family_facade.get_profile(profile_id=profile_id, family_id=family.id)

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family.id, alive_only=True
        )
        links = [
            link
            for link in links
            if link.profile_id == profile_id and link.status == "active"
        ]
        if not links:
            return AppProfileProgressResponse()

        centers = await CenterFacade(uow).get_active_by_ids(
            list({link.center_id for link in links})
        )

        counseling_case_facade = CounselingCaseFacade(uow)
        counseling_session_facade = CounselingSessionFacade(uow)
        assessment_case_facade = AssessmentCaseFacade(uow)
        assessment_task_facade = AssessmentTaskFacade(uow)
        schedule_facade = ScheduleFacade(uow)

        counseling_items: list[AppCounselingProgressItem] = []
        assessment_items: list[AppAssessmentItem] = []

        for link in links:
            center = centers.get(link.center_id)
            center_name = center.name if center else None

            # 상담 진행 현황 — 진행 N/M·회기 목록만 (임상 원문·노트는 G1 비노출)
            case_ids = await counseling_case_facade.list_case_ids_by_participant_ids(
                [link.client_id], link.center_id
            )
            cases = await counseling_case_facade.get_cases_by_ids(case_ids)
            programs = await ProgramFacade(uow).get_programs_by_ids(
                [case.program_id for case in cases if case.program_id]
            )
            sessions = await counseling_session_facade.get_sessions_by_case_ids(case_ids)
            schedules = await schedule_facade.list_schedules_by_ids(
                [s.schedule_id for s in sessions if s.schedule_id]
            )
            schedule_map = {s.id: s for s in schedules}
            rooms = await RoomFacade(uow).get_rooms_by_ids(
                list({s.room_id for s in schedules if s.room_id})
            )

            # 회기 → 청구된 바우처 이름 (청구가 있는 회기만). session→client_voucher→제도명 2단.
            session_voucher = await BillableFacade(uow).map_session_to_client_voucher(
                session_ids=[s.id for s in sessions]
            )
            voucher_names = await VoucherFacade(uow).get_names_by_client_voucher_ids(
                list(set(session_voucher.values()))
            )

            counselor_names = await _resolve_counselor_names(
                uow, [case.counselor_id for case in cases if case.counselor_id]
            )

            # 상담 내용은 발행된 공유문으로만 나간다 — 임상 원문(counseling_notes)은 G1 비노출
            shares = await CounselingNoteShareFacade(uow).list_published_shares(
                session_ids=[s.id for s in sessions],
                client_id=link.client_id,
                center_id=link.center_id,
            )
            share_map = {sh.counseling_session_id: sh for sh in shares}

            for case in cases:
                case_sessions = [
                    s for s in sessions if s.counseling_case_id == case.id
                ]
                case_sessions.sort(key=lambda s: (s.session_number or 0))
                session_starts = [
                    schedule_map[s.schedule_id].start
                    for s in case_sessions
                    if s.schedule_id in schedule_map
                ]
                counseling_items.append(
                    AppCounselingProgressItem(
                        case_id=case.id,
                        center_id=link.center_id,
                        center_name=center_name,
                        counseling_type=(
                            programs[case.program_id].name
                            if case.program_id and case.program_id in programs
                            else None
                        ),
                        counselor_name=counselor_names.get(case.counselor_id),
                        total_sessions=case.total_sessions or len(case_sessions),
                        completed_sessions=sum(
                            1
                            for s in case_sessions
                            if s.status in CONSUMED_SESSION_STATUSES
                        ),
                        started_at=min(session_starts) if session_starts else None,
                        next_session_at=_next_session_at(case_sessions, schedule_map),
                        voucher_name=_case_voucher_name(
                            case_sessions, session_voucher, voucher_names
                        ),
                        sessions=[
                            AppCounselingSessionItem(
                                session_id=s.id,
                                round=s.session_number,
                                scheduled_at=(
                                    schedule_map[s.schedule_id].start
                                    if s.schedule_id in schedule_map
                                    else None
                                ),
                                end_at=(
                                    schedule_map[s.schedule_id].end
                                    if s.schedule_id in schedule_map
                                    else None
                                ),
                                room_name=_room_name(s, schedule_map, rooms),
                                status=s.status,
                                share=_share_item(share_map.get(s.id)),
                            )
                            for s in case_sessions
                        ],
                    )
                )

            # 검사 — 상태·진행률·보고서 공개 여부만 (G3: is_report_visible_to_guardian)
            assessment_cases = await assessment_case_facade.get_cases_by_client(
                link.center_id, link.client_id
            )
            progress_map = await assessment_task_facade.get_task_progress_for_cases(
                [case.id for case in assessment_cases]
            )
            for case in assessment_cases:
                tasks = await assessment_task_facade.get_tasks_by_case_id(case.id)
                progress = progress_map.get(case.id)
                task_names = _assessment_name_map(case)
                assessment_items.append(
                    AppAssessmentItem(
                        case_id=case.id,
                        center_id=link.center_id,
                        center_name=center_name,
                        name=_case_display_name(case),
                        status=case.status,
                        completed_count=progress.completed_count if progress else 0,
                        total_count=progress.total_count if progress else 0,
                        report_visible=any(
                            task.is_report_visible_to_guardian for task in tasks
                        ),
                        tasks=[
                            AppAssessmentTaskItem(
                                task_id=task.id,
                                name=task_names.get(task.assessment_id, "검사"),
                                status=task.status,
                                report_visible=task.is_report_visible_to_guardian,
                            )
                            for task in tasks
                        ],
                    )
                )

        return AppProfileProgressResponse(
            counseling=counseling_items,
            assessments=assessment_items,
        )


async def _resolve_counselor_names(
    uow: UnitOfWork, member_ids: list[str]
) -> dict[str, str | None]:
    if not member_ids:
        return {}
    members = await MemberFacade(uow).get_members_by_ids(list(set(member_ids)))
    persons = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in members.values()]
    )
    return {
        member_id: (
            persons[member.person_id].name
            if member.person_id in persons
            else None
        )
        for member_id, member in members.items()
    }


def _share_item(share) -> AppSessionShareItem | None:
    if share is None:
        return None
    content = share.content or {}
    return AppSessionShareItem(
        text=content.get("text"),
        published_at=share.published_at,
    )


def _room_name(session, schedule_map, rooms) -> str | None:
    schedule = schedule_map.get(session.schedule_id)
    if schedule is None or schedule.room_id is None:
        return None
    room = rooms.get(schedule.room_id)
    return room.name if room else None


def _case_voucher_name(case_sessions, session_voucher, voucher_names) -> str | None:
    for s in case_sessions:
        cv_id = session_voucher.get(s.id)
        if cv_id and cv_id in voucher_names:
            return voucher_names[cv_id]
    return None


def _next_session_at(case_sessions, schedule_map) -> datetime | None:
    now = utc_now()
    upcoming = [
        schedule_map[s.schedule_id].start
        for s in case_sessions
        if s.status == "scheduled"
        and s.schedule_id in schedule_map
        and schedule_map[s.schedule_id].start >= now
    ]
    return min(upcoming) if upcoming else None


def _assessment_name_map(case) -> dict[str, str]:
    return {
        item["id"]: item.get("kor_name") or item.get("eng_name") or "검사"
        for item in (case.assessment_summary or [])
        if item.get("id")
    }


def _case_display_name(case) -> str:
    if case.set_summary and case.set_summary.get("name"):
        return case.set_summary["name"]
    names = [
        item.get("kor_name") or item.get("eng_name")
        for item in (case.assessment_summary or [])
        if item.get("kor_name") or item.get("eng_name")
    ]
    return ", ".join(names) if names else "검사"
