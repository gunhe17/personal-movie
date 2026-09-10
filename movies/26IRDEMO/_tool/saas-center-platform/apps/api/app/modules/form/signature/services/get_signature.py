from app.modules.form.signature.models import FormSignature
from app.modules.form.signature.repository import FormSignatureRepository


class GetSignatureService:
    def __init__(self, repo: FormSignatureRepository):
        self.repo = repo

    async def execute(self, *, signature_id: str, center_id: str) -> FormSignature:
        # return
        return await self.repo.get_in_center(
            signature_id=signature_id,
            center_id=center_id,
        )
