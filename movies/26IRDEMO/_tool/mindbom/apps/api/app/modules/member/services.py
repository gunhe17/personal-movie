"""Member Services"""
from app.core.exceptions import (
    EntityNotFoundException,
    PermissionDeniedException,
)
from app.modules.member.models import Member
from app.modules.member.repository import MemberRepository


class GetMemberByAccountService:
    """계정 기반 멤버 조회 (인증 의존성용)"""
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, institution_id: str, account_id: str) -> Member | None:
        return await self.repo.get_by_account(institution_id, account_id)


class GetMemberByIdService:
    """멤버 ID 기반 조회 + institution 권한 검증"""
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, member_id: str, institution_id: str) -> Member:
        member = await self.repo.get(member_id)
        if not member:
            raise EntityNotFoundException(f"직원을 찾을 수 없습니다: {member_id}")
        if member.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 직원이 아닙니다.")
        return member


class CreateMemberService:
    """멤버 생성"""
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(
        self, institution_id: str, account_id: str, name: str, role: str = "clinician"
    ) -> Member:
        return await self.repo.create({
            "institution_id": institution_id,
            "account_id": account_id,
            "name": name,
            "role": role,
        })


class GetMembersByAccountIdService:
    """계정의 모든 멤버십 조회 (로그인 시 기관 정보 반환용)"""
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> list[Member]:
        return await self.repo.get_all_by_account_id(account_id)
