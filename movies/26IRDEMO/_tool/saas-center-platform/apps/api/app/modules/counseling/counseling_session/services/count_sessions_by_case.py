from ..repository import CounselingSessionRepository


class CountSessionsByCaseService:
    def __init__(
        self,
        repo: CounselingSessionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        center_id: str,
    ) -> int:
        # return (취소 회기는 소진이 아님 — 총회기 자동 확장 기준에서 제외)
        return await self.repo.count_open_by_case(
            case_id=case_id,
            center_id=center_id,
        )
