from app.modules.platform_admin.center_application.repository import AdminApplicationRepository
from app.modules.platform_admin.center_application.schemas import AdminApplicationSummary


class ListApplicationsService:
    def __init__(self, repo: AdminApplicationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AdminApplicationSummary], int]:
        rows, total = await self.repo.list_applications_with_page(
            status=status,
            search=search,
            page=page,
            size=size,
        )

        items = [
            AdminApplicationSummary(
                id=app.id,
                center_name=app.name,
                applicant_name=person_name,
                applicant_email=account_email,
                business_registration_number=app.business_registration_number,
                status=app.status.lower(),
                created_at=app.created_at,
                reviewed_at=app.reviewed_at,
                reviewed_reason=app.reviewed_reason,
            )
            for app, person_name, account_email in rows
        ]

        return items, total
