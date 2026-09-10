from datetime import datetime

from ..models import SessionStatus
from ...assessment_case.schemas import ConflictDetail
from ..repository import AssessmentSessionRepository


class AnalyzeScheduleChangesService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        case,
        has_schedule: bool,
        scheduled_start: datetime | None = None,
        scheduled_end: datetime | None = None,
        room_id: str | None = None,
        memo: str | None = None,
    ) -> tuple[list, list, dict]:
        conflicts = []
        warnings = []
        affected = {
            "sessions_to_cancel": [],
            "sessions_to_create": [],
            "schedules_to_update": [],
            "schedules_to_create": [],
        }

        # load (cancelled 제외)
        sessions = await self.repo.list_by_case(case_id=case.id)
        active_sessions = [s for s in sessions if s.status not in ("cancelled",)]
        current_session = active_sessions[0] if active_sessions else None

        # 시나리오 1: 온라인 → 대면 전환
        if not current_session and has_schedule:
            if not scheduled_start or not scheduled_end:
                conflicts.append(ConflictDetail(
                    conflict_type="schedule_required_fields_missing",
                    resource_id="",
                    resource_name="일정 정보",
                    current_status="",
                    message="일정을 생성하려면 scheduled_start와 scheduled_end가 필요합니다"
                ))
            else:
                affected["schedules_to_create"].append({
                    "start": scheduled_start,
                    "end": scheduled_end,
                    "room_id": room_id,
                    "memo": memo,
                })
                affected["sessions_to_create"].append({
                    "case_id": case.id,
                })
                warnings.append({
                    "type": "session_create",
                    "message": "대면 검사 Session이 생성됩니다"
                })

        # 시나리오 2: 대면 → 온라인 전환
        elif current_session and not has_schedule:
            if current_session.status == SessionStatus.ATTENDED:
                conflicts.append(ConflictDetail(
                    conflict_type="session_already_attended",
                    resource_id=current_session.id,
                    resource_name=f"Session ({current_session.id[:8]}...)",
                    current_status=current_session.status,
                    message="이미 참석한 Session이 있어 온라인으로 전환할 수 없습니다"
                ))
            else:
                affected["sessions_to_cancel"].append(current_session.id)
                # Schedule 삭제 후보 (Handler에서 다른 session 참조 여부 확인 후 삭제)
                affected["schedule_id_to_check"] = current_session.schedule_id
                warnings.append({
                    "type": "session_cancel",
                    "message": "대면 검사 Session이 취소됩니다"
                })

        # 시나리오 3: 대면 일정 시간/장소만 변경
        elif current_session and has_schedule:
            if current_session.status == SessionStatus.ATTENDED:
                conflicts.append(ConflictDetail(
                    conflict_type="session_already_attended",
                    resource_id=current_session.id,
                    resource_name=f"Session ({current_session.id[:8]}...)",
                    current_status=current_session.status,
                    message="이미 참석한 Session의 일정은 변경할 수 없습니다"
                ))
            else:
                affected["schedules_to_update"].append({
                    "schedule_id": current_session.schedule_id,
                    "start": scheduled_start,
                    "end": scheduled_end,
                    "room_id": room_id,
                    "memo": memo,
                })
                warnings.append({
                    "type": "schedule_update",
                    "message": "대면 검사 일정이 변경됩니다"
                })

        return conflicts, warnings, affected
