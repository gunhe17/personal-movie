from ..events import InstitutionAtomic
from ..models import Institution
from ..repository import InstitutionRepository


class DeleteInstitutionService:
    def __init__(
        self,
        repo: InstitutionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
    ) -> tuple[InstitutionAtomic, Institution]:
        # load
        institution = await self.repo.get_by_id(id=institution_id)

        # remove
        removed = await self.repo.remove_by_id(id=institution_id)

        # return
        return InstitutionAtomic.deleted(institution=removed if removed is not None else institution)
