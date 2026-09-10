from ..events import CareMemoAtomic
from ..models import CareMemo
from ..repository import CareMemoRepository


class CreateMemoService:
    def __init__(self, repo: CareMemoRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        author_id: str,
        body: str,
    ) -> tuple[CareMemoAtomic, CareMemo]:
        created = await self.repo.add(
            center_id=center_id,
            client_id=client_id,
            author_id=author_id,
            body=body.strip(),
        )
        return CareMemoAtomic.created(memo=created)
