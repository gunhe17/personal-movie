from ..repository import AssessmentSessionRepository


class CountActiveSessionsByScheduleService:
    # batch에서 여러 session이 같은 schedule을 공유할 수 있어, 남은 active session 유무로 Schedule 삭제 여부를 판단

    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        schedule_id: str,
        exclude_session_ids: list[str] | None = None,
    ) -> int:
        return await self.repo.count_active_by_schedule_id(
            schedule_id=schedule_id,
            exclude_session_ids=exclude_session_ids,
        )
