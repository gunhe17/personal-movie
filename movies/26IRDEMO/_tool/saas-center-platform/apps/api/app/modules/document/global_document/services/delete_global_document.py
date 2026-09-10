from ..repository import GlobalDocumentRepository


class DeleteGlobalDocumentService:
    def __init__(self, repo: GlobalDocumentRepository):
        self.repo = repo

    async def execute(self, document_id: str) -> bool:
        # return
        return await self.repo.remove_by_id(document_id) is not None
