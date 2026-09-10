from ..events import InstitutionAtomic
from ..models import Institution
from ..repository import InstitutionRepository


class CreateInstitutionService:
    def __init__(
        self,
        repo: InstitutionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        phone: str | None = None,
        address: dict | None = None,
    ) -> tuple[InstitutionAtomic, Institution]:
        # mutate
        institution = await self.repo.add(
            name=name,
            phone=phone,
            address=address,
        )

        # return
        return InstitutionAtomic.created(institution=institution)
