from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .models import FAQ
from .repository import FAQRepository


class FAQFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def list_published_with_page(
        self,
        *,
        category: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 100,
    ):
        return await self._uow.repo(FAQRepository).list_published_with_page(
            category=category, search=search, page=page, size=size
        )
