from app.infrastructure.persistence.unit_of_work import UnitOfWork
from .. import GetInstitutionService
from ..institution.repository import InstitutionRepository
from .schemas import InstitutionSummary


class InstitutionFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_summary(self, institution_id: str) -> InstitutionSummary:
        repo = self._uow.repo(InstitutionRepository)
        service = GetInstitutionService(repo)
        institution = await service.execute(institution_id)

        addr = institution.address
        if isinstance(addr, dict):
            parts = [addr.get("zip_code"), addr.get("address"), addr.get("detail")]
            address_str = " ".join(p for p in parts if p) or None
        else:
            address_str = addr

        return InstitutionSummary(
            institution_id=institution.id,
            name=institution.name,
            phone=institution.phone,
            address=address_str,
        )
