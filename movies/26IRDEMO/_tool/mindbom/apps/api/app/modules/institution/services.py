"""Institution Services"""
from app.core.exceptions import EntityNotFoundException
from app.modules.institution.models import Institution
from app.modules.institution.repository import InstitutionRepository
from app.modules.institution.schemas import InstitutionUpdate


class CreateInstitutionService:
    """기관 생성"""
    def __init__(self, repo: InstitutionRepository):
        self.repo = repo

    async def execute(self, name: str, institution_type: str = "clinic") -> Institution:
        return await self.repo.create({
            "name": name,
            "institution_type": institution_type,
        })


class GetInstitutionService:
    """기관 조회"""
    def __init__(self, repo: InstitutionRepository):
        self.repo = repo

    async def execute(self, institution_id: str) -> Institution | None:
        return await self.repo.get(institution_id)


class UpdateInstitutionService:
    """기관 정보 수정"""
    def __init__(self, repo: InstitutionRepository):
        self.repo = repo

    async def execute(
        self, institution_id: str, data: InstitutionUpdate
    ) -> Institution:
        institution = await self.repo.get(institution_id)
        if not institution:
            raise EntityNotFoundException(f"기관을 찾을 수 없습니다: {institution_id}")

        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            for key, value in update_data.items():
                setattr(institution, key, value)
            await self.repo.flush()
            await self.repo.refresh(institution)

        return institution
