import secrets

from ..events import CenterAtomic
from ..models import Center
from ..repository import CenterRepository


class CreateCenterService:
    def __init__(
        self,
        repo: CenterRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        phone: str | None = None,
        address: dict | None = None,
        description: str | None = None,
        logo_url: str | None = None,
        business_registration_number: str | None = None,
        representative_name: str | None = None,
    ) -> tuple[CenterAtomic, Center]:
        # load
        code = await self._generate_unique_code()

        # create
        center = await self.repo.add(
            name=name,
            code=code,
            phone=phone,
            address=address,
            description=description,
            logo_url=logo_url,
            business_registration_number=business_registration_number,
            representative_name=representative_name,
            is_active=True,
        )

        # return
        return CenterAtomic.created(center=center)

    async def _generate_unique_code(self) -> str:
        CODE_ALPHABET = (
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # O, 0, I, 1 제외 (혼동 방지)
        )
        CODE_LENGTH = 6
        MAX_CODE_RETRY = 5

        for _ in range(MAX_CODE_RETRY):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if not await self.repo.exists_by_code(code=code):
                return code

        raise ValueError(
            f"센터 코드 생성 실패: {MAX_CODE_RETRY}회 재시도 후에도 유니크한 코드를 생성하지 못했습니다."
        )
