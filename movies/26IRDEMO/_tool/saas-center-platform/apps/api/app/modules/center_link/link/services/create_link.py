from app.core.exceptions import InvalidOperationException
from app.core.type import utc_dt, uuid_str

from ..models import CenterLink
from ..repository import CenterLinkRepository


class CreateLinkService:
    def __init__(self, repo: CenterLinkRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
        profile_id: uuid_str,
        person_id: uuid_str,
        center_id: uuid_str,
        client_id: uuid_str,
        guardian_client_id: uuid_str,
        invitation_id: uuid_str | None,
        now: utc_dt,
        # 병합으로 링크를 옮길 때 원래 연결일을 넘긴다 — now 로 두면 앱의 "연결일"이 리셋된다
        linked_at: utc_dt | None = None,
    ) -> CenterLink:
        # verify — 멱등은 같은 매핑에 한해서만(§14-2 active 재시도). 다른 프로필·센터로
        # 바꾸려는 시도를 조용히 기존 링크로 흘리면 프로필만 생성·개명되고 감사 스냅샷이
        # 실제 링크와 어긋난다. 재매핑은 §14-1대로 revoke 후 새로 연결해야 한다.
        existing = await self.repo.find_alive_by_family_client(
            family_id=family_id,
            client_id=client_id,
        )
        if existing is not None:
            if (existing.profile_id, existing.center_id) != (profile_id, center_id):
                raise InvalidOperationException(
                    "이미 다른 프로필에 연결된 아이예요. 기존 연결을 해제한 뒤 다시 연결해 주세요"
                )
            return existing

        # return
        return await self.repo.add(
            family_id=family_id,
            profile_id=profile_id,
            person_id=person_id,
            center_id=center_id,
            client_id=client_id,
            guardian_client_id=guardian_client_id,
            invitation_id=invitation_id,
            status="active",
            linked_at=linked_at or now,
        )
