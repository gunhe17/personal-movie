from app.modules.form.signature.events import SignatureAtomic
from app.modules.form.signature.models import FormSignature
from app.modules.form.signature.repository import FormSignatureRepository
from app.core.datetime_utils import utc_now


class CreateSignatureService:
    def __init__(self, repo: FormSignatureRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        instance_id: str,
        field_id: str,
        signature_data: str,
        signer_name: str,
        signer_ip: str | None = None,
    ) -> tuple[SignatureAtomic, FormSignature]:
        # return
        signature = await self.repo.add(
            center_id=center_id,
            instance_id=instance_id,
            field_id=field_id,
            storage_type="base64",
            signature_data=signature_data,
            signer_name=signer_name,
            signed_at=utc_now(),
            signer_ip=signer_ip,
        )
        return SignatureAtomic.created(signature=signature)
