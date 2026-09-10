from ..models import Center
from ..repository import CenterRepository


class GetCenterService:
    def __init__(self, repo: CenterRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> Center:
        # return
        return await self.repo.get_active(id=center_id)
