from ..events import InstitutionAtomic
from ..models import Institution
from ..repository import InstitutionRepository


class UpdateInstitutionService:
    def __init__(
        self,
        repo: InstitutionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        **fields,
    ) -> tuple[InstitutionAtomic | None, Institution]:
        # load
        institution = await self.repo.get_by_id(id=institution_id)

        # mutate (빈 fields = no-op → atomic 없음, emit이 None을 걸러 미발행)
        if not fields:
            return None, institution
        updated = await self.repo.update_in_place(
            id=institution_id,
            **fields,
        )

        # return
        return InstitutionAtomic.updated(institution=updated, changed=fields)
