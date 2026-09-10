from app.infrastructure.persistence.new_repository import Page

from ..models import VoucherExtraction
from ..repository import VoucherExtractionRepository


class ListExtractionsService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        status: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[VoucherExtraction], Page]:
        # return
        return await self.repo.list_paginated_with_page(
            status=status, page=page, size=size,
        )
