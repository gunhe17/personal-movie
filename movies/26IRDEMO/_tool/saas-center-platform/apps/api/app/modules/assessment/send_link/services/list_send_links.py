from ..repository import AssessmentSendLinkRepository
from ..models import AssessmentSendLink


class ListSendLinksService:
    def __init__(self, repo: AssessmentSendLinkRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
    ) -> list[AssessmentSendLink]:
        # return
        return await self.repo.list_by_case(center_id=center_id, case_id=case_id)
