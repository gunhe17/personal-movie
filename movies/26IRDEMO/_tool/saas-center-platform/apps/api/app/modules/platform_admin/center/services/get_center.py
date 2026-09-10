from app.modules.center.center.models import Center
from app.modules.center.member.models import Member
from app.modules.person.person.models import Person
from app.modules.role.role.models import Role
from app.modules.platform_admin.center.repository import AdminCenterRepository


class GetCenterService:
    def __init__(self, repo: AdminCenterRepository):
        self.repo = repo

    async def execute(
        self, *, center_id: str
    ) -> tuple[Center, list[tuple[Member, Person, Role]], dict[str, str]]:
        # 1. 센터 조회
        center = await self.repo.get_center(center_id)

        # 2. 멤버 + Person + Role 조회
        member_rows = await self.repo.aggregate_members_with_details(center_id)

        # 3. Account에서 email 조회
        person_ids = [person.id for _, person, _ in member_rows]
        email_map = await self.repo.aggregate_emails_by_person_ids(person_ids)

        return center, member_rows, email_map
