from datetime import date

from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import unset
from ..repository import ClientRepository
from ..models import Client
from ..events import ClientAtomic


class UpdateClientService:
    # role 전환 규칙 (edge-cases.md:629-673, both 승격은 내담자앱-설계.md §0-5)
    ALLOWED_ROLE_TRANSITIONS = {
        "guardian": ["both"],              # 보호자가 상담 시작
        "both": ["client", "guardian"],    # 자녀 성인되어 보호자 역할 종료, 또는 원래 역할로 복귀
        "client": ["both"]                 # 내담자가 보호자 겸함(형제 등록·본인 앱 연결 승격)
    }

    # 상태 전이 규칙 (scenarios.md:742-750)
    ALLOWED_STATUS_TRANSITIONS = {
        "active": ["inactive"],
        "inactive": ["active", "archived"],
        "archived": ["active"],
    }

    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        changed: dict,
        role: str = unset,
        name: str = unset,
        birth_date: date | None = unset,
        gender: str | None = unset,
        phone: str | None = unset,
        email: str | None = unset,
        address: str | None = unset,
        profile_image_url: str | None = unset,
        status: str = unset,
        memo: str | None = unset,
    ) -> tuple[ClientAtomic, Client]:
        # load
        client = await self.repo.get_in_center(center_id=center_id, client_id=client_id)

        update_data = {
            k: v
            for k, v in {
                "role": role,
                "name": name,
                "birth_date": birth_date,
                "gender": gender,
                "phone": phone,
                "email": email,
                "address": address,
                "profile_image_url": profile_image_url,
                "status": status,
                "memo": memo,
            }.items()
            if v is not unset
        }
        if not update_data:
            return ClientAtomic.updated(client=client, changed=changed)

        # verify
        if "role" in update_data and update_data["role"] != client.role:
            self._validate_role_transition(client.role, update_data["role"])
        if "status" in update_data and update_data["status"] != client.status:
            self._validate_status_transition(client.status, update_data["status"])

        # update
        updated_client = await self.repo.update_in_place(client_id, **update_data)
        if not updated_client:
            raise EntityNotFoundException(f"Client {client_id} 수정에 실패했습니다")

        return ClientAtomic.updated(client=updated_client, changed=changed)

    def _validate_role_transition(self, current_role: str, new_role: str) -> None:
        allowed = self.ALLOWED_ROLE_TRANSITIONS.get(current_role, [])
        if new_role not in allowed:
            raise InvalidOperationException(
                f"Invalid role transition: {current_role} → {new_role}. "
                f"Allowed transitions: {allowed or 'None'}"
            )

    def _validate_status_transition(self, current_status: str, new_status: str) -> None:
        allowed = self.ALLOWED_STATUS_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise InvalidOperationException(
                f"Invalid status transition: {current_status} → {new_status}. "
                f"Allowed transitions: {allowed}"
            )
