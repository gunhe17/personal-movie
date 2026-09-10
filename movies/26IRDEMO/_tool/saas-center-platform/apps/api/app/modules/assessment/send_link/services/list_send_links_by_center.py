from ..repository import AssessmentSendLinkRepository


class ListSendLinksByCenterService:
    def __init__(self, repo: AssessmentSendLinkRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        page: int,
        size: int,
    ):
        # return
        return await self.repo.list_by_center_with_page(center_id, page=page, size=size)
