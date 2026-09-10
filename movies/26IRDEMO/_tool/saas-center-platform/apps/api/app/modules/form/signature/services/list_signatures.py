from app.modules.form.signature.models import FormSignature
from app.modules.form.signature.repository import FormSignatureRepository


class ListSignaturesService:
    def __init__(self, repo: FormSignatureRepository):
        self.repo = repo

    async def execute(self, instance_id: str) -> list[FormSignature]:
        # return
        return await self.repo.list_latest_per_field(instance_id=instance_id)
