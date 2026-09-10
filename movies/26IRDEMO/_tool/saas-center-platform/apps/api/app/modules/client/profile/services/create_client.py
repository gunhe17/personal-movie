import secrets
from datetime import date

from app.core.exceptions import ConflictException, InvalidOperationException
from ..repository import ClientRepository
from ..models import Client
from ..events import ClientAtomic
from ..default_avatars import pick_default_avatar_url

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # O, 0, I, 1 제외 (혼동 방지)
CODE_LENGTH = 6
MAX_CODE_RETRY = 5


class CreateClientService:
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def _generate_unique_code(self, center_id: str) -> str:
        for _ in range(MAX_CODE_RETRY):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if not await self.repo.exists_code_in_center(center_id=center_id, code=code):
                return code
        raise InvalidOperationException(
            f"클라이언트 코드 생성 실패: {MAX_CODE_RETRY}회 재시도 후에도 유니크한 코드를 생성하지 못했습니다."
        )

    async def execute(
        self,
        *,
        center_id: str,
        person_id: str | None,
        role: str,
        name: str,
        birth_date: date | None,
        gender: str | None,
        phone: str | None,
        email: str | None,
        address: str | None,
        profile_image_url: str | None,
        status: str,
        memo: str | None,
    ) -> tuple[ClientAtomic, Client]:
        # verify
        if person_id:
            existing_client = await self.repo.find_by_person_in_center(
                center_id=center_id,
                person_id=person_id,
            )
            if existing_client:
                raise ConflictException(
                    f"Person {person_id}는 이미 센터 {center_id}에 연동되어 있습니다"
                )

        if not person_id and birth_date:
            existing_client = await self.repo.find_by_name_birth_in_center(
                center_id=center_id,
                name=name,
                birth_date=birth_date,
            )
            if existing_client:
                raise ConflictException(
                    f"{name} ({birth_date})는 이미 등록되어 있습니다"
                )

        # build
        if not profile_image_url:
            profile_image_url = pick_default_avatar_url(gender)
        code = await self._generate_unique_code(center_id)

        # return
        client = await self.repo.add(
            center_id=center_id,
            person_id=person_id,
            role=role,
            name=name,
            birth_date=birth_date,
            gender=gender,
            phone=phone,
            email=email,
            address=address,
            profile_image_url=profile_image_url,
            status=status,
            memo=memo,
            code=code,
        )
        return ClientAtomic.created(client=client)
