from dataclasses import dataclass
from datetime import datetime

from ..repository import CounselingSessionParticipantRepository


@dataclass(frozen=True)
class AttendancePoint:
    session_id: str
    attendance_status: str  # attended | absent | late | excused | no_show
    session_at: datetime | None


class ListAttendancePatternService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        client_id: str,
        center_id: str,
        limit: int,
    ) -> list[AttendancePoint]:
        rows = await self.repo.aggregate_recent_attendance_for_client(
            client_id=client_id, center_id=center_id, limit=limit
        )
        # 시간순(과거→최신)으로 뒤집어 ●○ 시각화에 직관적인 순서로 반환
        points = [
            AttendancePoint(
                session_id=row[2],
                attendance_status=row[0],
                session_at=row[1],
            )
            for row in rows
        ]
        return list(reversed(points))
